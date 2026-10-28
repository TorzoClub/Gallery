import fs from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createTestContext,
  makePng,
  type TestContext,
} from '../helpers/app'

let ctx: TestContext
const base_now = new Date('2026-06-01T00:00:00.000Z')

beforeEach(async () => {
  ctx = await createTestContext({ now: base_now })
})

afterEach(async () => {
  await ctx.close()
})

describe('mutation concurrency', () => {
  it('keeps inner mutations out of the HTTP action surface', async () => {
    const public_response = await ctx.mutate('allocateId', {})
    expect(public_response.status).toBe(404)

    const admin_response = await ctx.adminMutate('allocateId', {})
    expect(admin_response.status).toBe(404)
  })

  it('allocates distinct persisted ids for concurrent photo creates', async () => {
    const author_a = await ctx.createMember({ qq_num: 50001, name: 'A' })
    const author_b = await ctx.createMember({ qq_num: 50002, name: 'B' })
    const gallery = await ctx.createGallery()

    const before = Number(ctx.instance.read().next_id)
    const temp_a = await ctx.uploadImage(await makePng(180, 120, { r: 200, g: 100, b: 80 }))
    const temp_b = await ctx.uploadImage(await makePng(180, 120, { r: 80, g: 160, b: 220 }))

    const [response_a, response_b] = await Promise.all([
      ctx.adminMutate('adminCreatePhoto', {
        gallery_id: gallery.id,
        member_id: author_a.id,
        desc: 'concurrent A',
        temp_id: temp_a.temp_id,
      }),
      ctx.adminMutate('adminCreatePhoto', {
        gallery_id: gallery.id,
        member_id: author_b.id,
        desc: 'concurrent B',
        temp_id: temp_b.temp_id,
      }),
    ])

    expect(response_a.status).toBe(200)
    expect(response_b.status).toBe(200)
    expect(response_a.body.data.id).not.toBe(response_b.body.data.id)
    expect(Number(ctx.instance.read().next_id)).toBe(before + 2)

    const photos = await ctx.adminQuery('adminListPhotos')
    expect(photos.status).toBe(200)
    expect(photos.body.data.map((photo: { id: number }) => photo.id).sort())
      .toEqual([response_a.body.data.id, response_b.body.data.id].sort())

    const pool_raw = JSON.parse(await fs.readFile(ctx.storage.paths.pool_file, 'utf8'))
    expect(Number(pool_raw.next_id)).toBe(Number(ctx.instance.read().next_id))
  })

  it('persists the allocated id even when the later commit conflicts', async () => {
    await ctx.createMember({ qq_num: 50011, name: 'Author' })
    const gallery = await ctx.createGallery()
    const before = Number(ctx.instance.read().next_id)

    const temp_a = await ctx.uploadImage(await makePng(180, 120, { r: 180, g: 90, b: 70 }))
    const temp_b = await ctx.uploadImage(await makePng(180, 120, { r: 70, g: 150, b: 210 }))

    const [response_a, response_b] = await Promise.all([
      ctx.mutate('submitPhoto', {
        gallery_id: gallery.id,
        qq_num: 50011,
        desc: 'first',
        temp_id: temp_a.temp_id,
      }),
      ctx.mutate('submitPhoto', {
        gallery_id: gallery.id,
        qq_num: 50011,
        desc: 'second',
        temp_id: temp_b.temp_id,
      }),
    ])

    const statuses = [response_a.status, response_b.status].sort()
    expect(statuses).toEqual([200, 409])
    expect(Number(ctx.instance.read().next_id)).toBe(before + 2)

    const gallery_response = await ctx.query('getGallery', { gallery_id: gallery.id })
    expect(gallery_response.status).toBe(200)
    expect(gallery_response.body.data.photos).toHaveLength(1)

    const pool_raw = JSON.parse(await fs.readFile(ctx.storage.paths.pool_file, 'utf8'))
    expect(Number(pool_raw.next_id)).toBe(Number(ctx.instance.read().next_id))
  })
})
