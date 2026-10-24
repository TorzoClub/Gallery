import { API_BASE, ApiError, unwrapApiResponse } from './dispatch'

export type TempUploadResult = {
  temp_id: string
  width: number
  height: number
  format: string
  size: number
}

export type UploadOptions = {
  onProgress?: (percent: number) => void
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function uploadImage(
  file: File,
  options: UploadOptions = {},
): Promise<TempUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}upload-image`, true)
    xhr.timeout = 0

    xhr.upload.onprogress = event => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', '上传失败，无法连接服务器'))
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', '上传已取消'))
    xhr.onload = () => {
      const data = parseJson(xhr.responseText)
      try {
        resolve(unwrapApiResponse<TempUploadResult>(xhr.status, data))
      } catch (error) {
        reject(error)
      }
    }

    const formData = new FormData()
    formData.append('file', file, file.name)
    xhr.send(formData)
  })
}
