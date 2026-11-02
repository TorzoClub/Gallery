import type { AdminPoolDTO } from '@shared/dto'
import { API_BASE } from '../../api/dispatch'
import { getToken } from '../auth/token'

type SseEvent = {
  event: string
  data: string
}

async function consumeSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (block: string) => {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(':')) {
        continue
      }
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'event') {
        event = value
      } else if (field === 'data') {
        data.push(value)
      }
    }
    if (data.length > 0) {
      onEvent({ event, data: data.join('\n') })
    }
  }

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        dispatch(block)
        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function connectAdminPoolEvents(options: {
  signal: AbortSignal
  onPool(pool: AdminPoolDTO): void
  onUnauthorized(): void
}): Promise<void> {
  let retry_delay = 1000

  while (!options.signal.aborted) {
    const token = getToken()
    if (token === '') {
      return
    }

    try {
      const response = await fetch(`${API_BASE}admin/events/pool`, {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
        signal: options.signal,
      })

      if (response.status === 401 || response.status === 403) {
        options.onUnauthorized()
        return
      }
      if (!response.ok || response.body === null) {
        throw new Error(`SSE HTTP ${response.status}`)
      }

      retry_delay = 1000
      await consumeSse(response.body, options.signal, (event) => {
        if (event.event !== 'admin-pool') {
          return
        }
        try {
          options.onPool(JSON.parse(event.data) as AdminPoolDTO)
        } catch {
          // Ignore malformed events; the next full snapshot will recover.
        }
      })
    } catch {
      if (options.signal.aborted) {
        return
      }
    }

    if (options.signal.aborted) {
      return
    }

    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, retry_delay)
      options.signal.addEventListener('abort', () => {
        window.clearTimeout(timer)
        resolve()
      }, { once: true })
    })
    retry_delay = Math.min(10_000, retry_delay * 2)
  }
}
