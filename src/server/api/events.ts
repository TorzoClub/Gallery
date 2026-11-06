import type { Context, Handler } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { Instance, PoolUpdateEvent } from '../instance'

type SseWriter = {
  send(event: string, data: string, retry?: number): void
}

function createSseSession(
  c: Context,
  instance: Instance,
  initialEvents: Array<{ event: string; data: string; retry?: number }>,
  accepts: (event: PoolUpdateEvent) => { event: string; data: string } | null,
): Response {
  c.header('Cache-Control', 'no-cache, no-transform')
  c.header('X-Accel-Buffering', 'no')
  c.header('Connection', 'keep-alive')

  return streamSSE(c, async (stream) => {
    let closed = false
    let unsubscribe: (() => void) | null = null
    let heartbeat: ReturnType<typeof setInterval> | null = null
    let finish: () => void = () => {}
    const done = new Promise<void>((resolve) => {
      finish = () => {
        if (closed) {
          return
        }
        closed = true
        unsubscribe?.()
        if (heartbeat !== null) {
          clearInterval(heartbeat)
          heartbeat = null
        }
        resolve()
      }
    })

    const writer: SseWriter = {
      send(event, data, retry) {
        if (closed) {
          return
        }
        queue = queue
          .then(() => {
            if (closed) {
              return
            }
            return stream.writeSSE({ event, data, retry })
          })
          .catch(() => finish())
      },
    }
    let queue: Promise<void> = Promise.resolve()

    unsubscribe = instance.subscribePoolUpdates((update) => {
      if (closed) {
        return
      }
      if (update.type === 'close') {
        finish()
        return
      }
      const message = accepts(update)
      if (message !== null) {
        writer.send(message.event, message.data)
      }
    })

    stream.onAbort(finish)

    for (const initial of initialEvents) {
      writer.send(initial.event, initial.data, initial.retry)
    }

    heartbeat = setInterval(() => {
      writer.send('ping', '1')
    }, 15_000)

    await done
  })
}

export function createPublicPoolEventsHandler(
  instance: Instance,
  clock: () => Date,
): Handler {
  return c => {
    const initial = instance.getPoolEvents(clock())
    return createSseSession(c, instance, [
      { event: 'gallery-photos', data: initial.photos_json, retry: 3000 },
      { event: 'members', data: initial.members_json },
    ], (update) => {
      if (update.type === 'photos') {
        return { event: 'gallery-photos', data: update.json }
      }
      if (update.type === 'members') {
        return { event: 'members', data: update.json }
      }
      return null
    })
  }
}

export function createAdminPoolEventsHandler(
  instance: Instance,
  clock: () => Date,
): Handler {
  return c => {
    const initial = instance.getPoolEvents(clock())
    return createSseSession(c, instance, [
      { event: 'admin-pool', data: initial.admin_json, retry: 3000 },
    ], (update) => {
      if (update.type === 'admin') {
        return { event: 'admin-pool', data: update.json }
      }
      return null
    })
  }
}
