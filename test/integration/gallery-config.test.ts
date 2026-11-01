import fs from 'node:fs/promises'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createTestContext,
  makePng,
  type TestContext,
} from '../helpers/app'

let ctx: TestContext

beforeEach(async () => {
  ctx = await createTestContext()
})

afterEach(async () => {
  await ctx.close()
})

describe('gallery actions', () => {
  it('creates, lists, updates and reads galleries', async () => {
    const gallery = await ctx.createGallery({ name: 'First', index: 2 })
    expect(gallery.name).toBe('First')
    expect(gallery.index).toBe(2)

    const pool = await ctx.adminPool()
    expect(pool.galleries).toHaveLength(1)
    expect(pool.galleries[0]?.id).toBe(gallery.id)

    const updated = await ctx.adminMutate('adminUpdateGallery', {
      gallery_id: gallery.id,
      name: 'Updated',
      vote_limit: 5,
    })
    expect(updated.status).toBe(200)
    expect(updated.body.data.name).toBe('Updated')
    expect(updated.body.data.vote_limit).toBe(5)

    const updated_pool = await ctx.adminPool()
    expect(updated_pool.galleries.find(item => item.id === gallery.id)?.name).toBe('Updated')
  })

  it('rejects gallery names longer than 256 characters', async () => {
    const response = await ctx.adminMutate('adminCreateGallery', {
      name: 'x'.repeat(257),
      index: 0,
      vote_limit: 0,
      event_start: new Date(ctx.now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      submission_expire: new Date(ctx.now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      event_end: new Date(ctx.now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
    })
    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_PAYLOAD')
  })

  it('rejects invalid event date order', async () => {
    const response = await ctx.adminMutate('adminCreateGallery', {
      name: 'Bad',
      index: 0,
      vote_limit: 0,
      event_start: '2026-06-02T00:00:00.000Z',
      submission_expire: '2026-06-01T00:00:00.000Z',
      event_end: '2026-06-03T00:00:00.000Z',
    })
    expect(response.status).toBe(400)
    expect(response.body.code).toBe('BAD_REQUEST')
  })

  it('rejects invalid payloads with Zod details', async () => {
    const response = await ctx.adminMutate('adminCreateGallery', {
      name: '',
      index: -1,
      vote_limit: -2,
      event_start: 'not-a-date',
      submission_expire: 'not-a-date',
      event_end: 'not-a-date',
    })
    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_PAYLOAD')
    expect(Array.isArray(response.body.details)).toBe(true)
  })

  it('rejects creating a gallery whose event period overlaps another gallery', async () => {
    const active = await ctx.createGallery({ name: 'Active' })
    const rejected = await ctx.adminMutate('adminCreateGallery', {
      name: 'Overlapping',
      index: 1,
      vote_limit: 3,
      event_start: new Date(ctx.now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      submission_expire: new Date(ctx.now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      event_end: new Date(ctx.now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
    })
    expect(rejected.status).toBe(409)
    expect(rejected.body.code).toBe('CONFLICT')
    expect(rejected.body.message).toBe('相册的活动期间不能有重合')

    ctx.setNow(new Date(ctx.now.getTime() + 3 * 24 * 60 * 60 * 1000))
    const next = await ctx.createGallery({ name: 'Next' })
    expect(next.name).toBe('Next')
    expect(next.id).not.toBe(active.id)
  })

  it('rejects creating a second gallery that is active at the same time', async () => {
    await ctx.createGallery({ name: 'Active' })
    const rejected = await ctx.adminMutate('adminCreateGallery', {
      name: 'Also active',
      index: 1,
      vote_limit: 3,
      event_start: new Date(ctx.now.getTime() - 60 * 60 * 1000).toISOString(),
      submission_expire: new Date(ctx.now.getTime() + 60 * 60 * 1000).toISOString(),
      event_end: new Date(ctx.now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    })
    expect(rejected.status).toBe(409)
    expect(rejected.body.code).toBe('CONFLICT')
    expect(rejected.body.message).toBe('相册的活动期间不能有重合')
  })

  it('allows a non-overlapping future gallery while the current gallery is active', async () => {
    await ctx.createGallery({ name: 'Active' })
    const next = await ctx.adminMutate('adminCreateGallery', {
      name: 'Future',
      index: 1,
      vote_limit: 3,
      event_start: new Date(ctx.now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      submission_expire: new Date(ctx.now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      event_end: new Date(ctx.now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    expect(next.status).toBe(200)
    expect(next.body.data.name).toBe('Future')
  })

  it('rejects updating a gallery into the event period of another gallery', async () => {
    await ctx.createGallery({ name: 'Active' })
    const future = await ctx.adminMutate('adminCreateGallery', {
      name: 'Future',
      index: 1,
      vote_limit: 3,
      event_start: new Date(ctx.now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      submission_expire: new Date(ctx.now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      event_end: new Date(ctx.now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    expect(future.status).toBe(200)

    const rejected = await ctx.adminMutate('adminUpdateGallery', {
      gallery_id: future.body.data.id,
      event_start: new Date(ctx.now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      submission_expire: new Date(ctx.now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      event_end: new Date(ctx.now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
    })
    expect(rejected.status).toBe(409)
    expect(rejected.body.code).toBe('CONFLICT')
    expect(rejected.body.message).toBe('相册的活动期间不能有重合')

    const unchanged = (await ctx.adminPool()).galleries
      .find(item => item.id === future.body.data.id)
    expect(unchanged?.event_start).toBe(future.body.data.event_start)
  })

  it('rejects removing a gallery that still has photos, then removes it after the last photo', async () => {
    const member = await ctx.createMember({ qq_num: 30010 })
    const gallery = await ctx.createGallery({ name: 'Do not delete' })
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
    })

    const blocked = await ctx.adminMutate('adminRemoveGallery', { gallery_id: gallery.id })
    expect(blocked.status).toBe(409)
    expect(blocked.body.code).toBe('CONFLICT')
    expect(blocked.body.message).toContain('还有 1 张相片')

    const pool_after = await ctx.adminPool()
    expect(pool_after.galleries.find(item => item.id === gallery.id)).toBeDefined()
    expect(pool_after.galleries.flatMap(item => item.photos).find(item => item.id === photo.id)).toBeDefined()

    const photo_removed = await ctx.adminMutate('adminRemovePhoto', { photo_id: photo.id })
    expect(photo_removed.status).toBe(200)

    const removed = await ctx.adminMutate('adminRemoveGallery', { gallery_id: gallery.id })
    expect(removed.status).toBe(200)

    const gone = (await ctx.adminPool()).galleries
      .find(item => item.id === gallery.id)
    expect(gone).toBeUndefined()
  })

  it('rejects removing a gallery id that does not exist', async () => {
    const response = await ctx.adminMutate('adminRemoveGallery', { gallery_id: 999 })
    expect(response.status).toBe(404)
    expect(response.body.code).toBe('NOT_FOUND')
  })
})

function thumbFilename(url: string): string {
  return decodeURIComponent(new URL(url).pathname.split('/').pop() as string)
}

describe('instance configuration', () => {
  it('updates runtime config and persists it in storage', async () => {
    const response = await ctx.adminMutate('adminUpdateInstanceConfig', {
      image_thumb_size: 300,
      image_thumb_quality: 50,
      avatar_thumb_size: 64,
    })
    expect(response.status).toBe(200)
    expect(response.body.data.image_thumb_size).toBe(300)
    expect(response.body.data.avatar_thumb_size).toBe(64)

    const file = JSON.parse(await fs.readFile(
      ctx.storage.paths.instance_config_file,
      'utf8',
    ))
    expect(file.image_thumb_size).toBe(300)
    expect(file.avatar_thumb_size).toBe(64)

    const read = await ctx.adminPool()
    expect(read.instance_config.image_thumb_size).toBe(300)
  })

  it('applies new image_thumb_size to subsequent photos only', async () => {
    const member = await ctx.createMember({ qq_num: 20001 })
    const memberB = await ctx.createMember({ qq_num: 20002 })
    const gallery = await ctx.createGallery()

    const before = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image: await makePng(800, 600),
    })
    const hash_before = ctx.instance.getInstanceHash()
    const before_meta = await sharp(
      ctx.storage.imagePath('thumb', thumbFilename(before.thumb as string)),
    ).metadata()
    expect(before_meta.width).toBe(640)

    await ctx.adminMutate('adminUpdateInstanceConfig', {
      image_thumb_size: 100,
    })
    const hash_after = ctx.instance.getInstanceHash()
    expect(hash_after).not.toBe(hash_before)
    const fetched = (await ctx.adminPool()).galleries
      .flatMap(item => item.photos)
      .find(item => item.id === before.id)
    expect(fetched?.src_optimized).toContain(`?v=${hash_after}`)
    expect(fetched?.thumb).toContain(`?v=${hash_after}`)

    const after = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: memberB.id as number,
      image: await makePng(800, 600),
    })
    const after_meta = await sharp(
      ctx.storage.imagePath('thumb', thumbFilename(after.thumb as string)),
    ).metadata()
    expect(after_meta.width).toBe(100)
  })

  it('rejects env-only fields and over-hard-limit upload sizes', async () => {
    const env_field = await ctx.adminMutate('adminUpdateInstanceConfig', {
      image_thumb_size: 300,
      APP_ENV: 'production',
    })
    expect(env_field.status).toBe(400)

    const too_large = await ctx.adminMutate('adminUpdateInstanceConfig', {
      max_upload_bytes: 64 * 1024 * 1024,
    })
    expect(too_large.status).toBe(400)
    expect(JSON.stringify(too_large.body)).toContain('HTTP_BODY_HARD_LIMIT_BYTES')
  })
})
