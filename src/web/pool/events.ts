import type { ClientMembersEvent, ClientPhotosEvent } from '@shared/client-pool'
import { API_BASE } from '../api/dispatch'

export function connectPublicPoolEvents(options: {
  onPhotos(update: ClientPhotosEvent): void
  onMembers(update: ClientMembersEvent): void
  onOpen?(): void
}): () => void {
  if (typeof EventSource !== 'function' || typeof document === 'undefined') {
    return () => undefined
  }

  let source: EventSource | null = null

  const open = () => {
    if (document.visibilityState === 'hidden' || source !== null) {
      return
    }

    const next = new EventSource(`${API_BASE}events/pool`)
    source = next

    const parse = <T>(event: Event): T | null => {
      if (!(event instanceof MessageEvent)) {
        return null
      }
      try {
        return JSON.parse(event.data) as T
      } catch {
        return null
      }
    }

    next.addEventListener('open', () => options.onOpen?.())
    next.addEventListener('gallery-photos', (event) => {
      const update = parse<ClientPhotosEvent>(event)
      if (update !== null) {
        options.onPhotos(update)
      }
    })
    next.addEventListener('members', (event) => {
      const update = parse<ClientMembersEvent>(event)
      if (update !== null) {
        options.onMembers(update)
      }
    })
  }

  const close = () => {
    source?.close()
    source = null
  }

  const on_visibility_change = () => {
    if (document.visibilityState === 'hidden') {
      // 浏览器对同一个 origin 的 HTTP/1.1 并发连接有上限。后台标签页
      // 不需要留着一条永远不会结束的 SSE 连接，回前台时再连一次即可。
      close()
    } else {
      open()
    }
  }

  document.addEventListener('visibilitychange', on_visibility_change)
  open()

  return () => {
    document.removeEventListener('visibilitychange', on_visibility_change)
    close()
  }
}
