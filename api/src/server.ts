import type { Server } from 'node:http'
import { serve, type ServerType } from '@hono/node-server'
import { constructApi } from './api'
import { type EnvConfig } from './config'
import { createInstance, type Instance } from './instance'
import type { Logger } from './logger'
import { createStorage } from './storage'

export type StartedServer = {
  server: ServerType
  instance: Instance
  close(): Promise<void>
}

export async function startServer(options: {
  env: EnvConfig
  logger: Logger
}): Promise<StartedServer> {
  const { env, logger } = options

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

  const app = constructApi({ instance, env, logger })
  let server: ServerType
  try {
    server = serve({
      fetch: app.fetch,
      port: env.http_port,
      hostname: env.http_host,
    }, (info) => {
      logger.info('api server listening', {
        host: info.address,
        port: info.port,
        scene: env.app_env,
        base_path: env.api_base_path,
      })
    })
  } catch (error) {
    await instance.close()
    throw error
  }

  let closed = false
  async function close(): Promise<void> {
    if (closed) {
      return
    }
    closed = true

    const force_timer = setTimeout(() => {
      try {
        ;(server as Server).closeAllConnections()
      } catch {
        // HTTP/2 or adapter without this method.
      }
    }, 5000)
    force_timer.unref()

    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
    clearTimeout(force_timer)
    await instance.close()
  }

  return { server, instance, close }
}
