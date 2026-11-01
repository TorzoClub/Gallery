import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import type { AdminPoolDTO } from '../../src/shared/dto'
import type { Hono } from 'hono'
import {
  loadEnvConfig,
  type EnvConfig,
} from '../../src/server/config'
import {
  createInstance,
  type Instance,
} from '../../src/server/instance'
import { createLogger } from '../../src/server/logger'
import {
  createStorage,
  type Storage,
} from '../../src/server/storage'

export type TestContext = {
  app: Hono
  env: EnvConfig
  instance: Instance
  storage: Storage
  dir: string
  now: Date
  setNow(value: Date): void
  login(): Promise<string>
  adminPool(): Promise<AdminPoolDTO>
  adminQuery(name: string, payload?: unknown): Promise<ApiResponse>
  adminMutate(name: string, payload?: unknown): Promise<ApiResponse>
  query(name: string, payload?: unknown): Promise<ApiResponse>
  mutate(name: string, payload?: unknown): Promise<ApiResponse>
  uploadImage(buffer?: Buffer, filename?: string): Promise<{ temp_id: string; width: number; height: number; format: string; size: number; crc32: number }>
  createMember(input?: {
    qq_num?: number
    name?: string
    avatar?: Buffer
    avatar_filename?: string
  }): Promise<Record<string, unknown>>
  createGallery(input?: Partial<GalleryInput>): Promise<Record<string, unknown>>
  createPhoto(input: {
    gallery_id: number
    member_id: number
    desc?: string
    image?: Buffer
    image_filename?: string
  }): Promise<Record<string, unknown>>
  submitPhoto(input: {
    gallery_id: number
    qq_num: number
    desc?: string
    image?: Buffer
  }): Promise<Record<string, unknown>>
  vote(input: { gallery_id: number; qq_num: number; photo_ids: number[] }): Promise<ApiResponse>
  close(): Promise<void>
}

export type ApiResponse = {
  status: number
  body: any
}

export type GalleryInput = {
  name: string
  index: number
  vote_limit: number
  event_start: Date
  submission_expire: Date
  event_end: Date
}

export async function makePng(
  width = 160,
  height = 120,
  color: { r: number; g: number; b: number } = { r: 200, g: 120, b: 80 },
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  }).png().toBuffer()
}

async function requestJson(
  app: Hono,
  pathname: string,
  body: unknown,
  token?: string,
): Promise<ApiResponse> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (token !== undefined) {
    headers.authorization = `Bearer ${token}`
  }

  const response = await app.request(pathname, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  return {
    status: response.status,
    body: await response.json(),
  }
}

