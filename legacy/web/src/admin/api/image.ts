import { apiURL, notifyUnauthorized, request } from './client'
import { getToken, removeToken } from '../auth/token'
import { extractApiMessage, isUnauthorizedResponse } from '../utils/errors'
import type { Photo, UploadResult } from './types'

export const AVATAR_THUMB_SIZE = 128

export function getAvailablePhotos(): Promise<Photo[]> {
  return request<Photo[]>({
    url: 'admin/image/available-photo',
    method: 'GET',
    timeout: 0,
  })
}

export function cleanUnusedImages(): Promise<string[]> {
  return request<string[]>({
    url: 'admin/image/clean-unused',
    method: 'POST',
    timeout: 0,
  })
}

export function refreshThumb(params: { src: string; thumb_size?: number }): Promise<unknown> {
  return request<unknown>({
    url: 'admin/image/refresh-thumb',
    method: 'POST',
    data: params.thumb_size === undefined
      ? { src: params.src }
      : { src: params.src, thumb_size: params.thumb_size },
    timeout: 0,
  })
}

export type UploadOptions = {
  thumbSize?: number
  onProgress?: (percent: number) => void
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function uploadImage(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const query = options.thumbSize
      ? `?thumb_size=${encodeURIComponent(String(options.thumbSize))}`
      : ''
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${apiURL('admin/image/upload')}${query}`, true)
    xhr.timeout = 0

    const token = getToken()
    if (token) {
      xhr.setRequestHeader('Authorization', token)
    }

    xhr.upload.onprogress = event => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onerror = () => reject(new Error('上传失败，无法连接服务器'))
    xhr.onabort = () => reject(new Error('上传已取消'))
    xhr.onload = () => {
      const data = parseJson(xhr.responseText)

      if (xhr.status === 200) {
        resolve(data as UploadResult)
        return
      }

      if (isUnauthorizedResponse(xhr.status, data)) {
        removeToken()
        notifyUnauthorized()
      }

      reject(new Error(extractApiMessage(data) ?? `上传失败（HTTP ${xhr.status}）`))
    }

    const formData = new FormData()
    formData.append('file', file, file.name)
    xhr.send(formData)
  })
}
