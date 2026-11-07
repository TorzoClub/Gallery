import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'

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

async function processStartTicks(pid: number): Promise<string | null> {
  try {
    const stat = await fs.readFile(`/proc/${pid}/stat`, 'utf8')
    const close = stat.lastIndexOf(')')
    if (close < 0) {
      return null
    }
    // /proc/<pid>/stat 的第 22 个字段是进程启动时间；comm 可能包含空格和括号。
    return stat.slice(close + 1).trim().split(/\s+/)[19] ?? null
  } catch {
    // macOS 等没有 /proc 的平台退回 pid 检测。
    return null
  }
}

async function tryAcquire(
  lock_path: string,
  token: string,
  owner: { hostname: string; start_ticks: string | null },
): Promise<boolean> {
  try {
    const handle = await fs.open(lock_path, 'wx', 0o600)
    try {
      await handle.writeFile(JSON.stringify({
        pid: process.pid,
        hostname: owner.hostname,
        start_ticks: owner.start_ticks,
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
    const parsed = JSON.parse(text) as {
      pid?: unknown
      hostname?: unknown
      start_ticks?: unknown
    }
    if (typeof parsed.pid !== 'number' || !Number.isSafeInteger(parsed.pid)) {
      return true
    }
    // 容器重建后 hostname 会变化；即使 PID 被新容器复用，旧 lock 也应视为 stale。
    if (typeof parsed.hostname === 'string' && parsed.hostname !== os.hostname()) {
      return true
    }
    if (!(await processIsAlive(parsed.pid))) {
      return true
    }
    // 同一主机/容器内 PID 可能被复用，比较进程启动时间可以区分旧进程。
    if (typeof parsed.start_ticks === 'string') {
      const current = await processStartTicks(parsed.pid)
      if (current !== null && current !== parsed.start_ticks) {
        return true
      }
    }
    return false
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return true
    }
    return true
  }
}

export async function acquireStorageLock(lock_path: string): Promise<StorageLock> {
  const token = randomUUID()
  const owner = {
    hostname: os.hostname(),
    start_ticks: await processStartTicks(process.pid),
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await tryAcquire(lock_path, token, owner)) {
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
