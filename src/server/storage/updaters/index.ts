import type { StoragePaths } from '../index'
import { updateV1ToV2 } from './v1-to-v2'

export type StorageVersion = 1 | 2
export const LATEST_STORAGE_VERSION: StorageVersion = 2

export type StorageUpdateResult = {
  from: StorageVersion
  to: StorageVersion
  changed: boolean
  renamed_avatars: number
}

export async function runStorageUpdaters(
  paths: StoragePaths,
  current: StorageVersion,
): Promise<StorageUpdateResult> {
  let version = current
  let renamed_avatars = 0

  while (version < LATEST_STORAGE_VERSION) {
    switch (version) {
      case 1: {
        const result = await updateV1ToV2(paths)
        renamed_avatars += result.renamed_avatars
        version = 2
        break
      }
      default:
        throw new Error(`不支持的 storage schema_version: ${version}`)
    }
  }

  return {
    from: current,
    to: version,
    changed: version !== current,
    renamed_avatars,
  }
}
