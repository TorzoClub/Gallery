import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { HdrCicp } from './hdr'

const COMMAND_TIMEOUT_MS = 180_000
const MAX_BUFFER = 4 * 1024 * 1024

/** Apple HDR HEIC 的 HDR alternate 是 BT.2020 PQ */
export const HEIC_HDR_CICP: HdrCicp = {
  primaries: 9,
  transfer: 16,
  matrix: 9,
  full_range: true,
}

type CommandResult = { stdout: string; stderr: string }

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

export function heicToolsAvailable(): Promise<boolean> {
  if (tools_available === null) {
    tools_available = Promise.all([
      run('python3', ['-c', 'import pillow_heif, apple_hdr_heic']),
      run('exiftool', ['-ver']),
      run('apple-hdr-heic-decoder', ['--help']),
    ]).then(() => true, () => false)
  }
  return tools_available
}

export async function assertHeicTools(): Promise<void> {
  if (!(await heicToolsAvailable())) {
    throw new Error('HEIC 工具不可用：需要 pillow_heif、exiftool 和 apple-hdr-heic-decoder（Docker 镜像内已提供）')
  }
}

const SDR_SCRIPT = [
  'import sys',
  'from PIL import Image, ImageOps',
  'import pillow_heif',
  'pillow_heif.register_heif_opener()',
  'with Image.open(sys.argv[1]) as image:',
  '    image = ImageOps.exif_transpose(image)',
  '    image.save(sys.argv[2], "PNG")',
].join('\n')

/** HEIC 主图先由 pillow_heif 解成 PNG，sharp 不直接解 HEVC。 */
export async function writeHeicSdrPng(options: {
  source_path: string
  output_path: string
  temp_dir: string
}): Promise<void> {
  await run('python3', ['-c', SDR_SCRIPT, options.source_path, options.output_path])
}

/**
 * Apple HEIC 的 HDR gain map 是一个辅助图（aux image），sharp/libheif 目前不会暴露它。
 * 有 AuxiliaryImageType 或 HDRGainMapVersion 才尝试；没有时按普通 SDR HEIC 处理。
 */
export async function isHeicHdrSource(source_path: string): Promise<boolean> {
  const { stdout } = await run('exiftool', [
    '-s3',
    '-QuickTime:AuxiliaryImageType',
    '-XMP:HDRGainMapVersion',
    source_path,
  ])
  return /hdrgainmap/i.test(stdout) || /^\d+$/m.test(stdout)
}

/** 把 HEIC 主图 + Apple gain map 解码为 16-bit BT.2020 PQ PNG */
export async function writeHeicHdrPng(options: {
  source_path: string
  output_path: string
  temp_dir: string
}): Promise<void> {
  const extension = path.extname(options.source_path).toLowerCase()
  const input_path = extension === '.heic'
    ? options.source_path
    : path.join(options.temp_dir, `heic-${Date.now()}-${Math.random().toString(16).slice(2)}.heic`)
  const copied = input_path !== options.source_path
  try {
    if (copied) {
      await fs.copyFile(options.source_path, input_path)
    }
    await run('apple-hdr-heic-decoder', [input_path, options.output_path])
  } finally {
    if (copied) {
      await fs.rm(input_path, { force: true })
    }
  }
}
