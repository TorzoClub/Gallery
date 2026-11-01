import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createTestContext,
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

describe('public QQ masking', () => {
  it('hides qq_num from every public DTO while keeping it in admin DTOs', async () => {
    const qq_num = 70001
    const member = await ctx.createMember({ qq_num, name: 'Public member' })
    const gallery = await ctx.createGallery({
      event_start: new Date(base_now.getTime() - 3 * 24 * 60 * 60 * 1000),
      submission_expire: new Date(base_now.getTime() - 2 * 24 * 60 * 60 * 1000),
      event_end: new Date(base_now.getTime() - 24 * 60 * 60 * 1000),
    })
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
    })

    const public_list = await ctx.query('listGalleries')
    expect(public_list.status).toBe(200)
    const public_gallery = public_list.body.data.galleries[0]
    expect(public_gallery.photos[0].member.qq_num).toBeNull()
    expect(JSON.stringify(public_list.body)).not.toContain(String(qq_num))

    const public_gallery_result = await ctx.query('getGallery', { gallery_id: gallery.id })
    expect(public_gallery_result.status).toBe(200)
    expect(public_gallery_result.body.data.photos[0].member.qq_num).toBeNull()

    const public_photo_result = await ctx.query('getPhoto', { photo_id: photo.id })
    expect(public_photo_result.status).toBe(200)
    expect(public_photo_result.body.data.member.qq_num).toBeNull()

    const submission = await ctx.query('getSubmission', {
      gallery_id: gallery.id,
      qq_num,
    })
    expect(submission.status).toBe(200)
    expect(submission.body.data.member.qq_num).toBeNull()

    const admin_pool = await ctx.adminPool()
    const admin_gallery = admin_pool.galleries.find(item => item.id === gallery.id)
    expect(admin_gallery?.photos[0]?.member?.qq_num).toBe(qq_num)

    const admin_photo = admin_pool.galleries
      .flatMap(item => item.photos)
      .find(item => item.id === photo.id)
    expect(admin_photo?.member?.qq_num).toBe(qq_num)
  })
})
