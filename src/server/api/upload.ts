import path from 'node:path'
import { Transform, Readable } from 'node:stream'
import { crc32 } from 'node:zlib'
import type { Handler } from 'hono'
import Busboy from 'busboy'
import { apiError } from '../common/error'
import { formatFromFilename } from '../common/image-name'
import { uuidv7 } from '../common/uuid'
import type { Instance } from '../instance'
import type { TempImage } from '../instance/prepare-photo'

function uploadFormat(filename: string | undefined): string {
  if (filename === undefined || filename.length === 0) {
    throw apiError(400, 'BAD_REQUEST', '图片缺少文件名')
  }

  const ext = path.extname(filename).slice(1).toLowerCase()
  if (!/^[0-9a-z]+$/.test(ext)) {
    throw apiError(400, 'BAD_REQUEST', '图片扩展名非法')
  }

  const format = formatFromFilename(`upload.${ext}`)
  if (format === null) {
    throw apiError(400, 'BAD_REQUEST', '不支持的图片格式')
  }
  return format
}

export function createUploadHandler(instance: Instance): Handler {
  return async (c) => {
    const config = instance.getInstanceConfig()
    const content_type = c.req.header('content-type')
    if (content_type === undefined || !content_type.startsWith('multipart/form-data')) {
      throw apiError(400, 'BAD_REQUEST', '上传内容必须是 multipart/form-data')
    }

    const body = c.req.raw.body
    if (body === null) {
      throw apiError(400, 'BAD_REQUEST', '缺少上传内容')
    }

    const result = await new Promise<TempImage>((resolve, reject) => {
      let settled = false
      let file_seen = false
      let file_result: Promise<TempImage> | undefined
      let busboy: ReturnType<typeof Busboy> | undefined

      const fail = (error: unknown): void => {
        if (settled) {
          return
        }
        settled = true
        try {
          busboy?.destroy()
        } catch {
          // Ignore parser teardown errors.
        }
        reject(error)
      }

      try {
        busboy = Busboy({
          headers: { 'content-type': content_type },
          limits: {
            files: 1,
            fileSize: config.max_upload_bytes,
          },
        })
      } catch {
        fail(apiError(400, 'BAD_REQUEST', '无法解析上传表单'))
        return
      }

      busboy.on('file', (name, file, info) => {
        // A parser abort can surface as an error on the file stream.
        file.on('error', () => undefined)
        if (name !== 'file' && name !== 'image') {
          file.resume()
          fail(apiError(400, 'BAD_REQUEST', '缺少上传文件，字段名需要是 file 或 image'))
          return
        }
        if (file_seen) {
          file.resume()
          fail(apiError(400, 'BAD_REQUEST', '一次只能上传一个文件'))
          return
        }
        file_seen = true

        let format: string
        try {
          format = uploadFormat(info.filename)
        } catch (error) {
          file.resume()
          fail(error)
          return
        }

        const temp_id = uuidv7()
        let crc = 0
        let size = 0
        let resolve_crc: (value: number) => void = () => undefined
        let reject_crc: (error: unknown) => void = () => undefined
        const crc_ready = new Promise<number>((resolve_crc_value, reject_crc_value) => {
          resolve_crc = resolve_crc_value
          reject_crc = reject_crc_value
        })
        // If storeTempImage fails before awaiting crc_ready, avoid an unhandled rejection.
        void crc_ready.catch(() => undefined)

        const meter = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            size += chunk.length
            if (size > config.max_upload_bytes) {
              callback(apiError(413, 'BAD_REQUEST', `上传文件不能超过 ${config.max_upload_bytes} 字节`))
              return
            }
            crc = crc32(chunk, crc)
            callback(null, chunk)
          },
        })

        meter.on('end', () => resolve_crc(crc))
        meter.on('error', (error) => {
          reject_crc(error)
          fail(error)
        })
        file.on('error', (error) => {
          reject_crc(error)
          fail(error)
        })
        file.on('limit', () => {
          const error = apiError(413, 'BAD_REQUEST', `上传文件不能超过 ${config.max_upload_bytes} 字节`)
          meter.destroy(error)
          file.destroy()
          fail(error)
        })

        file.pipe(meter)
        file_result = instance.storeTempImage({
          stream: meter,
          temp_id,
          format,
          crc32: crc_ready,
        })
        void file_result.catch(() => undefined)
      })

      busboy.on('filesLimit', () => {
        fail(apiError(400, 'BAD_REQUEST', '一次只能上传一个文件'))
      })
      busboy.on('error', fail)
      busboy.on('close', () => {
        if (settled) {
          return
        }
        if (file_result === undefined) {
          fail(apiError(400, 'BAD_REQUEST', '缺少上传文件，字段名需要是 file 或 image'))
          return
        }
        file_result.then(
          (value) => {
            if (!settled) {
              settled = true
              resolve(value)
            }
          },
          fail,
        )
      })

      try {
        Readable.fromWeb(body as ReadableStream<Uint8Array>).pipe(busboy)
      } catch (error) {
        fail(apiError(400, 'BAD_REQUEST', '无法解析上传表单', error))
      }
    })

    return c.json({
      success: true,
      data: result,
    })
  }
}
