import { describe, expect, it } from 'vitest'
import { PhotoJsonSchema } from '../../src/server/storage/codec'
import { asGalleryID, asMemberID, asPhotoID } from '../../src/server/common/ID'
import { isApiError } from '../../src/server/common/error'
import {
  galleryCanSubmission,
  galleryInEvent,
  galleryInVotingPeriod,
  galleryPhotosSorted,
  type Gallery,
} from '../../src/server/core/Gallery'
import {
  allocateId,
  createPool,
  findMemberById,
  poolAddPhoto,
  poolCreateGallery,
  poolCreateMember,
  poolDeleteMember,
  poolGalleriesSorted,
  poolSubmitPhoto,
  poolSubmitVotes,
  poolUpdateMember,
  type Pool,
} from '../../src/server/core/Pool'
import { createPhoto } from '../../src/server/core/Photo'

const now = new Date('2026-06-01T00:00:00.000Z')

function date(offset_ms: number): Date {
  return new Date(now.getTime() + offset_ms)
}

function makePool(): Pool {
  return createPool([], [])
}

function addMember(pool: Pool, qq_num: number, name: string): { pool: Pool; member_id: number } {
  const next = poolCreateMember(pool, now, {
    qq_num,
    name,
    avatar_src: `${qq_num}.png`,
  })
  return { pool: next.pool, member_id: Number(next.member.id) }
}

function addGallery(pool: Pool, options: {
  submission_expire?: Date
  vote_limit?: number
} = {}): { pool: Pool; gallery_id: number } {
  const next = poolCreateGallery(pool, now, {
    name: 'Gallery',
    index: 0,
    vote_limit: options.vote_limit ?? 0,
    event_start: date(-2 * 24 * 60 * 60 * 1000),
    submission_expire: options.submission_expire ?? date(24 * 60 * 60 * 1000),
    event_end: date(2 * 24 * 60 * 60 * 1000),
  })
  return { pool: next.pool, gallery_id: Number(next.gallery.id) }
}

function galleryOf(pool: Pool, gallery_id: number): Gallery {
  return pool.galleries.get(asGalleryID(gallery_id)) as Gallery
}

function addPreparedPhoto(
  pool: Pool,
  gallery_id: number,
  member_id: number,
  desc: string,
): { pool: Pool; photo_id: number } {
  const photo = createPhoto({
    id: asPhotoID(Number(pool.next_id)),
    index: 0,
    desc,
    src: `${Number(pool.next_id)}.png`,
    width: 100,
    height: 100,
    has_hdr_optimized: false,
    member_id: asMemberID(member_id),
  }, now)
  const next = poolAddPhoto(pool, now, asGalleryID(gallery_id), {
    id: photo.id,
    index: photo.index,
    desc: photo.desc,
    src: photo.src,
    width: photo.width,
    height: photo.height,
    has_hdr_optimized: false,
    member_id: photo.member_id,
  })
  return { pool: next.pool, photo_id: Number(next.photo.id) }
}

describe('ids', () => {
  it('allocates every entity id from the global next_id cursor', () => {
    let pool = makePool()
    expect(pool.schema_version).toBe(1)
    expect(pool.next_id).toBe(1)

    const allocated = allocateId(pool)
    expect(allocated.id).toBe(1)
    expect(allocated.pool.next_id).toBe(2)
    pool = allocated.pool

    const member = addMember(pool, 10001, 'A')
    expect(member.member_id).toBe(2)
    expect(member.pool.next_id).toBe(3)

    const gallery = addGallery(member.pool)
    expect(gallery.gallery_id).toBe(3)
    expect(gallery.pool.next_id).toBe(4)

    const photo = addPreparedPhoto(gallery.pool, gallery.gallery_id, member.member_id, 'p')
    expect(photo.photo_id).toBe(4)
    expect(photo.pool.next_id).toBe(5)
  })

  it('updates a member without changing the QQ map key', () => {
    const created = addMember(makePool(), 10001, 'A')
    const member_id = created.member_id
    const updated = poolUpdateMember(created.pool, now, asMemberID(member_id), {
      name: 'B',
    })

    expect(Number(updated.member.id)).toBe(member_id)
    expect(updated.pool.members.has(10001 as any)).toBe(true)
    expect(Number(findMemberById(updated.pool, asMemberID(member_id)).qq_num)).toBe(10001)
    expect(findMemberById(updated.pool, asMemberID(member_id)).name).toBe('B')
  })
})

describe('gallery time boundaries', () => {
  it('uses < for submission and >= for voting', () => {
    const created = addGallery(makePool(), {
      submission_expire: now,
    })
    const gallery = galleryOf(created.pool, created.gallery_id)

    expect(galleryInEvent(now, gallery)).toBe(true)
    expect(galleryCanSubmission(now, gallery)).toBe(false)
    expect(galleryInVotingPeriod(now, gallery)).toBe(true)
  })

  it('rejects invalid event date order', () => {
    expect(() => poolCreateGallery(makePool(), now, {
      name: 'bad',
      index: 0,
      vote_limit: 0,
      event_start: date(1000),
      submission_expire: date(0),
      event_end: date(2000),
    })).toThrowError()
  })
})

