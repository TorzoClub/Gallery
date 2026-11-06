import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  photoOptimizedSize,
  normalizedSize,
  type ImageSize,
} from './image'
import type { ImageFormat } from '../common/image-name'
import { badRequest } from '../common/error'

export type HdrCicp = {
  primaries: number
  transfer: number
  matrix: number
  full_range: boolean
}

export type HdrSource = {
  kind: 'avif-cicp' | 'png-cicp' | 'jpeg-gain-map' | 'avif-gain-map'
  cicp: HdrCicp
}

type CommandResult = { stdout: string; stderr: string }

const COMMAND_TIMEOUT_MS = 180_000
const MAX_BUFFER = 4 * 1024 * 1024

function run(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: COMMAND_TIMEOUT_MS, maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
      if (error !== null) {
        reject(new Error(`${command} 失败：${stderr.trim() || error.message}`))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

let tools_available: Promise<boolean> | null = null

/** Production 启动时检查 HDR 工具；开发环境可以在没有 libavif 的机器上只跑 SDR */
export function hdrToolsAvailable(): Promise<boolean> {
  if (tools_available === null) {
    tools_available = Promise.all([
      run('avifenc', ['--version']),
      run('avifdec', ['--version']),
      run('avifgainmaputil', ['help']),
    ]).then(() => true, () => false)
  }
  return tools_available
}

export async function assertHdrTools(): Promise<void> {
  if (!(await hdrToolsAvailable())) {
    throw new Error('HDR 工具不可用：需要 avifenc、avifdec、avifgainmaputil（libavif 1.4.2）')
  }
}

/** CICP transfer 16 = PQ，18 = HLG；别的 transfer 不当作 HDR */
export function isHdrCicp(cicp: HdrCicp | null): cicp is HdrCicp {
  return cicp !== null && (cicp.transfer === 16 || cicp.transfer === 18)
}

/**
 * 读取 AVIF 的 nclx/CICP。`avifdec --info` 会同时打印主图和 gain map alternate image；
 * 这个函数只取主图字段。
 */
export function parseAvifCicp(output: string): HdrCicp | null {
  const primaries = /Color Primaries:\s*(\d+)/.exec(output)
  const transfer = /Transfer Char\.\s*:\s*(\d+)/.exec(output)
  const matrix = /Matrix Coeffs\.\s*:\s*(\d+)/.exec(output)
  if (primaries === null || transfer === null || matrix === null) {
    return null
  }
  const range = /Range\s*:\s*(Full|Limited)/i.exec(output)?.[1]?.toLowerCase()
  return {
    primaries: Number(primaries[1]),
    transfer: Number(transfer[1]),
    matrix: Number(matrix[1]),
    full_range: range === undefined || range === 'full',
  }
}

type AvifInfo = {
  cicp: HdrCicp | null
  gain_map: boolean
}

export function parseAvifInfo(output: string): AvifInfo {
  const gain_line = /Gain map\s*:\s*([^\n]*)/.exec(output)?.[1]?.trim() ?? ''
  return {
    cicp: parseAvifCicp(output),
    gain_map: gain_line !== '' && gain_line !== 'Absent',
  }
}

/** PNG cICP chunk 是 4 字节：primaries、transfer、matrix、full range flag */
export function parsePngCicp(buffer: Buffer): HdrCicp | null {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (buffer.length < signature.length || !buffer.subarray(0, signature.length).equals(signature)) {
    return null
  }

  let offset = signature.length
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data_start = offset + 8
    const data_end = data_start + length
    if (data_end + 4 > buffer.length) {
      return null
    }
    if (type === 'cICP') {
      if (length !== 4) {
        return null
      }
      return {
        primaries: buffer.readUInt8(data_start),
        transfer: buffer.readUInt8(data_start + 1),
        matrix: buffer.readUInt8(data_start + 2),
        full_range: buffer.readUInt8(data_start + 3) === 1,
      }
    }
    if (type === 'IEND') {
      return null
    }
    offset = data_end + 4
  }
  return null
}

async function readAvifInfo(file_path: string): Promise<AvifInfo> {
  const result = await run('avifdec', ['--info', file_path])
  return parseAvifInfo(result.stdout)
}

async function readAvifCicp(file_path: string): Promise<HdrCicp | null> {
  return (await readAvifInfo(file_path)).cicp
}

async function makeGainMapHdr(
  source_path: string,
  format: ImageFormat,
  temp_dir: string,
): Promise<{ path: string; cicp: HdrCicp }> {
  const output_path = path.join(temp_dir, `gainmap-${Date.now()}-${Math.random().toString(16).slice(2)}.avif`)
  try {
    if (format === 'jpg') {
      await run('avifgainmaputil', ['convert', '--swap-base', '--ignore-profile', source_path, output_path])
    } else {
      await run('avifgainmaputil', ['swapbase', source_path, output_path, '--ignore-profile'])
    }
    const cicp = await readAvifCicp(output_path)
    if (!isHdrCicp(cicp)) {
      throw badRequest('gain map 无法得到 PQ/HLG HDR CICP')
    }
    return { path: output_path, cicp }
  } catch (error) {
    await fs.rm(output_path, { force: true })
    throw error
  }
}

/**
 * 判断 source 是否值得生成 HDR：
 * - gain map：总是尝试，最终由 alternate CICP 决定
 * - PNG：读 cICP chunk
 * - AVIF：读 nclx；10-bit SDR 的 transfer 不是 16/18，不能生成 HDR
 * - 其他格式：不猜
 */
export async function detectHdrSource(
  source_path: string,
  format: ImageFormat,
  temp_dir: string,
): Promise<HdrSource | null> {
  const metadata = await sharp(source_path).metadata()
  const has_gain_map = metadata.gainMap !== undefined

  if (format === 'png') {
    const buffer = await fs.readFile(source_path)
    const cicp = parsePngCicp(buffer)
    return isHdrCicp(cicp) ? { kind: 'png-cicp', cicp } : null
  }

  if (format === 'jpg' && has_gain_map) {
    const hdr = await makeGainMapHdr(source_path, format, temp_dir)
    await fs.rm(hdr.path, { force: true })
    return { kind: 'jpeg-gain-map', cicp: hdr.cicp }
  }

  if (format !== 'avif') {
    return null
  }

  // AVIF 的 gain map 不会出现在 sharp metadata 里，必须读 libavif 的 container info。
  const info = await readAvifInfo(source_path)
  if (info.gain_map) {
    const hdr = await makeGainMapHdr(source_path, format, temp_dir)
    await fs.rm(hdr.path, { force: true })
    return { kind: 'avif-gain-map', cicp: hdr.cicp }
  }
  return isHdrCicp(info.cicp) ? { kind: 'avif-cicp', cicp: info.cicp } : null
}

async function decodeHdrToPng(
  source_path: string,
  format: ImageFormat,
  kind: HdrSource['kind'],
  temp_dir: string,
): Promise<string> {
  if (format === 'png') {
    return source_path
  }

  let hdr_avif = source_path
  if (kind === 'jpeg-gain-map' || kind === 'avif-gain-map') {
    hdr_avif = (await makeGainMapHdr(source_path, format, temp_dir)).path
  }
  const output_path = path.join(temp_dir, `hdr-${Date.now()}-${Math.random().toString(16).slice(2)}.png`)
  try {
    await run('avifdec', ['--depth', '16', '--sato', hdr_avif, output_path])
    return output_path
  } finally {
    if (hdr_avif !== source_path) {
      await fs.rm(hdr_avif, { force: true })
    }
  }
}

async function resizeHdrPng(input_path: string, output_path: string, source: ImageSize, max_dimension: number): Promise<void> {
  const target = photoOptimizedSize(source, max_dimension)
  await sharp(input_path)
    .rotate()
    .pipelineColourspace('rgb16')
    .resize({ width: target.width, height: target.height, fit: 'fill' })
    .toColourspace('rgb16')
    .png()
    .toFile(output_path)
}

/**
 * 生成纯 HDR AVIF base：
 * 16-bit PNG → avifenc --depth 10 --cicp；不使用 gain map 作为最终文件。
 * 编码失败由调用方决定是否保留旧 HDR；这里只保证不留下半成品。
 */
export async function writeHdrOptimizedImage(options: {
  source_path: string
  output_path: string
  format: ImageFormat
  temp_dir: string
  quality: number
  effort: number
  max_dimension: number
}): Promise<boolean> {
  const source = await detectHdrSource(options.source_path, options.format, options.temp_dir)
  if (source === null) {
    return false
  }

  const work_dir = await fs.mkdtemp(path.join(options.temp_dir, 'hdr-work-'))
  const staging = path.join(work_dir, 'resized.png')
  const encoded = path.join(work_dir, 'encoded.avif')
  try {
    const png = await decodeHdrToPng(options.source_path, options.format, source.kind, work_dir)
    const metadata = await sharp(png).metadata()
    await resizeHdrPng(png, staging, normalizedSize(metadata), options.max_dimension)

    const speed = Math.max(0, Math.min(10, 10 - options.effort))
    await run('avifenc', [
      '--depth', '10',
      '--cicp', `${source.cicp.primaries}/${source.cicp.transfer}/${source.cicp.matrix}`,
      '--range', source.cicp.full_range ? 'full' : 'limited',
      '--ignore-icc',
      '--ignore-exif',
      '--ignore-xmp',
      '--jobs', 'all',
      '-q', String(options.quality),
      '--speed', String(speed),
      staging,
      encoded,
    ])
    const encoded_cicp = await readAvifCicp(encoded)
    if (!isHdrCicp(encoded_cicp)) {
      throw badRequest('HDR 输出缺少 PQ/HLG CICP')
    }
    await fs.rename(encoded, options.output_path)
    return true
  } finally {
    await fs.rm(work_dir, { recursive: true, force: true })
  }
}