export async function createTestContext(options: {
  now?: Date
  api_base_path?: string
  storage_path?: string
  remove_dir_on_close?: boolean
  client_dir?: string
} = {}): Promise<TestContext> {
  const dir = options.storage_path ?? await fs.mkdtemp(path.join(os.tmpdir(), 'torzo-api-test-'))
  const remove_dir_on_close = options.remove_dir_on_close ?? options.storage_path === undefined
  const now = options.now ?? new Date('2026-06-01T00:00:00.000Z')
  let current_now = now

  const env = loadEnvConfig({
    APP_ENV: 'test',
    HTTP_PORT: '7011',
    HTTP_HOST: '127.0.0.1',
    STORAGE_PATH: dir,
    LOG_LEVEL: 'error',
    ADMIN_PASSWORD: 'test-pass',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN_SECONDS: '3600',
    CORS_ORIGINS: '*',
    API_BASE_PATH: options.api_base_path ?? '/',
    PUBLIC_BASE_URL: 'http://test.local',
    HTTP_BODY_HARD_LIMIT_BYTES: String(32 * 1024 * 1024),
  })

  const logger = createLogger({ level: 'error', pretty: true })
  const storage = await createStorage({
    storage_path: dir,
    allow_empty_data: true,
    logger,
  })
  const instance = await createInstance({ env, storage, logger })

  // Imported lazily to keep the helper independent from the HTTP module's types.
  const { constructApi } = await import('../../src/server/api')
  const app = constructApi({ instance, env, logger, clock: () => current_now, client_dir: options.client_dir })

  let token_cache: string | undefined

  async function login(): Promise<string> {
    if (token_cache !== undefined) {
      return token_cache
    }
    const response = await requestJson(app, '/auth/login', {
      password: env.admin_password,
    })
    if (response.status !== 200) {
      throw new Error(`login failed: ${JSON.stringify(response.body)}`)
    }
    token_cache = response.body.data.token as string
    return token_cache
  }

  async function adminQuery(name: string, payload: unknown = {}): Promise<ApiResponse> {
    return requestJson(app, `/admin/query/${name}`, { payload }, await login())
  }

  async function adminPool(): Promise<AdminPoolDTO> {
    const response = await adminQuery('adminFetchPool')
    if (response.status !== 200) {
      throw new Error(`adminFetchPool 失败：HTTP ${response.status}`)
    }
    return response.body.data as AdminPoolDTO
  }

  async function adminMutate(name: string, payload: unknown = {}): Promise<ApiResponse> {
    return requestJson(app, `/admin/mutate/${name}`, { payload }, await login())
  }

  async function query(name: string, payload: unknown = {}): Promise<ApiResponse> {
    return requestJson(app, `/query/${name}`, { payload })
  }

  async function mutate(name: string, payload: unknown = {}): Promise<ApiResponse> {
    return requestJson(app, `/mutate/${name}`, { payload })
  }

  async function uploadImage(
    buffer?: Buffer,
    filename = 'photo.png',
  ): Promise<{ temp_id: string; width: number; height: number; format: string; size: number; crc32: number }> {
    const form = new FormData()
    form.append('file', new File([new Uint8Array(buffer ?? await makePng())], filename, {
      type: filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
    }))
    const response = await app.request('/upload-image', {
      method: 'POST',
      body: form,
    })
    const body = await response.json() as any
    if (response.status !== 200) {
      throw new Error(`upload failed: ${JSON.stringify(body)}`)
    }
    return body.data
  }

  async function createMember(input: {
    qq_num?: number
    name?: string
    avatar?: Buffer
    avatar_filename?: string
  } = {}): Promise<Record<string, unknown>> {
    const avatar = await uploadImage(input.avatar, input.avatar_filename)
    const response = await adminMutate('adminCreateMember', {
      qq_num: input.qq_num ?? 123456,
      name: input.name ?? 'Member',
      avatar_temp_id: avatar.temp_id,
    })
    if (response.status !== 200) {
      throw new Error(`createMember failed: ${JSON.stringify(response.body)}`)
    }
    return response.body.data
  }

  async function createGallery(input: Partial<GalleryInput> = {}): Promise<Record<string, unknown>> {
    const start = new Date(current_now.getTime() - 60 * 60 * 1000)
    const submission = new Date(current_now.getTime() + 24 * 60 * 60 * 1000)
    const end = new Date(current_now.getTime() + 48 * 60 * 60 * 1000)
    const data = {
      name: input.name ?? 'Gallery',
      index: input.index ?? 0,
      vote_limit: input.vote_limit ?? 3,
      event_start: (input.event_start ?? start).toISOString(),
      submission_expire: (input.submission_expire ?? submission).toISOString(),
      event_end: (input.event_end ?? end).toISOString(),
    }
    const response = await adminMutate('adminCreateGallery', data)
    if (response.status !== 200) {
      throw new Error(`createGallery failed: ${JSON.stringify(response.body)}`)
    }
    return response.body.data
  }

  async function createPhoto(input: {
    gallery_id: number
    member_id: number
    desc?: string
    image?: Buffer
    image_filename?: string
  }): Promise<Record<string, unknown>> {
    const image = await uploadImage(input.image, input.image_filename)
    const response = await adminMutate('adminCreatePhoto', {
      gallery_id: input.gallery_id,
      member_id: input.member_id,
      desc: input.desc ?? 'photo',
      temp_id: image.temp_id,
    })
    if (response.status !== 200) {
      throw new Error(`createPhoto failed: ${JSON.stringify(response.body)}`)
    }
    return response.body.data
  }

  async function submitPhoto(input: {
    gallery_id: number
    qq_num: number
    desc?: string
    image?: Buffer
  }): Promise<Record<string, unknown>> {
    const image = await uploadImage(input.image)
    const response = await mutate('submitPhoto', {
      gallery_id: input.gallery_id,
      qq_num: input.qq_num,
      desc: input.desc ?? 'submission',
      temp_id: image.temp_id,
    })
    if (response.status !== 200) {
      throw new Error(`submitPhoto failed: ${JSON.stringify(response.body)}`)
    }
    return response.body.data
  }

  async function vote(input: {
    gallery_id: number
    qq_num: number
    photo_ids: number[]
  }): Promise<ApiResponse> {
    return mutate('vote', input)
  }

  return {
    app,
    env,
    instance,
    storage,
    dir,
    get now() {
      return current_now
    },
    setNow(value: Date) {
      current_now = value
    },
    login,
    adminPool,
    adminQuery,
    adminMutate,
    query,
    mutate,
    uploadImage,
    createMember,
    createGallery,
    createPhoto,
    submitPhoto,
    vote,
    async close() {
      await instance.close()
      if (remove_dir_on_close) {
        await fs.rm(dir, { recursive: true, force: true })
      }
    },
  }
}
