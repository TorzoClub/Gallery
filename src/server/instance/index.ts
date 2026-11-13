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
import type { Pool } from '../core/Pool'
import { checkPool } from '../core/Pool-Check'
import type { Logger } from '../logger'
import type { Readable } from 'node:stream'
import {
  type ImageKind,
  type ImageStream,
  type Storage,
} from '../storage'
import {
  __admin_list,
  inner_mutations,
  mutations,
  queries,
  type MutationContext,
  type MutationDef,
  type PreparationContext,
  type QueryContext,
  type QueryDef,
} from './actions'
import { calcInstanceHash } from './instance-hash'
import {
  createImagePipeline,
  type ImagePipeline,
  type TempImage,
} from './prepare-photo'
import { assertHdrTools, hdrToolsAvailable } from '../storage/hdr'
import { assertHeicTools, heicToolsAvailable } from '../storage/heic-hdr'
import {
  buildPoolJsonCache,
  clampTimerDelay,
  nextGalleryBoundary,
  poolInEventKey,
  type PoolEventsSnapshot,
  type PoolJsonCache,
} from './pool-json-cache'

export type DispatchOptions = {
  admin: boolean
  now: Date
}

export type PoolUpdateEvent =
  | { type: 'photos'; json: string }
  | { type: 'members'; json: string }
  | { type: 'admin'; json: string }
  | { type: 'close' }

