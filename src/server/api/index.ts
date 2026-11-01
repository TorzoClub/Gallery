import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Handler } from 'hono'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { apiError, isApiError } from '../common/error'
import { mimeTypeOf } from '../common/image-name'
import type { EnvConfig } from '../config'
import type { Instance } from '../instance'
import type { Logger } from '../logger'
import { createAdminAuth } from './admin'
import { createUploadHandler } from './upload'

type Deps = {
  instance: Instance
  env: EnvConfig
  logger: Logger
  clock?: () => Date
  client_dir?: string
}

const API_LIKE_PREFIXES = [
  '/query',
  '/mutate',
  '/admin/query',
  '/admin/mutate',
  '/auth',
  '/upload-image',
  '/images',
  '/healthz',
]

export function isApiLikePath(pathname: string, base_path = '/'): boolean {
  const base = base_path === '/' ? '' : base_path.replace(/\/+$/, '')
  const normalized = base !== '' && (pathname === base || pathname.startsWith(`${base}/`))
    ? pathname.slice(base.length) || '/'
    : pathname

  return API_LIKE_PREFIXES.some((prefix) => (
    normalized === prefix || normalized.startsWith(`${prefix}/`)
  ))
}

function setClientCache(c: Parameters<Handler>[0], pathname: string): void {
  c.header('Vary', 'Accept-Encoding')
  if (pathname === '/' || pathname.endsWith('.html')) {
    c.header('Cache-Control', 'no-cache')
  } else if (pathname.startsWith('/assets/') || /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i.test(pathname)) {
    c.header('Cache-Control', 'public, max-age=31536000, immutable')
  } else {
    c.header('Cache-Control', 'public, max-age=3600')
  }
}

type ContentEncoding = 'br' | 'gzip'

function acceptedEncoding(c: Parameters<Handler>[0]): ContentEncoding | null {
  const header = c.req.header('Accept-Encoding') ?? ''
  const accepted = new Set(header.split(',').map(part => part.trim().toLowerCase()))
  if (accepted.has('br')) {
    return 'br'
  }
  if (accepted.has('gzip')) {
    return 'gzip'
  }
  return null
}

async function serveIndexHtml(
  c: Parameters<Handler>[0],
  index_file: string,
): Promise<Response> {
  const encoding = acceptedEncoding(c)
  if (encoding !== null) {
    try {
      const compressed = await readFile(`${index_file}.${encoding === 'br' ? 'br' : 'gz'}`)
      c.header('Cache-Control', 'no-cache')
      c.header('Vary', 'Accept-Encoding')
      c.header('Content-Type', 'text/html; charset=utf-8')
      c.header('Content-Encoding', encoding)
      c.header('Content-Length', String(compressed.byteLength))
      return c.body(new Uint8Array(compressed), 200)
    } catch {
      // No precompressed index; fall through to the plain HTML response.
    }
  }

  const html = await readFile(index_file, 'utf8')
  c.header('Cache-Control', 'no-cache')
  c.header('Vary', 'Accept-Encoding')
  return c.html(html)
}

async function readPayload(c: Parameters<Handler>[0]): Promise<unknown> {
  const text = await c.req.text()
  if (text.trim() === '') {
    return undefined
  }

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw apiError(400, 'BAD_REQUEST', '请求体不是合法 JSON')
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    Object.prototype.hasOwnProperty.call(body, 'payload')
  ) {
    return (body as { payload: unknown }).payload
  }

  return body
}

function dispatchHandler(
  instance: Instance,
  kind: 'query' | 'mutation',
  admin: boolean,
  clock: () => Date,
): Handler {
  return async (c) => {
    const now = clock()
    const name = c.req.param('name')
    if (name === undefined || name.length === 0) {
      throw apiError(404, 'UNKNOWN_ACTION', '缺少 action 名称')
    }

    const payload = await readPayload(c)
    const options = { admin, now }
    const data = kind === 'query'
      ? await instance.dispatchQuery(name, payload, options)
      : await instance.dispatchMutation(name, payload, options)

    return c.json({
      success: true,
      data,
    })
  }
}

function bodyLimitError(c: Parameters<Handler>[0]) {
  return c.json({
    success: false,
    code: 'BAD_REQUEST',
    message: '请求体过大',
  }, 413)
}

