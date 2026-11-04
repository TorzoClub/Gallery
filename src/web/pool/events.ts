import type { ClientMembersEvent, ClientPhotosEvent } from '@shared/client-pool'
import { API_BASE } from '../api/dispatch'

export function connectPublicPoolEvents(options: {
  onPhotos(update: ClientPhotosEvent): void
  onMembers(update: ClientMembersEvent): void
  onOpen?(): void
}): () => void {
  if (typeof EventSource !== 'function') {
    return () => undefined
  }

  const source = new EventSource(`${API_BASE}events/pool`)

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

  source.addEventListener('open', () => options.onOpen?.())
  source.addEventListener('gallery-photos', (event) => {
    const update = parse<ClientPhotosEvent>(event)
    if (update !== null) {
      options.onPhotos(update)
    }
  })
  source.addEventListener('members', (event) => {
    const update = parse<ClientMembersEvent>(event)
    if (update !== null) {
      options.onMembers(update)
    }
  })

  return () => source.close()
}
