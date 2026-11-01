import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
}

export async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

export async function readJsonFile(file: string): Promise<unknown> {
  const text = await fs.readFile(file, 'utf8')
  return JSON.parse(text)
}

export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(file))

  const text = `${JSON.stringify(value, null, 2)}\n`
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`
  const handle = await fs.open(tmp, 'w', 0o600)

  try {
    await handle.writeFile(text, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }

  if (await fileExists(file)) {
    await fs.copyFile(file, `${file}.bak`)
    await fs.chmod(`${file}.bak`, 0o600)
  }

  await fs.rename(tmp, file)
  await fs.chmod(file, 0o600)
}

export async function writeBufferAtomic(file: string, buffer: Buffer): Promise<void> {
  await ensureDir(path.dirname(file))
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`
  const handle = await fs.open(tmp, 'w', 0o600)

  try {
    await handle.writeFile(buffer)
    await handle.sync()
  } finally {
    await handle.close()
  }

  await fs.rename(tmp, file)
  await fs.chmod(file, 0o600)
}

export async function removeFile(file: string): Promise<void> {
  await fs.rm(file, { force: true })
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
  return entries
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(dir, name))
    .sort()
}