function errorResponse(c: Parameters<Handler>[0], error: unknown) {
  if (isApiError(error)) {
    return c.json({
      success: false,
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    }, error.status as ContentfulStatusCode)
  }

  if (error instanceof HTTPException) {
    return c.json({
      success: false,
      code: 'BAD_REQUEST',
      message: error.message,
    }, error.status as ContentfulStatusCode)
  }

  return c.json({
    success: false,
    code: 'INTERNAL',
    message: '服务器内部错误',
  }, 500)
}

export function constructApi(deps: Deps): Hono {
  const { instance, env, logger } = deps
  const clock = deps.clock ?? (() => new Date())
  const app = new Hono({ strict: false }).basePath(env.api_base_path)

  if (env.cors_origins.length > 0) {
    app.use('*', cors({
      origin: env.cors_origins.includes('*') ? '*' : [...env.cors_origins],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }))
  }

  app.use('*', secureHeaders({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  }))
  app.use('*', async (c, next) => {
    const started = performance.now()
    await next()
    logger.info('http request', {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration_ms: Math.round(performance.now() - started),
    })
  })

  const { login, auth } = createAdminAuth(env, logger)

  app.post('/auth/login', bodyLimit({
    maxSize: 1024 * 1024,
    onError: bodyLimitError,
  }), login)

  app.use('/admin/query/*', auth)
  app.use('/admin/mutate/*', auth)

  const json_limit = bodyLimit({
    maxSize: 1024 * 1024,
    onError: bodyLimitError,
  })

  app.post('/query/:name', json_limit, dispatchHandler(instance, 'query', false, clock))
  app.post('/mutate/:name', json_limit, dispatchHandler(instance, 'mutation', false, clock))
  app.post('/admin/query/:name', json_limit, dispatchHandler(instance, 'query', true, clock))
  app.post('/admin/mutate/:name', json_limit, dispatchHandler(instance, 'mutation', true, clock))

  app.post('/upload-image', bodyLimit({
    maxSize: env.http_body_hard_limit_bytes,
    onError: bodyLimitError,
  }), createUploadHandler(instance))

  app.get('/images/:kind/:file', async (c) => {
    const kind = c.req.param('kind')
    if (kind !== 'source' && kind !== 'optimized' && kind !== 'thumb') {
      throw apiError(404, 'NOT_FOUND', '图片不存在')
    }
    const file = c.req.param('file')
    const buffer = await instance.readImage(kind, file)
    return c.body(new Uint8Array(buffer), 200, {
      'Content-Type': kind === 'source' ? mimeTypeOf(file) : 'image/avif',
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
  })

  app.get('/healthz', (c) => c.json({
    success: true,
    data: {
      status: 'ok',
      scene: env.app_env,
    },
  }))

  if (!deps.client_dir) {
    app.get('/', (c) => c.json({
      success: true,
      data: {
        service: 'torzo-gallery',
        dispatch: {
          query: '/query/:name',
          mutation: '/mutate/:name',
          admin_query: '/admin/query/:name',
          admin_mutation: '/admin/mutate/:name',
          login: '/auth/login',
        },
      },
    }))
  } else {
    const client_dir = deps.client_dir
    const index_file = path.join(client_dir, 'index.html')

    app.use('*', serveStatic({
      root: client_dir,
      precompressed: true,
      onFound: (_file_path, c) => {
        setClientCache(c, c.req.path)
      },
    }))

    app.get('*', async (c) => {
      const pathname = c.req.path
      if (isApiLikePath(pathname, env.api_base_path) || pathname.startsWith('/assets/')) {
        return c.json({
          success: false,
          code: 'NOT_FOUND',
          message: '接口不存在',
        }, 404)
      }

      try {
        return await serveIndexHtml(c, index_file)
      } catch {
        return c.json({
          success: false,
          code: 'INTERNAL',
          message: '前端构建产物不存在',
        }, 500)
      }
    })
  }

  app.notFound((c) => c.json({
    success: false,
    code: 'NOT_FOUND',
    message: '接口不存在',
  }, 404))

  app.onError((error, c) => {
    if (isApiError(error)) {
      if (error.status >= 500) {
        logger.error('api error', {
          code: error.code,
          message: error.message,
          error: error.stack,
        })
      }
    } else {
      logger.error('unhandled api error', {
        error: error instanceof Error ? error.stack : String(error),
      })
    }

    return errorResponse(c, error)
  })

  return app
}
