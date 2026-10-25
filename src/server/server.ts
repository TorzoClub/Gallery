import fs from 'node:fs'
import path from 'node:path'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import type { ViteDevServer } from 'vite'
import { constructApi, isApiLikePath } from './api'
import { type EnvConfig } from './config'
import { createInstance, type Instance } from './instance'
import type { Logger } from './logger'
import { createStorage } from './storage'

export type StartedServer = {
  server: Server
  instance: Instance
  close(): Promise<void>
}

function sendInternalError(
  response: ServerResponse,
  logger: Logger,
  error: unknown,
): void {
  logger.error('request handling failed', {
    error: error instanceof Error ? error.stack : String(error),
  })
  if (response.headersSent) {
    response.destroy()
    return
  }
  response.statusCode = 500
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end('Internal Server Error')
}

export async function startServer(options: {
  env: EnvConfig
  logger: Logger
}): Promise<StartedServer> {
  const { env, logger } = options

  if (env.api_base_path !== '/') {
    throw new Error('单体 SPA 服务要求 API_BASE_PATH=/')
  }

  const storage = await createStorage({
    storage_path: env.storage_path,
    allow_empty_data: env.app_env !== 'production' || env.allow_empty_data,
    logger,
  })

  let instance: Instance
  try {
    instance = await createInstance({ env, storage, logger })
  } catch (error) {
    await storage.close()
    throw error
  }

  const client_dir = path.resolve(process.cwd(), 'dist/client')
  const has_client = fs.existsSync(path.join(client_dir, 'index.html'))
  if (env.app_env === 'production' && !has_client) {
    await instance.close()
    throw new Error(`前端构建产物不存在: ${client_dir}/index.html，请先运行 pnpm build`)
  }

  const app = constructApi({
    instance,
    env,
    logger,
    client_dir: has_client ? client_dir : undefined,
  })
  const api_listener = getRequestListener(app.fetch, { autoCleanupIncoming: true })

  const http_server = createServer()
  let vite: ViteDevServer | undefined

  try {
    if (env.app_env === 'development') {
      const { createServer: createViteServer } = await import('vite')
      vite = await createViteServer({
        appType: 'spa',
        server: {
          middlewareMode: { server: http_server },
          hmr: { server: http_server },
          ws: { server: http_server },
        },
      })
      logger.info('vite middleware attached')
    }
  } catch (error) {
    await instance.close()
    throw error
  }

  http_server.on('request', (request: IncomingMessage, response: ServerResponse) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname

      if (isApiLikePath(pathname, env.api_base_path)) {
        void Promise.resolve(api_listener(request, response)).catch((error) => {
          sendInternalError(response, logger, error)
        })
        return
      }

      if (vite !== undefined) {
        vite.middlewares(request, response, (error: unknown) => {
          if (error !== undefined && error !== null) {
            sendInternalError(response, logger, error)
            return
          }
          if (!response.headersSent) {
            response.statusCode = 404
            response.end('Not Found')
          }
        })
        return
      }

      void Promise.resolve(api_listener(request, response)).catch((error) => {
        sendInternalError(response, logger, error)
      })
    } catch (error) {
      sendInternalError(response, logger, error)
    }
  })

  try {
    await new Promise<void>((resolve, reject) => {
      const on_error = (error: Error) => {
        http_server.off('listening', on_listening)
        reject(error)
      }
      const on_listening = () => {
        http_server.off('error', on_error)
        resolve()
      }
      http_server.once('error', on_error)
      http_server.once('listening', on_listening)
      http_server.listen({
        port: env.http_port,
        hostname: env.hostname,
      })
    })
  } catch (error) {
    if (vite !== undefined) {
      await vite.close()
    }
    await instance.close()
    throw error
  }

  const address = http_server.address()
  logger.info('api server listening', {
    host: typeof address === 'object' && address !== null ? address.address : env.hostname,
    port: typeof address === 'object' && address !== null ? address.port : env.http_port,
    scene: env.app_env,
    base_path: env.api_base_path,
    vite: vite !== undefined,
  })

  let closed = false
  async function close(): Promise<void> {
    if (closed) {
      return
    }
    closed = true

    try {
      if (vite !== undefined) {
        await vite.close()
        vite = undefined
      }
    } finally {
      const force_timer = setTimeout(() => {
        try {
          http_server.closeAllConnections()
        } catch {
          // HTTP/2 or adapter without this method.
        }
      }, 5000)
      force_timer.unref()

      await new Promise<void>((resolve) => {
        http_server.close(() => resolve())
      })
      clearTimeout(force_timer)
      await instance.close()
    }
  }

  return { server: http_server, instance, close }
}
