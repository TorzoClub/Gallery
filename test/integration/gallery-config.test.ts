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

    const list = await ctx.adminQuery('adminListGalleries')
    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(1)
    expect(list.body.data[0].id).toBe(gallery.id)

    const updated = await ctx.adminMutate('adminUpdateGallery', {
      gallery_id: gallery.id,
      name: 'Updated',
      vote_limit: 5,
    })
    expect(updated.status).toBe(200)
    expect(updated.body.data.name).toBe('Updated')
    expect(updated.body.data.vote_limit).toBe(5)

    const got = await ctx.adminQuery('adminGetGallery', { gallery_id: gallery.id })
    expect(got.body.data.name).toBe('Updated')
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

  it('rejects removing a gallery id that does not exist', async () => {
    const response = await ctx.adminMutate('adminRemoveGallery', { gallery_id: 999 })
    expect(response.status).toBe(404)
    expect(response.body.code).toBe('NOT_FOUND')
  })
})

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

    const read = await ctx.adminQuery('adminGetInstanceConfig')
    expect(read.body.data.image_thumb_size).toBe(300)
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
    const before_meta = await sharp(
      ctx.storage.imagePath('thumb', before.thumb as string),
    ).metadata()
    expect(before_meta.width).toBe(640)

    await ctx.adminMutate('adminUpdateInstanceConfig', {
      image_thumb_size: 100,
    })

    const after = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: memberB.id as number,
      image: await makePng(800, 600),
    })
    const after_meta = await sharp(
      ctx.storage.imagePath('thumb', after.thumb as string),
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
