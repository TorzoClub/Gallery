import * as z from 'zod'

const legacyId = z.coerce.number().int().positive()
const legacyIndex = z.coerce.number().int().nonnegative()

const LegacyGallerySchema = z.object({
  id: legacyId,
  name: z.string(),
  index: legacyIndex,
  vote_limit: z.coerce.number().int().nonnegative(),
  event_start: z.string(),
  submission_expire: z.string(),
  event_end: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

const LegacyMemberSchema = z.object({
  id: legacyId,
  qq_num: z.union([z.number(), z.string()]).transform(value => Number(value)),
  name: z.string(),
  avatar_src: z.string(),
  avatar_thumb_url: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

const LegacyPhotoSchema = z.object({
  id: legacyId,
  gallery_id: legacyId,
  member_id: legacyId,
  desc: z.string(),
  src: z.string(),
  index: legacyIndex.default(0),
  src_url: z.string().optional(),
  vote_count: z.coerce.number().int().nonnegative().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

const LegacyVoteSchema = z.object({
  id: legacyId,
  photo_id: legacyId,
  member_id: legacyId,
  gallery_id: legacyId.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

const LegacyMemberVoteSchema = LegacyMemberSchema.extend({
  votes: z.array(LegacyVoteSchema).default([]),
})

const LegacyLoginSchema = z.object({
  token: z.string().min(1),
})

const LegacyGalleryListSchema = z.array(LegacyGallerySchema)
const LegacyMemberListSchema = z.array(LegacyMemberSchema)
const LegacyPhotoListSchema = z.array(LegacyPhotoSchema)
const LegacyMemberVoteListSchema = z.array(LegacyMemberVoteSchema)

export type LegacyGallery = z.infer<typeof LegacyGallerySchema>
export type LegacyMember = z.infer<typeof LegacyMemberSchema>
export type LegacyPhoto = z.infer<typeof LegacyPhotoSchema>
export type LegacyVote = z.infer<typeof LegacyVoteSchema>
export type LegacyMemberVote = z.infer<typeof LegacyMemberVoteSchema>

export type LegacySnapshot = {
  galleries: LegacyGallery[]
  members: LegacyMember[]
  photos: LegacyPhoto[]
  votes: LegacyVote[]
}

export type FetchLike = typeof fetch

export type LegacyApiClientOptions = {
  api_url: string
  admin_password: string
  fetch_impl?: FetchLike
  timeout_ms?: number
  image_timeout_ms?: number
  max_image_bytes?: number
}

export class LegacyApiError extends Error {
  readonly endpoint: string
  readonly status: number | null

  constructor(message: string, endpoint: string, status: number | null = null) {
    super(message)
    this.name = 'LegacyApiError'
    this.endpoint = endpoint
    this.status = status
  }
}

export function normalizeLegacyApiUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('api_url 不是合法的 URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('api_url 只支持 http/https')
  }
  url.search = ''
  url.hash = ''
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`
  }
  return url.toString()
}

function errorMessageFromBody(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const message = (body as { message?: unknown }).message
  return typeof message === 'string' ? message : null
}

export class LegacyApiClient {
  readonly api_url: string
  readonly max_image_bytes: number
  private readonly admin_password: string
  private readonly fetch_impl: FetchLike
  private readonly timeout_ms: number
  private readonly image_timeout_ms: number
  private token: string | null = null
  private readonly image_cache = new Map<string, Buffer>()

  constructor(options: LegacyApiClientOptions) {
    this.api_url = normalizeLegacyApiUrl(options.api_url)
    this.admin_password = options.admin_password
    this.fetch_impl = options.fetch_impl ?? fetch
    this.timeout_ms = options.timeout_ms ?? 30_000
    this.image_timeout_ms = options.image_timeout_ms ?? 60_000
    this.max_image_bytes = options.max_image_bytes ?? 64 * 1024 * 1024
  }

  private adminUrl(pathname: string): string {
    return new URL(pathname.replace(/^\/+/, ''), this.api_url).toString()
  }

  sourceUrl(filename: string): string {
    return new URL(`src/${encodeURIComponent(filename)}`, this.api_url).toString()
  }

  async login(): Promise<string> {
    const endpoint = this.adminUrl('admin/login')
    const response = await this.fetch_impl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ pass: this.admin_password }),
      signal: AbortSignal.timeout(this.timeout_ms),
    })

    const body = await this.readJsonResponse(response, endpoint)
    if (!response.ok) {
      const message = errorMessageFromBody(body) ?? `HTTP ${response.status}`
      throw new LegacyApiError(`Legacy 登录失败: ${message}`, endpoint, response.status)
    }

    const parsed = LegacyLoginSchema.safeParse(body)
    if (!parsed.success) {
      throw new LegacyApiError(
        `Legacy 登录响应格式错误: ${z.prettifyError(parsed.error)}`,
        endpoint,
        response.status,
      )
    }
    this.token = parsed.data.token
    return this.token
  }

  private async readJsonResponse(response: Response, endpoint: string): Promise<unknown> {
    const text = await response.text()
    if (text.trim().length === 0) {
      return null
    }
    try {
      return JSON.parse(text)
    } catch {
      throw new LegacyApiError('Legacy 返回了非 JSON 响应', endpoint, response.status)
    }
  }

  private async adminRequest(pathname: string): Promise<unknown> {
    if (this.token === null) {
      await this.login()
    }
    const endpoint = this.adminUrl(pathname)
    const response = await this.fetch_impl(endpoint, {
      method: 'GET',
      headers: {
        authorization: this.token as string,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(this.timeout_ms),
    })
    const body = await this.readJsonResponse(response, endpoint)
    if (!response.ok) {
      const message = errorMessageFromBody(body) ?? `HTTP ${response.status}`
      throw new LegacyApiError(`Legacy admin 请求失败: ${message}`, endpoint, response.status)
    }
    return body
  }

  private async adminGet<T>(pathname: string, schema: z.ZodType<T>): Promise<T> {
    const endpoint = this.adminUrl(pathname)
    const body = await this.adminRequest(pathname)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw new LegacyApiError(
        `Legacy admin 响应格式错误: ${z.prettifyError(parsed.error)}`,
        endpoint,
      )
    }
    return parsed.data
  }

  async loadSnapshot(): Promise<LegacySnapshot> {
    const galleries = await this.adminGet('admin/gallery', LegacyGalleryListSchema)
    const members = await this.adminGet('admin/member', LegacyMemberListSchema)

    const photos: LegacyPhoto[] = []
    const votes: LegacyVote[] = []

    for (const gallery of galleries) {
      const gallery_photos = await this.adminGet(
        `admin/gallery/${encodeURIComponent(String(gallery.id))}/photo`,
        LegacyPhotoListSchema,
      )
      const member_votes = await this.adminGet(
        `admin/gallery/${encodeURIComponent(String(gallery.id))}/member_vote`,
        LegacyMemberVoteListSchema,
      )

      for (const photo of gallery_photos) {
        if (photo.gallery_id !== gallery.id) {
          throw new LegacyApiError(
            `Legacy photo(${photo.id}) 的 gallery_id(${photo.gallery_id}) 与请求的 gallery(${gallery.id}) 不一致`,
            this.adminUrl(`admin/gallery/${gallery.id}/photo`),
          )
        }
        photos.push(photo)
      }

      for (const member_vote of member_votes) {
        for (const vote of member_vote.votes) {
          if (vote.gallery_id !== undefined && vote.gallery_id !== gallery.id) {
            throw new LegacyApiError(
              `Legacy vote(${vote.id}) 的 gallery_id(${vote.gallery_id}) 与请求的 gallery(${gallery.id}) 不一致`,
              this.adminUrl(`admin/gallery/${gallery.id}/member_vote`),
            )
          }
          votes.push({
            ...vote,
            gallery_id: gallery.id,
          })
        }
      }
    }

    return { galleries, members, photos, votes }
  }

  async downloadSource(filename: string): Promise<Buffer> {
    const url = this.sourceUrl(filename)
    const cached = this.image_cache.get(url)
    if (cached !== undefined) {
      return cached
    }

    let response: Response
    try {
      response = await this.fetch_impl(url, {
        method: 'GET',
        headers: { accept: 'image/*' },
        signal: AbortSignal.timeout(this.image_timeout_ms),
      })
    } catch (error) {
      throw new LegacyApiError(
        `下载 Legacy 图片失败: ${error instanceof Error ? error.message : String(error)}`,
        url,
      )
    }

    if (!response.ok) {
      throw new LegacyApiError(`下载 Legacy 图片失败: HTTP ${response.status}`, url, response.status)
    }

    const content_length = Number(response.headers.get('content-length') ?? '0')
    if (Number.isFinite(content_length) && content_length > this.max_image_bytes) {
      throw new LegacyApiError(
        `Legacy 图片超过大小限制(${this.max_image_bytes} bytes)`,
        url,
        response.status,
      )
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > this.max_image_bytes) {
      throw new LegacyApiError(
        `Legacy 图片超过大小限制(${this.max_image_bytes} bytes)`,
        url,
        response.status,
      )
    }

    this.image_cache.set(url, buffer)
    return buffer
  }
}
