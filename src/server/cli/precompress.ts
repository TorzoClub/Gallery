import { constants } from 'node:zlib'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const COMPRESSED_SUFFIXES = ['.gz', '.br', '.zst']

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full_path = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(full_path))
    } else if (entry.isFile() && !COMPRESSED_SUFFIXES.some(suffix => entry.name.endsWith(suffix))) {
      files.push(full_path)
    }
  }

  return files
}

export type PrecompressResult = {
  compressed: number
  skipped: number
}

export async function precompressDirectory(root: string): Promise<PrecompressResult> {
  const root_stat = await stat(root).catch(() => null)
  if (root_stat === null || !root_stat.isDirectory()) {
    throw new Error(`precompress: 目录不存在: ${root}`)
  }

  const files = await collectFiles(root)
  let compressed = 0
  let skipped = 0

  for (const file of files) {
    const data = await readFile(file)
    if (data.byteLength === 0) {
      skipped += 1
      continue
    }

    const gzip = gzipSync(data, { level: 9 })
    const brotli = brotliCompressSync(data, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
      },
    })

    await Promise.all([
      writeFile(`${file}.gz`, gzip),
      writeFile(`${file}.br`, brotli),
    ])
    compressed += 1
  }

  return { compressed, skipped }
}

const entry = process.argv[1]
const is_main = entry !== undefined && import.meta.url === pathToFileURL(path.resolve(entry)).href

if (is_main) {
  const root = path.resolve(process.argv[2] ?? path.join(process.cwd(), 'dist/client'))
  try {
    const result = await precompressDirectory(root)
    console.log(`[precompress] ${root}: ${result.compressed} 个文件生成 .gz/.br，跳过 ${result.skipped} 个空文件`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
