import { describe, expect, it } from 'vitest'
import { asGalleryID, asMemberID, asPhotoID } from '../../src/server/common/ID'
import {
  createPool,
  poolAddPhoto,
  poolCreateGallery,
  poolCreateMember,
  poolSubmitVotes,
  type Pool,
} from '../../src/server/core/Pool'
import { toClientPool } from '../../src/server/instance/to-client-pool'
import { formatUptime } from '../../src/shared/uptime'

const now = new Date('2026-06-01T00:00:00.000Z')
const past = new Date('2026-01-01T00:00:00.000Z')

function makePool(): Pool {
  return createPool([], [])
}

function addMember(pool: Pool, qq_num: number): { pool: Pool; member_id: number } {
  const next = poolCreateMember(pool, now, {
    qq_num,
    name: `member-${qq_num}`,
    avatar_src: `${qq_num}.png`,
  })
  return { pool: next.pool, member_id: Number(next.member.id) }
}

function addGallery(pool: Pool, options: {
  name: string
  event_start: Date
  submission_expire: Date
  event_end: Date
}): { pool: Pool; gallery_id: number } {
  const next = poolCreateGallery(pool, now, {
    ...options,
    index: 0,
    vote_limit: 0,
  })
  return { pool: next.pool, gallery_id: Number(next.gallery.id) }
}

function addPhoto(pool: Pool, gallery_id: number, member_id: number): { pool: Pool; photo_id: number } {
  const photo_id = asPhotoID(Number(pool.next_id))
  const next = poolAddPhoto(pool, now, asGalleryID(gallery_id), {
    id: photo_id,
    index: 0,
    desc: `photo-${photo_id}`,
    src: `${photo_id}.png`,
    width: 100,
    height: 80,
    has_hdr_optimized: false,
    member_id: asMemberID(member_id),
  })
  return { pool: next.pool, photo_id: Number(photo_id) }
}

describe('toClientPool', () => {
  it('masks active galleries and computes stats without leaking active votes', () => {
    let pool = makePool()
    const author = addMember(pool, 10001)
    pool = author.pool
    const voter = addMember(pool, 10002)
    pool = voter.pool

    const active = addGallery(pool, {
      name: 'active',
      event_start: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      submission_expire: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      event_end: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    })
    pool = active.pool
    const active_photo = addPhoto(pool, active.gallery_id, author.member_id)
    pool = active_photo.pool

    const past_gallery = addGallery(pool, {
      name: 'past',
      event_start: new Date(past.getTime() - 2 * 24 * 60 * 60 * 1000),
      submission_expire: new Date(past.getTime() - 24 * 60 * 60 * 1000),
      event_end: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    })
    pool = past_gallery.pool
    const past_photo = addPhoto(pool, past_gallery.gallery_id, author.member_id)
    pool = past_photo.pool

    const active_vote = poolSubmitVotes(
      pool,
      now,
      asGalleryID(active.gallery_id),
      asMemberID(voter.member_id),
      [asPhotoID(active_photo.photo_id)],
    )
    pool = active_vote.pool

    const past_vote = poolSubmitVotes(
      pool,
      past,
      asGalleryID(past_gallery.gallery_id),
      asMemberID(voter.member_id),
      [asPhotoID(past_photo.photo_id)],
    )
    pool = past_vote.pool

    const client_pool = toClientPool(pool, now, {
      instance_hash: 'abc123',
      app_startup_time: now.getTime() - 90 * 60 * 1000,
      version_time: 123456,
      build_date: '2026-06-01',
      git_hash: 'deadbeef',
    })

    expect(client_pool.submissions).toBe(2)
    expect(client_pool.votes).toBe(1)
    expect(client_pool.app_startup_time).toBe(now.getTime() - 90 * 60 * 1000)
    expect(client_pool.version_time).toBe(123456)
    expect(client_pool.build_date).toBe('2026-06-01')
    expect(client_pool.git_hash).toBe('deadbeef')
    expect(client_pool.members).toHaveLength(2)

    const active_client = client_pool.galleries.find(gallery => gallery.in_event)
    expect(active_client).toBeDefined()
    if (active_client === undefined || !active_client.in_event) {
      throw new Error('missing active gallery')
    }
    expect('vote_records' in active_client).toBe(false)
    expect(active_client.photos).toHaveLength(1)
    expect(active_client.photos[0]?.member_id).toBeNull()

    const past_client = client_pool.galleries.find(gallery => gallery.name === 'past')
    expect(past_client).toBeDefined()
    if (past_client === undefined || past_client.in_event) {
      throw new Error('missing past gallery')
    }
    expect(past_client.vote_records).toHaveLength(1)
    expect(past_client.photos[0]?.member_id).toBe(author.member_id)
  })
})

describe('formatUptime', () => {
  const hour = 60 * 60 * 1000
  const day = 24 * hour

  it('uses m d h below one year', () => {
    expect(formatUptime(0, hour * 1)).toBe('0m 0d 1h')
    expect(formatUptime(0, day + 2 * hour)).toBe('0m 1d 2h')
    expect(formatUptime(0, 30 * day + 3 * day + 4 * hour)).toBe('1m 3d 4h')
  })

  it('uses y m d at one year and above', () => {
    expect(formatUptime(0, 365 * day + 2 * 30 * day + 3 * day + 5 * hour)).toBe('1y 2m 3d')
    expect(formatUptime(0, 2 * 365 * day + 5 * hour)).toBe('2y 0m 0d')
  })
})
