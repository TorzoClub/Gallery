import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { initStorage } from '../../src/server/cli/init-storage'
import { createLogger } from '../../src/server/logger'
import { createStorage } from '../../src/server/storage'
import { fileExists } from '../../src/server/storage/fs'

const dirs: string[] = []

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'torzo-init-storage-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

describe('storage:init', () => {
  it('creates an empty storage and is idempotent', async () => {
    const dir = await tempDir()

    const first = await initStorage({ storage_path: dir })
    expect(first.initialized).toBe(true)
    expect(first.storage_path).toBe(path.resolve(dir))

    const pool = JSON.parse(await fs.readFile(path.join(dir, 'pool.json'), 'utf8'))
    expect(pool.schema_version).toBe(2)
    expect(pool.next_id).toBe(1)

    expect(await fileExists(path.join(dir, 'members.json'))).toBe(true)
    expect(await fileExists(path.join(dir, 'instance-config.json'))).toBe(true)
    expect(await fileExists(path.join(dir, 'galleries'))).toBe(true)
    expect(await fileExists(path.join(dir, 'stored-images', 'source'))).toBe(true)
    expect(await fileExists(path.join(dir, 'stored-images', 'thumb'))).toBe(true)
    expect(await fileExists(path.join(dir, 'stored-images', 'temp'))).toBe(true)

    const second = await initStorage({ storage_path: dir })
    expect(second.initialized).toBe(false)

    const pool_after = JSON.parse(await fs.readFile(path.join(dir, 'pool.json'), 'utf8'))
    expect(pool_after.next_id).toBe(1)
  })

  it('refuses to initialize while another process holds the storage lock', async () => {
    const dir = await tempDir()
    const storage = await createStorage({
      storage_path: dir,
      allow_empty_data: true,
      logger: createLogger({ level: 'error', pretty: true }),
    })

    try {
      await expect(initStorage({ storage_path: dir }))
        .rejects.toThrowError(/已被另一个进程锁定/)
    } finally {
      await storage.close()
    }
  })
})
