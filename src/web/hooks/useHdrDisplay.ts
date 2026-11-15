import { useSyncExternalStore } from 'react'
import { HDR_DISPLAY_QUERY } from '../utils/browser'

let query: MediaQueryList | null | undefined

function hdrQuery(): MediaQueryList | null {
  if (query !== undefined) {
    return query
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    query = null
    return query
  }
  try {
    query = window.matchMedia(HDR_DISPLAY_QUERY)
  } catch {
    query = null
  }
  return query
}

function subscribe(on_change: () => void): () => void {
  const mq = hdrQuery()
  if (mq === null) {
    return () => {}
  }
  mq.addEventListener('change', on_change)
  return () => mq.removeEventListener('change', on_change)
}

function getSnapshot(): boolean {
  return hdrQuery()?.matches === true
}

function getServerSnapshot(): boolean {
  return false
}

/** 当前屏幕是否声明支持 HDR；不支持、无法检测或 SSR 时保持 SDR */
export default function useHdrDisplay(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
