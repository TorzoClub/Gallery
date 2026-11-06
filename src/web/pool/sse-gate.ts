import type { ClientMembersEvent, ClientPhotosEvent } from '../../shared/client-pool'

export type PublicPoolSseUpdate =
  | { type: 'photos'; update: ClientPhotosEvent }
  | { type: 'members'; update: ClientMembersEvent }

export type PendingPublicPoolSseUpdates = {
  photos: ClientPhotosEvent | null
  members: ClientMembersEvent | null
}

export type PublicPoolSseGate = {
  begin(): () => PendingPublicPoolSseUpdates | null
  buffer(update: PublicPoolSseUpdate): boolean
}

/**
 * 阻塞公开页的 SSE 应用，但不停掉 EventSource。
 * 阻塞期间只保留每个分类最后一份完整快照；最后一个 release 把快照交还给 store。
 */
export function createPublicPoolSseGate(): PublicPoolSseGate {
  let block_count = 0
  let pending_photos: ClientPhotosEvent | null = null
  let pending_members: ClientMembersEvent | null = null

  const take_pending = (): PendingPublicPoolSseUpdates | null => {
    if (pending_photos === null && pending_members === null) {
      return null
    }
    const pending = { photos: pending_photos, members: pending_members }
    pending_photos = null
    pending_members = null
    return pending
  }

  return {
    begin() {
      block_count += 1
      let released = false

      return () => {
        if (released) {
          return null
        }
        released = true
        block_count = Math.max(0, block_count - 1)
        return block_count === 0 ? take_pending() : null
      }
    },

    buffer(update) {
      if (block_count === 0) {
        return false
      }
      if (update.type === 'photos') {
        pending_photos = update.update
      } else {
        pending_members = update.update
      }
      return true
    },
  }
}
