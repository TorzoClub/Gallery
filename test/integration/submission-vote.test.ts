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

describe('submission flow', () => {
  it('submits, finds, edits and cancels a submission', async () => {
    const member = await ctx.createMember({ qq_num: 40001, name: 'Author' })
    const gallery = await ctx.createGallery({ name: 'Submission' })

    const photo = await ctx.submitPhoto({
      gallery_id: gallery.id as number,
      qq_num: 40001,
      desc: 'first',
      image: await makePng(240, 160),
    })
    expect(photo.member_id).toBe(member.id)
    expect(photo.desc).toBe('first')

    const found = await ctx.query('getSubmission', {
      gallery_id: gallery.id,
      qq_num: 40001,
    })
    expect(found.status).toBe(200)
    expect(found.body.data.id).toBe(photo.id)

    const edited = await ctx.mutate('updateSubmission', {
      photo_id: photo.id,
      qq_num: 40001,
      desc: 'edited',
    })
    expect(edited.status).toBe(200)
    expect(edited.body.data.desc).toBe('edited')

    const canceled = await ctx.mutate('cancelSubmission', {
      photo_id: photo.id,
      qq_num: 40001,
    })
    expect(canceled.status).toBe(200)

    const empty = await ctx.query('getSubmission', {
      gallery_id: gallery.id,
      qq_num: 40001,
    })
    expect(empty.body.data).toBeNull()
  })

  it('rejects duplicate submission and hides members during the event', async () => {
    await ctx.createMember({ qq_num: 40002, name: 'Author' })
    const gallery = await ctx.createGallery()

    await ctx.submitPhoto({
      gallery_id: gallery.id as number,
      qq_num: 40002,
    })

    const temp = await ctx.uploadImage()
    const duplicate = await ctx.mutate('submitPhoto', {
      gallery_id: gallery.id,
      qq_num: 40002,
      desc: 'duplicate',
      temp_id: temp.temp_id,
    })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.code).toBe('CONFLICT')

    const public_list = await ctx.query('listGalleries')
    const active = public_list.body.data.active
    expect(active).not.toBeNull()
    expect(active.photos[0].member).toBeNull()
    expect(active.photos[0].member_id).toBeGreaterThan(0)
  })

  it('rejects submission exactly at submission_expire', async () => {
    await ctx.createMember({ qq_num: 40003 })
    const gallery = await ctx.createGallery({
      submission_expire: new Date(base_now.getTime() + 1000),
    })
    ctx.setNow(new Date(base_now.getTime() + 1000))

    const temp = await ctx.uploadImage()
    const response = await ctx.mutate('submitPhoto', {
      gallery_id: gallery.id,
      qq_num: 40003,
      desc: 'late',
      temp_id: temp.temp_id,
    })
    expect(response.status).toBe(403)
  })
})

describe('vote flow', () => {
  it('votes once per member/gallery, exposes is_voted and blocks duplicates', async () => {
    const author = await ctx.createMember({ qq_num: 41001, name: 'Author' })
    const voter = await ctx.createMember({ qq_num: 41002, name: 'Voter' })
    const gallery = await ctx.createGallery({
      name: 'Vote',
      vote_limit: 2,
      event_start: new Date(base_now.getTime() - 2 * 24 * 60 * 60 * 1000),
      submission_expire: new Date(base_now.getTime() - 24 * 60 * 60 * 1000),
      event_end: new Date(base_now.getTime() + 2 * 24 * 60 * 60 * 1000),
    })
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: author.id as number,
    })

    ctx.setNow(new Date(base_now.getTime() + 12 * 60 * 60 * 1000))
    const voted = await ctx.vote({
      gallery_id: gallery.id as number,
      qq_num: 41002,
      photo_ids: [photo.id as number],
    })
    expect(voted.status).toBe(200)
    expect(voted.body.data).toHaveLength(1)

    const duplicate = await ctx.vote({
      gallery_id: gallery.id as number,
      qq_num: 41002,
      photo_ids: [photo.id as number],
    })
    expect(duplicate.status).toBe(409)

    const home = await ctx.query('getMemberPhotos', { qq_num: 41002 })
    expect(home.status).toBe(200)
    const active = home.body.data.active
    expect(active.vote_submitted).toBe(true)
    expect(active.photos[0].is_voted).toBe(true)
    expect(active.photos[0].vote_count).toBe(1)

    // The voter is also a member; member deletion is blocked by the vote.
    const delete_voter = await ctx.adminMutate('adminRemoveMember', { member_id: voter.id })
    expect(delete_voter.status).toBe(409)
  })

  it('enforces vote_limit and voting period', async () => {
    const authorA = await ctx.createMember({ qq_num: 41011 })
    const authorB = await ctx.createMember({ qq_num: 41012 })
    await ctx.createMember({ qq_num: 41013 })
    const gallery = await ctx.createGallery({
      vote_limit: 1,
      event_start: new Date(base_now.getTime() - 2 * 24 * 60 * 60 * 1000),
      submission_expire: new Date(base_now.getTime() - 24 * 60 * 60 * 1000),
      event_end: new Date(base_now.getTime() + 2 * 24 * 60 * 60 * 1000),
    })
    const photoA = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: authorA.id as number,
    })
    const photoB = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: authorB.id as number,
    })

    ctx.setNow(new Date(base_now.getTime() + 12 * 60 * 60 * 1000))
    const over_limit = await ctx.vote({
      gallery_id: gallery.id as number,
      qq_num: 41013,
      photo_ids: [photoA.id as number, photoB.id as number],
    })
    expect(over_limit.status).toBe(403)

    // Before submission_expire the gallery is still in submission mode.
    const submitting_gallery = await ctx.createGallery({
      name: 'Submitting',
      vote_limit: 1,
    })
    const authorC = await ctx.createMember({ qq_num: 41014 })
    const photoC = await ctx.createPhoto({
      gallery_id: submitting_gallery.id as number,
      member_id: authorC.id as number,
    })
    const not_voting = await ctx.vote({
      gallery_id: submitting_gallery.id as number,
      qq_num: 41013,
      photo_ids: [photoC.id as number],
    })
    expect(not_voting.status).toBe(403)
  })

  it('clears member votes for a gallery from admin', async () => {
    const author = await ctx.createMember({ qq_num: 41021 })
    const voter = await ctx.createMember({ qq_num: 41022 })
    const gallery = await ctx.createGallery({
      event_start: new Date(base_now.getTime() - 2 * 24 * 60 * 60 * 1000),
      submission_expire: new Date(base_now.getTime() - 24 * 60 * 60 * 1000),
      event_end: new Date(base_now.getTime() + 2 * 24 * 60 * 60 * 1000),
    })
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: author.id as number,
    })
    ctx.setNow(new Date(base_now.getTime() + 12 * 60 * 60 * 1000))
    await ctx.vote({
      gallery_id: gallery.id as number,
      qq_num: 41022,
      photo_ids: [photo.id as number],
    })

    const cleared = await ctx.adminMutate('adminClearMemberGalleryVotes', {
      member_id: voter.id,
      gallery_id: gallery.id,
    })
    expect(cleared.status).toBe(200)
    expect(cleared.body.data).toHaveLength(1)

    const home = await ctx.query('getMemberPhotos', { qq_num: 41022 })
    expect(home.body.data.active.vote_submitted).toBe(false)
  })
})
