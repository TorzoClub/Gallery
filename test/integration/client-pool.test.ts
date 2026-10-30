import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createTestContext,
  makePng,
  type TestContext,
} from '../helpers/app'

let ctx: TestContext
const now = new Date('2026-06-01T00:00:00.000Z')

beforeEach(async () => {
  ctx = await createTestContext({ now })
})

afterEach(async () => {
  await ctx.close()
})

describe('fetchClientPool', () => {
  it('returns a masked active gallery while retaining members', async () => {
    await ctx.createMember({ qq_num: 60001, name: 'Author' })
    const gallery = await ctx.createGallery()
    await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: 1,
      image: await makePng(120, 80),
    })

    const response = await ctx.query('fetchClientPool')
    expect(response.status).toBe(200)

    const pool = response.body.data
    expect(pool.app_startup_time).toBeTypeOf('number')
    expect(pool.version_time).toBeTypeOf('number')
    expect(pool.build_date).toBeTypeOf('string')
    expect(pool.git_hash).toBeTypeOf('string')
    expect(pool.submissions).toBe(1)
    expect(pool.votes).toBe(0)
    expect(pool.members).toHaveLength(1)
    expect(pool.members[0].qq_num).toBeNull()
    expect(JSON.stringify(pool)).not.toContain('60001')

    const active = pool.galleries.find((item: any) => item.in_event)
    expect(active).toBeDefined()
    expect(active.in_event).toBe(true)
    expect(active.vote_records).toBeUndefined()
    expect(active.photos[0].member_id).toBeNull()
  })

  it('returns the viewer-only state without exposing other vote records', async () => {
    await ctx.createMember({ qq_num: 60011, name: 'Author' })
    const gallery = await ctx.createGallery()
    const photo = await ctx.submitPhoto({
      gallery_id: gallery.id as number,
      qq_num: 60011,
      image: await makePng(120, 80),
    })

    const response = await ctx.query('fetchMemberView', { qq_num: 60011 })
    expect(response.status).toBe(200)
    expect(response.body.data.active_gallery_id).toBe(gallery.id)
    expect(response.body.data.vote_submitted).toBe(false)
    expect(response.body.data.voted_photo_ids).toEqual([])
    expect(response.body.data.submitted_photo.id).toBe(photo.id)
  })
})
