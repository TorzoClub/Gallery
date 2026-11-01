import { uploadImage as uploadTempImage } from '../../api/upload'
import type { UploadOptions } from '../../api/upload'
import { adminMutate } from './client'
import type { UploadResult } from './types'

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
