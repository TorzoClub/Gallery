import { fileExists } from './fs'
import { readJsonFile } from './fs'
import { makePaths } from './index'
import { acquireStorageLock } from './lock'
import { parsePoolFile } from './codec'
import {
  LATEST_STORAGE_VERSION,
  runStorageUpdaters,
  type StorageUpdateResult,
  type StorageVersion,
} from './updaters'

function asStorageVersion(value: number): StorageVersion {
  if (value === 1 || value === 2) {
    return value
  }
  throw new Error(`不支持的 storage schema_version: ${value}`)
}

export async function updateStorage(storage_path: string): Promise<StorageUpdateResult> {
  const paths = makePaths(storage_path)
  if (!(await fileExists(paths.pool_file))) {
    throw new Error(`storage 不存在: ${paths.root}`)
  }

  const lock = await acquireStorageLock(paths.lock_file)
  try {
    const pool = parsePoolFile(await readJsonFile(paths.pool_file))
    const current = asStorageVersion(pool.schema_version)
    if (current > LATEST_STORAGE_VERSION) {
      throw new Error(
        `storage schema_version=${current} 高于当前程序支持的版本 ${LATEST_STORAGE_VERSION}`,
      )
    }
    return await runStorageUpdaters(paths, current)
  } finally {
    await lock.release()
  }
}
