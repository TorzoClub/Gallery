import { useEffect, useSyncExternalStore } from 'react'
import type { ClientPool } from '@shared/client-pool'
import { fetchClientPool } from '../api/client-pool'

export type ClientPoolState =
  | { status: 'loading' }
  | { status: 'ready'; pool: ClientPool }
  | { status: 'error'; error: Error }

let state: ClientPoolState = { status: 'loading' }
let load_promise: Promise<void> | null = null
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

export function replaceClientPool(pool: ClientPool): void {
  if (state.status === 'ready' && pool.version_time <= state.pool.version_time) {
    return
  }
  setState({ status: 'ready', pool })
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

export function useClientPool(): ClientPoolState {
  const state = useSyncExternalStore(
    subscribeClientPool,
    getClientPoolState,
    getClientPoolState,
  )

  useEffect(() => {
    ensureClientPoolLoaded()
  }, [])

  return state
}

export function ensureClientPoolLoaded(): void {
  if (state.status === 'loading' && load_promise === null) {
    void reloadClientPool()
  }
}
