import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { brotliDecompressSync, gzipSync, gunzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { precompressDirectory } from '../../src/server/cli/precompress'

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

describe('precompressDirectory', () => {
  it('creates gzip and brotli copies for static files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'torzo-precompress-'))
    dirs.push(root)
    const file = path.join(root, 'assets', 'app.js')
    await fs.mkdir(path.dirname(file), { recursive: true })
    const content = Buffer.from('console.log("hello")')
    await fs.writeFile(file, content)
    await fs.writeFile(path.join(root, 'already.gz'), gzipSync(Buffer.from('old')))

    const result = await precompressDirectory(root)

    expect(result.compressed).toBe(1)
    expect(gunzipSync(await fs.readFile(`${file}.gz`)).toString()).toBe(content.toString())
    expect(brotliDecompressSync(await fs.readFile(`${file}.br`)).toString()).toBe(content.toString())
    await expect(fs.stat(path.join(root, 'already.gz.gz'))).rejects.toThrow()
    await expect(fs.stat(path.join(root, 'already.gz.br'))).rejects.toThrow()
  })

  it('skips empty files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'torzo-precompress-empty-'))
    dirs.push(root)
    await fs.writeFile(path.join(root, 'empty.html'), '')

    const result = await precompressDirectory(root)

    expect(result).toEqual({ compressed: 0, skipped: 1 })
    await expect(fs.stat(path.join(root, 'empty.html.gz'))).rejects.toThrow()
  })
})
