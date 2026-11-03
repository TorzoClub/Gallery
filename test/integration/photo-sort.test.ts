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

async function seedGallery(count: number) {
  const gallery = await ctx.createGallery()
  const photo_ids: number[] = []
  for (let i = 0; i < count; i += 1) {
    const member = await ctx.createMember({ qq_num: 52001 + i })
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      desc: `p${i}`,
      image: await makePng(40, 30),
    })
    photo_ids.push(photo.id as number)
  }
  return { gallery_id: gallery.id as number, photo_ids }
}

describe('adminSortPhotos', () => {
  it('rewrites every photo index in one call and is idempotent', async () => {
    const { gallery_id, photo_ids } = await seedGallery(3)
    const order = [photo_ids[2], photo_ids[0], photo_ids[1]]

    const response = await ctx.adminMutate('adminSortPhotos', { gallery_id, photo_ids: order })
    expect(response.status).toBe(200)
    const photos = response.body.data.photos as Array<{ id: number; index: number }>
    expect(photos.map(photo => photo.id)).toEqual(order)
    expect(photos.map(photo => photo.index)).toEqual([0, 1, 2])

    const again = await ctx.adminMutate('adminSortPhotos', { gallery_id, photo_ids: order })
    expect(again.status).toBe(200)
    expect((again.body.data.photos as Array<{ id: number }>).map(photo => photo.id)).toEqual(order)
  })

  it('rejects a partial, duplicated or foreign photo list without changing anything', async () => {
    const { gallery_id, photo_ids } = await seedGallery(3)
    const day = 24 * 60 * 60 * 1000
    const other = await ctx.createGallery({
      name: 'Other',
      event_start: new Date(Date.now() - 30 * day),
      submission_expire: new Date(Date.now() - 29 * day),
      event_end: new Date(Date.now() - 28 * day),
    })

    const partial = await ctx.adminMutate('adminSortPhotos', { gallery_id, photo_ids: photo_ids.slice(0, 2) })
    expect(partial.status).toBe(400)

    const duplicated = await ctx.adminMutate('adminSortPhotos', {
      gallery_id,
      photo_ids: [photo_ids[0], photo_ids[0], photo_ids[1]],
    })
    expect(duplicated.status).toBe(400)

    const foreign = await ctx.adminMutate('adminSortPhotos', { gallery_id: other.id, photo_ids })
    expect(foreign.status).toBe(404)

    const untouched = await ctx.adminMutate('adminSortPhotos', { gallery_id, photo_ids })
    expect(untouched.status).toBe(200)
    expect((untouched.body.data.photos as Array<{ id: number }>).map(photo => photo.id)).toEqual(photo_ids)
  })

  it('no longer exposes adminSortPhotosByVoteCount', async () => {
    const { gallery_id } = await seedGallery(1)
    const response = await ctx.adminMutate('adminSortPhotosByVoteCount', { gallery_id })
    expect(response.status).not.toBe(200)
  })
})