describe('submission and voting rules', () => {
  it('rejects a second submission from the same member in one gallery', () => {
    const member = addMember(makePool(), 10001, 'A')
    const gallery = addGallery(member.pool)
    const photo_id = asPhotoID(Number(gallery.pool.next_id))
    const first = poolSubmitPhoto(gallery.pool, now, asGalleryID(gallery.gallery_id), asMemberID(member.member_id), {
      id: photo_id,
      index: 0,
      desc: 'first',
      src: `${Number(photo_id)}.png`,
      width: 100,
      height: 100,
      has_hdr_optimized: false,
      member_id: asMemberID(member.member_id),
    })

    const second_photo_id = asPhotoID(Number(first.pool.next_id))
    expect(() => poolSubmitPhoto(
      first.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asMemberID(member.member_id),
      {
        id: second_photo_id,
        index: 0,
        desc: 'second',
        src: `${Number(second_photo_id)}.png`,
        width: 100,
        height: 100,
        has_hdr_optimized: false,
        member_id: asMemberID(member.member_id),
      },
    )).toThrowError(/已经在这个相册投过稿/)
  })

  it('rejects duplicate votes and respects vote_limit', () => {
    const voter = addMember(makePool(), 10001, 'Voter')
    const authorA = addMember(voter.pool, 10002, 'A')
    const authorB = addMember(authorA.pool, 10003, 'B')
    const gallery = addGallery(authorB.pool, {
      submission_expire: date(-1000),
      vote_limit: 1,
    })
    const photoA = addPreparedPhoto(gallery.pool, gallery.gallery_id, authorA.member_id, 'A')
    const photoB = addPreparedPhoto(photoA.pool, gallery.gallery_id, authorB.member_id, 'B')

    const voted = poolSubmitVotes(
      photoB.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asMemberID(voter.member_id),
      [asPhotoID(photoA.photo_id)],
    )
    expect(voted.votes).toHaveLength(1)

    expect(() => poolSubmitVotes(
      voted.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asMemberID(voter.member_id),
      [asPhotoID(photoB.photo_id)],
    )).toThrowError(/已经在这个相册投过票/)

    const voter2 = addMember(voted.pool, 10004, 'Voter2')
    expect(() => poolSubmitVotes(
      voter2.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asMemberID(voter2.member_id),
      [asPhotoID(photoA.photo_id), asPhotoID(photoB.photo_id)],
    )).toThrowError(/最多只能投 1 张/)
  })

  it('rejects votes outside the voting period', () => {
    const voter = addMember(makePool(), 10001, 'Voter')
    const author = addMember(voter.pool, 10002, 'A')
    const gallery = addGallery(author.pool)
    const photo = addPreparedPhoto(gallery.pool, gallery.gallery_id, author.member_id, 'A')

    let error: unknown
    try {
      poolSubmitVotes(
        photo.pool,
        now,
        asGalleryID(gallery.gallery_id),
        asMemberID(voter.member_id),
        [asPhotoID(photo.photo_id)],
      )
    } catch (caught) {
      error = caught
    }
    expect(isApiError(error)).toBe(true)
    expect((error as any).status).toBe(403)
  })

  it('allows deleting a member only when they have no references', () => {
    const member = addMember(makePool(), 10001, 'A')
    const gallery = addGallery(member.pool)
    const photo = addPreparedPhoto(gallery.pool, gallery.gallery_id, member.member_id, 'A')

    expect(() => poolDeleteMember(photo.pool, asMemberID(member.member_id))).toThrowError(/投稿或投票/)

    const removed = poolDeleteMember(member.pool, asMemberID(member.member_id))
    expect(removed.pool.members.size).toBe(0)
  })
})

describe('sorting', () => {
  it('sorts galleries and photos deterministically', () => {
    const member = addMember(makePool(), 10001, 'A')
    const galleryA = poolCreateGallery(member.pool, now, {
      name: 'A',
      index: 1,
      vote_limit: 0,
      event_start: date(-1000),
      submission_expire: date(1000),
      event_end: date(2000),
    })
    const galleryB = poolCreateGallery(galleryA.pool, now, {
      name: 'B',
      index: 2,
      vote_limit: 0,
      event_start: date(-1000),
      submission_expire: date(1000),
      event_end: date(2000),
    })

    const sorted = poolGalleriesSorted(galleryB.pool)
    expect(sorted.map((gallery) => gallery.index)).toEqual([2, 1])

    const memberB = addMember(galleryB.pool, 10002, 'B')
    const photoA = addPreparedPhoto(memberB.pool, Number(galleryB.gallery.id), member.member_id, 'A')
    const photoB = addPreparedPhoto(photoA.pool, Number(galleryB.gallery.id), memberB.member_id, 'B')
    const gallery = galleryOf(photoB.pool, Number(galleryB.gallery.id))
    expect(galleryPhotosSorted(gallery).map((photo) => Number(photo.id))).toEqual([
      photoA.photo_id,
      photoB.photo_id,
    ])
  })
})

describe('photo json compatibility', () => {
  it('defaults a missing has_hdr_optimized to false', () => {
    const photo = PhotoJsonSchema.parse({
      id: 1,
      index: 0,
      desc: 'legacy',
      src: 'photo-1-1-deadbeef.jpg',
      format: 'jpg',
      width: 100,
      height: 100,
      member_id: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    expect(photo.has_hdr_optimized).toBe(false)
  })

  it('does not treat legacy is_hdr as a generated HDR file', () => {
    const photo = PhotoJsonSchema.parse({
      id: 1,
      index: 0,
      desc: 'legacy',
      src: 'photo-1-1-deadbeef.jpg',
      format: 'jpg',
      width: 100,
      height: 100,
      is_hdr: true,
      member_id: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    expect(photo.has_hdr_optimized).toBe(false)
  })
})
