import * as z from 'zod'
import { Sequence } from 'vait'
import {
  apiError,
  isApiError,
} from '../common/error'
import {
  assertInstanceConfigWithinHardLimit,
  type InstanceConfig,
} from '../config/instance'
import { type EnvConfig } from '../config'
import { type Pool } from '../core/Pool'
import type { Logger } from '../logger'
import {
  type ImageKind,
  type Storage,
} from '../storage'
import {
  __admin_list,
  mutations,
  queries,
  type MutationContext,
  type MutationDef,
  type QueryContext,
  type QueryDef,
} from './actions'
import {
  createImagePipeline,
  type ImagePipeline,
  type TempImage,
} from './prepare-photo'

export type DispatchOptions = {
  admin: boolean
  now: Date
}

export type Instance = {
  read(): Pool
  getInstanceConfig(): InstanceConfig
  isAdminAction(name: string): boolean
  dispatchQuery(name: string, payload: unknown, options: DispatchOptions): Promise<unknown>
  dispatchMutation(name: string, payload: unknown, options: DispatchOptions): Promise<unknown>
  storeTempImage(input: { buffer: Buffer; original_name: string }): Promise<TempImage>
  readImage(kind: ImageKind, filename: string): Promise<Buffer>
  close(): Promise<void>
}

export type CreateInstanceOptions = {
  env: EnvConfig
  storage: Storage
  logger: Logger
}

function validationError(error: z.ZodError): never {
  throw apiError(400, 'INVALID_PAYLOAD', '参数错误', error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  })))
}

function unknownAction(kind: 'query' | 'mutation', name: string): never {
  throw apiError(404, 'UNKNOWN_ACTION', `未知的 ${kind}: ${name}`)
}

export async function createInstance(options: CreateInstanceOptions): Promise<Instance> {
  const { env, storage, logger } = options
  const loaded = await storage.load()
  let pool: Pool = loaded.pool
  let instance_config: InstanceConfig = loaded.instance_config

  assertInstanceConfigWithinHardLimit(instance_config, env.http_body_hard_limit_bytes)

  const sequence = Sequence()
  let closing = false
  let closed = false

  const images: ImagePipeline = createImagePipeline({
    storage,
    getConfig: () => instance_config,
  })

  function ensureOpen(): void {
    if (closing) {
      throw apiError(503, 'INTERNAL', '服务正在关闭')
    }
  }

  function mutationContext(now: Date): MutationContext {
    return {
      pool,
      env,
      config: instance_config,
      now,
      preparePhoto: images.preparePhoto,
      prepareAvatar: images.prepareAvatar,
      refreshThumb: images.refreshThumb,
      refreshAvatar: images.refreshAvatar,
      cleanUnusedImages: images.cleanUnusedImages,
      removeImage: storage.removeImage,
    }
  }

  function queryContext(now: Date): QueryContext {
    return {
      pool,
      env,
      config: instance_config,
      now,
    }
  }

  async function dispatchQuery(
    name: string,
    payload: unknown,
    dispatch_options: DispatchOptions,
  ): Promise<unknown> {
    ensureOpen()
    if (!Object.prototype.hasOwnProperty.call(queries, name)) {
      return unknownAction('query', name)
    }

    const definition = queries[name as keyof typeof queries] as QueryDef<unknown, unknown>
    if (!dispatch_options.admin && definition.admin) {
      throw apiError(403, 'ADMIN_ONLY', '该 query 只能通过 /admin/query 调用')
    }

    const parsed = definition.schema.safeParse(payload ?? {})
    if (!parsed.success) {
      validationError(parsed.error)
    }

    try {
      return definition.run(queryContext(dispatch_options.now), parsed.data)
    } catch (error) {
      if (isApiError(error)) {
        throw error
      }
      logger.error('query failed', { name, error: String(error) })
      throw apiError(500, 'INTERNAL', '服务器内部错误')
    }
  }

  async function dispatchMutation(
    name: string,
    payload: unknown,
    dispatch_options: DispatchOptions,
  ): Promise<unknown> {
    ensureOpen()
    if (!Object.prototype.hasOwnProperty.call(mutations, name)) {
      return unknownAction('mutation', name)
    }

    const definition = mutations[name as keyof typeof mutations] as MutationDef<unknown, unknown>
    if (!dispatch_options.admin && definition.admin) {
      throw apiError(403, 'ADMIN_ONLY', '该 mutation 只能通过 /admin/mutate 调用')
    }

    const parsed = definition.schema.safeParse(payload ?? {})
    if (!parsed.success) {
      validationError(parsed.error)
    }

    return sequence(async () => {
      ensureOpen()

      const prev_pool = pool
      const ctx = mutationContext(dispatch_options.now)

      let outcome
      try {
        outcome = await definition.run(ctx, parsed.data)
      } catch (error) {
        if (isApiError(error)) {
          throw error
        }
        logger.error('mutation failed', { name, error: String(error) })
        throw apiError(500, 'INTERNAL', '服务器内部错误')
      }

      try {
        if (outcome.instance_config !== undefined) {
          assertInstanceConfigWithinHardLimit(
            outcome.instance_config,
            env.http_body_hard_limit_bytes,
          )
          await storage.storeInstanceConfig(outcome.instance_config)
        }

        if (outcome.pool !== prev_pool) {
          await storage.storeByDiff(outcome.pool, prev_pool)
        }
      } catch (error) {
        logger.error('mutation persistence failed', { name, error: String(error) })
        throw apiError(500, 'INTERNAL', '保存数据失败')
      }

      if (outcome.instance_config !== undefined) {
        instance_config = outcome.instance_config
      }
      if (outcome.pool !== prev_pool) {
        pool = outcome.pool
      }

      try {
        await images.collectGarbage(prev_pool, outcome.pool)
      } catch (error) {
        logger.error('image garbage collection failed', {
          name,
          error: String(error),
        })
      }

      return outcome.result
    })
  }

  async function storeTempImage(input: {
    buffer: Buffer
    original_name: string
  }): Promise<TempImage> {
    ensureOpen()
    return images.storeTempImage({
      buffer: input.buffer,
      original_name: input.original_name,
      max_upload_bytes: instance_config.max_upload_bytes,
    })
  }

  async function close(): Promise<void> {
    if (closed) {
      return
    }
    closing = true
    await sequence(async () => undefined)
    await storage.close()
    closed = true
  }

  return {
    read: () => pool,
    getInstanceConfig: () => instance_config,
    isAdminAction: (name) => __admin_list.includes(name),
    dispatchQuery,
    dispatchMutation,
    storeTempImage,
    readImage: storage.readImage,
    close,
  }
}
