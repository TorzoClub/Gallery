import fs from 'node:fs/promises'
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

describe('member actions', () => {
  it('creates, lists, reads and updates members', async () => {
    const member = await ctx.createMember({ qq_num: 30001, name: 'Alice' })
    expect(member.qq_num).toBe(30001)
    expect(member.id).toBeGreaterThan(0)
    expect(String(member.avatar_src)).toMatch(new RegExp(`^avatar-${member.id}-[0-9a-f]{8}\\.png$`))

    const list = await ctx.adminQuery('adminListMembers')
    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(1)

    const got = await ctx.adminQuery('adminGetMember', { member_id: member.id })
    expect(got.body.data.name).toBe('Alice')

    const updated = await ctx.adminMutate('adminUpdateMember', {
      member_id: member.id,
      name: 'Alice 2',
    })
    expect(updated.status).toBe(200)
    expect(updated.body.data.qq_num).toBe(30001)
    expect(updated.body.data.id).toBe(member.id)

    const photos = await ctx.query('getMemberPhotos', { qq_num: 30001 })
    expect(photos.status).toBe(200)

    const rejected = await ctx.adminMutate('adminUpdateMember', {
      member_id: member.id,
      qq_num: 30002,
    })
    expect(rejected.status).toBe(400)
    expect(rejected.body.code).toBe('INVALID_PAYLOAD')
  })

  it('rejects duplicate qq numbers', async () => {
    await ctx.createMember({ qq_num: 30003 })
    const avatar = await ctx.uploadImage()
    const response = await ctx.adminMutate('adminCreateMember', {
      qq_num: 30003,
      name: 'Duplicate',
      avatar_temp_id: avatar.temp_id,
    })
    expect(response.status).toBe(409)
    expect(response.body.code).toBe('CONFLICT')
  })

  it('replaces the avatar and removes the unreferenced old image', async () => {
    const member = await ctx.createMember({ qq_num: 30004 })
    const old_source = member.avatar_src as string
    const old_path = ctx.storage.imagePath('source', old_source)

    const new_avatar = await ctx.uploadImage(await makePng(100, 100, { r: 10, g: 200, b: 10 }))
    const updated = await ctx.adminMutate('adminUpdateMember', {
      member_id: member.id,
      avatar_temp_id: new_avatar.temp_id,
    })
    expect(updated.status).toBe(200)
    expect(updated.body.data.avatar_src).toMatch(new RegExp(`^avatar-${member.id}-[0-9a-f]{8}\\.png$`))
    expect(updated.body.data.avatar_src).not.toBe(old_source)
    await expect(fs.access(old_path)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

function thumbFilename(url: string): string {
  return decodeURIComponent(new URL(url).pathname.split('/').pop() as string)
}

describe('photo actions', () => {
  it('creates, updates and deletes a photo and its files', async () => {
    const member = await ctx.createMember({ qq_num: 31001 })
    const gallery = await ctx.createGallery()
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      desc: 'old',
      image: await makePng(400, 300),
    })

    const source_path = ctx.storage.imagePath('source', photo.src as string)
    const thumb_path = ctx.storage.imagePath('thumb', thumbFilename(photo.thumb as string))
    await expect(fs.access(source_path)).resolves.toBeUndefined()
    await expect(fs.access(thumb_path)).resolves.toBeUndefined()

    const updated = await ctx.adminMutate('adminUpdatePhoto', {
      photo_id: photo.id,
      desc: 'new',
    })
    expect(updated.status).toBe(200)
    expect(updated.body.data.desc).toBe('new')

    const removed = await ctx.adminMutate('adminRemovePhoto', {
      gallery_id: gallery.id,
      photo_id: photo.id,
    })
    expect(removed.status).toBe(200)
    await expect(fs.access(source_path)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(thumb_path)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a second photo for the same member in one gallery', async () => {
    const member = await ctx.createMember({ qq_num: 31002 })
    const gallery = await ctx.createGallery()
    await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
    })

    const avatar = await ctx.uploadImage()
    const response = await ctx.adminMutate('adminCreatePhoto', {
      gallery_id: gallery.id,
      member_id: member.id,
      desc: 'duplicate',
      temp_id: avatar.temp_id,
    })
    expect(response.status).toBe(409)
  })

  it('blocks member deletion while the member has a photo', async () => {
    const member = await ctx.createMember({ qq_num: 31003 })
    const gallery = await ctx.createGallery()
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
    })

    const blocked = await ctx.adminMutate('adminRemoveMember', { member_id: member.id })
    expect(blocked.status).toBe(409)

    await ctx.adminMutate('adminRemovePhoto', {
      gallery_id: gallery.id,
      photo_id: photo.id,
    })

    const removed = await ctx.adminMutate('adminRemoveMember', { member_id: member.id })
    expect(removed.status).toBe(200)
    expect(removed.body.data.id).toBe(member.id)
  })

  it('rejects QQ changes and keeps the photo linked', async () => {
    const member = await ctx.createMember({ qq_num: 31004 })
    const gallery = await ctx.createGallery()
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
    })

    const updated = await ctx.adminMutate('adminUpdateMember', {
      member_id: member.id,
      qq_num: 31005,
    })
    expect(updated.status).toBe(400)

    const got = await ctx.adminQuery('adminGetPhoto', { photo_id: photo.id })
    expect(got.status).toBe(200)
    expect(got.body.data.member_id).toBe(member.id)
    expect(got.body.data.member.qq_num).toBe(31004)
  })
})