export type Instance = {
  read(): Pool
  getInstanceConfig(): InstanceConfig
  getInstanceHash(): string
  isAdminAction(name: string): boolean
  dispatchQuery(name: string, payload: unknown, options: DispatchOptions): Promise<unknown>
  dispatchMutation(name: string, payload: unknown, options: DispatchOptions): Promise<unknown>
  storeTempImage(input: {
    stream: Readable
    temp_id: string
    format: string
    crc32: Promise<number>
  }): Promise<TempImage>
  readImageStream(kind: ImageKind, filename: string): Promise<ImageStream>
  getPoolEvents(now: Date): PoolEventsSnapshot
  subscribePoolUpdates(listener: (event: PoolUpdateEvent) => void): () => void
  closePoolStreams(): void
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

function unknownAction(kind: 'query' | 'mutation' | 'inner mutation', name: string): never {
  throw apiError(404, 'UNKNOWN_ACTION', `未知的 ${kind}: ${name}`)
}

async function discardPrepared(value: unknown): Promise<void> {
  if (
    value !== null &&
    typeof value === 'object' &&
    'discard' in value &&
    typeof value.discard === 'function'
  ) {
    await value.discard()
  }
}

export async function createInstance(options: CreateInstanceOptions): Promise<Instance> {
  const { env, storage, logger } = options
  const app_startup_time = Date.now()
  const loaded = await storage.load()
  let pool: Pool = loaded.pool
  let instance_config: InstanceConfig = loaded.instance_config
  let instance_hash = calcInstanceHash(instance_config)

  assertInstanceConfigWithinHardLimit(instance_config, env.http_body_hard_limit_bytes)

  // 磁盘写入和图片处理分别串行；prepare/commit 不进入这里的 persistQueue。
  const persistQueue = Sequence()
  let closing = false
  let closed = false
  let active_operations = 0
  const drain_waiters = new Set<() => void>()

  if (env.app_env === 'production') {
    await assertHdrTools()
    await assertHeicTools()
  } else if (!(await hdrToolsAvailable()) || !(await heicToolsAvailable())) {
    logger.warn('HDR or HEIC HDR tools unavailable; unsupported images will be SDR-only')
  }

  const images: ImagePipeline = createImagePipeline({
    storage,
    getConfig: () => instance_config,
    logger,
  })

  let pool_json_cache: PoolJsonCache | null = null
  let pool_boundary_timer: ReturnType<typeof setTimeout> | null = null
  const pool_listeners = new Set<(event: PoolUpdateEvent) => void>()

  function publishPoolEvent(event: PoolUpdateEvent): void {
    for (const listener of pool_listeners) {
      try {
        listener(event)
      } catch (error) {
        logger.error('pool event listener failed', { error: String(error) })
      }
    }
  }

  function publishPoolCacheChanges(
    before: PoolJsonCache | null,
    after: PoolJsonCache,
  ): void {
    if (before === null || before.photos_json !== after.photos_json) {
      publishPoolEvent({ type: 'photos', json: after.photos_json })
    }
    if (before === null || before.members_json !== after.members_json) {
      publishPoolEvent({ type: 'members', json: after.members_json })
    }
    if (before === null || before.admin_pool_json !== after.admin_pool_json) {
      publishPoolEvent({ type: 'admin', json: after.admin_pool_json })
    }
  }

  function schedulePoolBoundary(): void {
    if (pool_boundary_timer !== null) {
      clearTimeout(pool_boundary_timer)
      pool_boundary_timer = null
    }
    const boundary = nextGalleryBoundary(pool, new Date())
    if (boundary === null) {
      return
    }
    pool_boundary_timer = setTimeout(() => {
      pool_boundary_timer = null
      const before = pool_json_cache
      const after = getPoolJsonCache(new Date())
      publishPoolCacheChanges(before, after)
      schedulePoolBoundary()
    }, clampTimerDelay(boundary - Date.now() + 5))
    pool_boundary_timer.unref?.()
  }

  function getPoolJsonCache(now: Date): PoolJsonCache {
    if (
      pool_json_cache !== null &&
      pool_json_cache.pool === pool &&
      pool_json_cache.instance_config === instance_config &&
      pool_json_cache.instance_hash === instance_hash &&
      pool_json_cache.in_event_key === poolInEventKey(pool, now)
    ) {
      return pool_json_cache
    }

    pool_json_cache = buildPoolJsonCache({
      pool,
      env,
      instance_config,
      instance_hash,
      app_startup_time,
      now,
    })
    schedulePoolBoundary()
    return pool_json_cache
  }

  function ensureOpen(): void {
    if (closing) {
      throw apiError(503, 'INTERNAL', '服务正在关闭')
    }
  }

  function beginOperation(): void {
    ensureOpen()
    active_operations += 1
  }

  function endOperation(): void {
    active_operations -= 1
    if (active_operations === 0) {
      for (const resolve of drain_waiters) {
        resolve()
      }
      drain_waiters.clear()
    }
  }

  async function waitForOperations(): Promise<void> {
    if (active_operations === 0) {
      return
    }
    await new Promise<void>((resolve) => {
      drain_waiters.add(resolve)
    })
  }

  function mutationContext(now: Date): MutationContext {
    return {
      pool,
      env,
      config: instance_config,
      instance_hash,
      app_startup_time,
      now,
    }
  }

  function preparationContext(now: Date): PreparationContext {
    return {
      pool,
      env,
      config: instance_config,
      instance_hash,
      app_startup_time,
      now,
      preparePhoto: images.preparePhoto,
      prepareAvatar: images.prepareAvatar,
      refreshThumb: images.refreshThumb,
      refreshAvatar: images.refreshAvatar,
      innerMutate: (name, payload) => dispatchInnerMutation(name, payload, now),
    }
  }

  function queryContext(now: Date): QueryContext {
    return mutationContext(now)
  }

  function logMutationFailure(name: string, error: unknown, stage: string): never {
    if (isApiError(error)) {
      throw error
    }
    logger.error(`${stage} failed`, { name, error: String(error) })
    throw apiError(500, 'INTERNAL', '服务器内部错误')
  }

  async function executeMutation<I, O, P>(
    name: string,
    definition: MutationDef<I, O, P>,
    payload: I,
    now: Date,
  ): Promise<O> {
    let prepared: P | undefined

    if (definition.prepare !== undefined) {
      try {
        prepared = await definition.prepare(preparationContext(now), payload)
      } catch (error) {
        logMutationFailure(name, error, 'mutation preparation')
      }
    }

    try {
      ensureOpen()
    } catch (error) {
      await discardPrepared(prepared)
      throw error
    }

    const prev_pool = pool
    const prev_config = instance_config
    let outcome

    try {
      outcome = definition.commit(mutationContext(now), payload, prepared as P)
      if (outcome.instance_config !== undefined) {
        assertInstanceConfigWithinHardLimit(
          outcome.instance_config,
          env.http_body_hard_limit_bytes,
        )
      }
      checkPool(outcome.pool)
    } catch (error) {
      await discardPrepared(prepared)
      logMutationFailure(name, error, 'mutation commit')
    }

    const next_pool = outcome.pool
    const next_config = outcome.instance_config
    const pool_changed = next_pool !== prev_pool
    const config_changed = next_config !== undefined && next_config !== prev_config

    // 内存状态同步更新。这里是纯 JS 单线程原子区，之后才进入持久化。
    if (pool_changed) {
      pool = next_pool
    }
    if (config_changed) {
      instance_config = next_config
      instance_hash = calcInstanceHash(instance_config)
    }

    if (pool_changed || config_changed) {
      try {
        await persistQueue(async () => {
          if (config_changed) {
            await storage.storeInstanceConfig(next_config)
          }
          if (pool_changed) {
            await storage.storeByDiff(next_pool, prev_pool)
          }
          if (pool_changed) {
            try {
              await images.collectGarbage(prev_pool, next_pool)
            } catch (error) {
              logger.error('image garbage collection failed', {
                error: String(error),
              })
            }
          }
        })
      } catch (error) {
        logger.error('mutation persistence failed', { error: String(error) })
        throw apiError(500, 'INTERNAL', '保存数据失败')
      }
    }

    return outcome.result
  }

  async function dispatchInnerMutation(
    name: string,
    payload: unknown,
    now: Date,
  ): Promise<unknown> {
    ensureOpen()
    if (!Object.prototype.hasOwnProperty.call(inner_mutations, name)) {
      return unknownAction('inner mutation', name)
    }

    const definition = inner_mutations[name as keyof typeof inner_mutations] as MutationDef<unknown, unknown, unknown>
    const parsed = definition.schema.safeParse(payload ?? {})
    if (!parsed.success) {
      validationError(parsed.error)
    }

    return executeMutation(name, definition, parsed.data, now)
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

    const definition = mutations[name as keyof typeof mutations] as MutationDef<unknown, unknown, unknown>
    if (!dispatch_options.admin && definition.admin) {
      throw apiError(403, 'ADMIN_ONLY', '该 mutation 只能通过 /admin/mutate 调用')
    }

    const parsed = definition.schema.safeParse(payload ?? {})
    if (!parsed.success) {
      validationError(parsed.error)
    }

    beginOperation()
    try {
      const before = getPoolJsonCache(dispatch_options.now)
      const result = await executeMutation(name, definition, parsed.data, dispatch_options.now)
      const after = getPoolJsonCache(dispatch_options.now)
      publishPoolCacheChanges(before, after)
      return result
    } finally {
      endOperation()
    }
  }

  async function storeTempImage(input: {
    stream: Readable
    temp_id: string
    format: string
    crc32: Promise<number>
  }): Promise<TempImage> {
    ensureOpen()
    return images.storeTempImage(input)
  }

  function closePoolStreams(): void {
    if (pool_boundary_timer !== null) {
      clearTimeout(pool_boundary_timer)
      pool_boundary_timer = null
    }
    publishPoolEvent({ type: 'close' })
    pool_listeners.clear()
  }

  async function close(): Promise<void> {
    if (closed) {
      return
    }
    closing = true
    closePoolStreams()
    await waitForOperations()
    await persistQueue(async () => {})
    try {
      await images.close()
    } finally {
      await storage.close()
    }
    closed = true
  }

  return {
    read: () => pool,
    getPoolEvents: (now) => {
      const cache = getPoolJsonCache(now)
      return {
        photos_json: cache.photos_json,
        members_json: cache.members_json,
        admin_json: cache.admin_pool_json,
      }
    },
    subscribePoolUpdates: (listener) => {
      pool_listeners.add(listener)
      return () => pool_listeners.delete(listener)
    },
    closePoolStreams,
    getInstanceConfig: () => instance_config,
    getInstanceHash: () => instance_hash,
    isAdminAction: (name) => __admin_list.includes(name),
    dispatchQuery,
    dispatchMutation,
    storeTempImage,
    readImageStream: storage.readImageStream,
    close,
  }
}
