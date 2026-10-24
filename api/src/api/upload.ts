import type { Handler } from 'hono'
import { apiError } from '../common/error'
import type { Instance } from '../instance'

export function createUploadHandler(instance: Instance): Handler {
  return async (c) => {
    const config = instance.getInstanceConfig()
    const content_length = Number(c.req.header('content-length') ?? '0')

    if (Number.isFinite(content_length) && content_length > config.max_upload_bytes) {
      throw apiError(
        413,
        'BAD_REQUEST',
        `上传文件不能超过 ${config.max_upload_bytes} 字节`,
      )
    }

    let body: Awaited<ReturnType<typeof c.req.parseBody>>
    try {
      body = await c.req.parseBody()
    } catch {
      throw apiError(400, 'BAD_REQUEST', '无法解析上传表单')
    }

    const raw = body.file ?? body.image
    if (raw === undefined || raw === null) {
      throw apiError(400, 'BAD_REQUEST', '缺少上传文件，字段名需要是 file 或 image')
    }
    if (Array.isArray(raw)) {
      throw apiError(400, 'BAD_REQUEST', '一次只能上传一个文件')
    }
    if (!(raw instanceof File)) {
      throw apiError(400, 'BAD_REQUEST', '上传字段不是文件')
    }
    if (raw.size > config.max_upload_bytes) {
      throw apiError(
        413,
        'BAD_REQUEST',
        `上传文件不能超过 ${config.max_upload_bytes} 字节`,
      )
    }

    const buffer = Buffer.from(await raw.arrayBuffer())
    const result = await instance.storeTempImage({
      buffer,
      original_name: raw.name,
    })

    return c.json({
      success: true,
      data: result,
    })
  }
}
