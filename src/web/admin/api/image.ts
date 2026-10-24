import { uploadImage as uploadTempImage } from '../../api/upload'
import type { UploadOptions } from '../../api/upload'
import { adminMutate, adminQuery } from './client'
import type { Photo, UploadResult } from './types'

export function getAvailablePhotos(): Promise<Photo[]> {
  return adminQuery<Photo[]>('adminListAvailablePhotos')
}

export async function cleanUnusedImages(): Promise<string[]> {
  const result = await adminMutate<{ removed: string[] }>('adminCleanUnusedImages')
  return result.removed
}

export function refreshThumb(params: { photo_id: number }): Promise<unknown> {
  return adminMutate('adminRefreshThumb', params)
}

export function refreshAvatar(params: { member_id: number }): Promise<unknown> {
  return adminMutate('adminRefreshAvatar', params)
}

export type { UploadOptions }

export async function uploadImage(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const result = await uploadTempImage(file, options)
  return result
}
