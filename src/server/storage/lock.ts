import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export type StorageLock = {
  path: string
  token: string
  release(): Promise<void>
}

async function processIsAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

async function tryAcquire(lock_path: string, token: string): Promise<boolean> {
  try {
    const handle = await fs.open(lock_path, 'wx', 0o600)
    try {
      await handle.writeFile(JSON.stringify({
        pid: process.pid,
        started_at: new Date().toISOString(),
        token,
      }, null, 2))
      await handle.sync()
    } finally {
      await handle.close()
    }
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false
    }
    throw error
  }
}

async function isStale(lock_path: string): Promise<boolean> {
  try {
    const text = await fs.readFile(lock_path, 'utf8')
    const parsed = JSON.parse(text) as { pid?: unknown }
    if (typeof parsed.pid !== 'number' || !Number.isSafeInteger(parsed.pid)) {
      return true
    }
    return !(await processIsAlive(parsed.pid))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return true
    }
    return true
  }
}

export async function acquireStorageLock(lock_path: string): Promise<StorageLock> {
  const token = randomUUID()

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await tryAcquire(lock_path, token)) {
      return {
        path: lock_path,
        token,
        async release() {
          try {
            const text = await fs.readFile(lock_path, 'utf8')
            const parsed = JSON.parse(text) as { token?: unknown }
            if (parsed.token === token) {
              await fs.rm(lock_path, { force: true })
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              throw error
            }
          }
        },
      }
    }

    if (!(await isStale(lock_path))) {
      throw new Error(`storage 已被另一个进程锁定: ${lock_path}`)
    }

    await fs.rm(lock_path, { force: true })
  }

  throw new Error(`无法获取 storage lock: ${lock_path}`)
}
