import { afterEach, describe, expect, it } from 'vitest'
import { createTestContext, type TestContext } from '../helpers/app'

type TestSseEvent = {
  event: string
  data: string
}

class SseReader {
  private buffer = ''
  private readonly decoder = new TextDecoder()

  private readonly reader: ReadableStreamDefaultReader<Uint8Array>

  constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.reader = reader
  }

  async cancel(): Promise<void> {
    await this.reader.cancel()
  }

  async next(): Promise<TestSseEvent> {
    while (true) {
      const boundary = this.buffer.indexOf('\n\n')
      if (boundary !== -1) {
        const block = this.buffer.slice(0, boundary)
        this.buffer = this.buffer.slice(boundary + 2)
        let event = 'message'
        const data: string[] = []
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) {
            event = line.slice('event:'.length).trim()
          } else if (line.startsWith('data:')) {
            data.push(line.slice('data:'.length).trimStart())
          }
        }
        if (data.length > 0) {
          return { event, data: data.join('\n') }
        }
        continue
      }
      const { done, value } = await this.reader.read()
      if (done) {
        throw new Error('SSE stream closed')
      }
      this.buffer += this.decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    }
  }
}

let ctx: TestContext | null = null

afterEach(async () => {
  await ctx?.close()
  ctx = null
})

describe('SSE pool events', () => {
  it('pushes public photos and members, and admin full pool', async () => {
    ctx = await createTestContext()
    const public_controller = new AbortController()
    const public_response = await ctx.app.request('/events/pool', {
      signal: public_controller.signal,
    })
    expect(public_response.headers.get('content-type')).toContain('text/event-stream')
    expect(public_response.body).not.toBeNull()
    const public_reader = new SseReader(public_response.body!.getReader())

    const initial_photos = await public_reader.next()
    expect(initial_photos.event).toBe('gallery-photos')
    const initial_members = await public_reader.next()
    expect(initial_members.event).toBe('members')
    const public_members = JSON.parse(initial_members.data) as { members: Array<{ qq_num: unknown }> }
    expect(public_members.members.every(member => member.qq_num === null)).toBe(true)

    const token = await ctx.login()
    const admin_controller = new AbortController()
    const admin_response = await ctx.app.request('/admin/events/pool', {
      headers: { Authorization: `Bearer ${token}` },
      signal: admin_controller.signal,
    })
    expect(admin_response.status).toBe(200)
    expect(admin_response.body).not.toBeNull()
    const admin_reader = new SseReader(admin_response.body!.getReader())
    const initial_admin = await admin_reader.next()
    expect(initial_admin.event).toBe('admin-pool')
    const admin_pool = JSON.parse(initial_admin.data) as { galleries: unknown[]; members: unknown[] }
    expect(Array.isArray(admin_pool.galleries)).toBe(true)
    expect(Array.isArray(admin_pool.members)).toBe(true)

    const unauthorized = await ctx.app.request('/admin/events/pool')
    expect(unauthorized.status).toBe(401)

    await ctx.createGallery({ name: 'SSE Gallery' })

    const photos_update = await public_reader.next()
    expect(photos_update.event).toBe('gallery-photos')
    expect(JSON.parse(photos_update.data).galleries).toEqual(
      expect.arrayContaining([expect.objectContaining({ photos: [] })]),
    )

    const admin_update = await admin_reader.next()
    expect(admin_update.event).toBe('admin-pool')
    expect(admin_update.data).toContain('SSE Gallery')

    public_controller.abort()
    admin_controller.abort()
    await public_reader.cancel()
    await admin_reader.cancel()
  })
})
