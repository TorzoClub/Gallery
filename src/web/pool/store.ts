import { useEffect, useSyncExternalStore } from 'react'
import type { ClientMembersEvent, ClientPhotosEvent, ClientPool } from '@shared/client-pool'
import { fetchClientPool } from '../api/client-pool'
import { mergeClientPool, mergeGalleryPhotos, mergePublicMembers } from './merge'
import { connectPublicPoolEvents } from './events'

export type ClientPoolState =
  | { status: 'loading' }
  | { status: 'ready'; pool: ClientPool }
  | { status: 'error'; error: Error }

let state: ClientPoolState = { status: 'loading' }
let load_promise: Promise<void> | null = null
let close_events: (() => void) | null = null
let pending_photos: ClientPhotosEvent | null = null
let pending_members: ClientMembersEvent | null = null
/** 正在暂缓 SSE 的理由；非空时推来的相片 / 成员更新只排进 pending，不立刻上屏 */
const holds = new Map<string, ReturnType<typeof setTimeout>>()
/** 暂缓最长这么久，防止某条路径忘了解除，页面从此收不到实时更新 */
const HOLD_MAX_MS = 20_000
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function setState(next: ClientPoolState): void {
  state = next
  emit()
}

export function subscribeClientPool(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getClientPoolState(): ClientPoolState {
  return state
}

function applyPendingEvents(pool: ClientPool): ClientPool {
  let next = pool
  if (pending_photos !== null) {
    next = mergeGalleryPhotos(next, pending_photos.galleries)
    pending_photos = null
  }
  if (pending_members !== null) {
    next = mergePublicMembers(next, pending_members.members)
    pending_members = null
  }
  return next
}

export function replaceClientPool(pool: ClientPool): void {
  if (state.status === 'ready') {
    const next = applyPendingEvents(mergeClientPool(state.pool, pool))
    if (next !== state.pool) {
      setState({ status: 'ready', pool: next })
    }
    return
  }
  setState({ status: 'ready', pool: applyPendingEvents(pool) })
}

/**
 * 暂缓 SSE 推来的相片 / 成员更新。用于“自己刚投的相片要等‘大感谢’放完才带动画贴上来”：
 * 投稿一成功服务端就会推送，不拦住的话相片会先无动画地出现在瀑布流里。
 * 同一个 key 重复调用只续期；解除后排队的更新随下一次 replaceClientPool 或立即生效。
 */
export function holdPoolEvents(key: string): void {
  const prev = holds.get(key)
  if (prev !== undefined) {
    clearTimeout(prev)
  }
  holds.set(key, setTimeout(() => releasePoolEvents(key), HOLD_MAX_MS))
}

export function releasePoolEvents(key: string): void {
  const timer = holds.get(key)
  if (timer === undefined) {
    return
  }
  clearTimeout(timer)
  holds.delete(key)
  if (holds.size === 0 && state.status === 'ready' && (pending_photos !== null || pending_members !== null)) {
    const next = applyPendingEvents(state.pool)
    if (next !== state.pool) {
      setState({ status: 'ready', pool: next })
    }
  }
}

export function applyGalleryPhotos(update: ClientPhotosEvent): void {
  if (state.status !== 'ready' || holds.size > 0) {
    pending_photos = update
    return
  }
  const next = mergeGalleryPhotos(state.pool, update.galleries)
  if (next !== state.pool) {
    setState({ status: 'ready', pool: next })
  }
}

export function applyPublicMembers(update: ClientMembersEvent): void {
  if (state.status !== 'ready' || holds.size > 0) {
    pending_members = update
    return
  }
  const next = mergePublicMembers(state.pool, update.members)
  if (next !== state.pool) {
    setState({ status: 'ready', pool: next })
  }
}

export async function reloadClientPool(): Promise<void> {
  if (load_promise !== null) {
    return load_promise
  }

  load_promise = fetchClientPool()
    .then(pool => {
      replaceClientPool(pool)
    })
    .catch((error: unknown) => {
      setState({
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      })
    })
    .finally(() => {
      load_promise = null
    })

  return load_promise
}

export function ensureClientPoolEvents(): void {
  if (close_events !== null) {
    return
  }
  close_events = connectPublicPoolEvents({
    onPhotos: applyGalleryPhotos,
    onMembers: applyPublicMembers,
    onOpen() {
      if (state.status !== 'ready' && load_promise === null) {
        void reloadClientPool()
      }
    },
  })
}

export function useClientPool(): ClientPoolState {
  const state = useSyncExternalStore(
    subscribeClientPool,
    getClientPoolState,
    getClientPoolState,
  )

  useEffect(() => {
    ensureClientPoolLoaded()
    ensureClientPoolEvents()
  }, [])

  return state
}

export function ensureClientPoolLoaded(): void {
  if (state.status === 'loading' && load_promise === null) {
    void reloadClientPool()
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    close_events?.()
    close_events = null
  })
}
