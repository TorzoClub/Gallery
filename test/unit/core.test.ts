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
  poolAddPhotoReserved,
  poolCreateGallery,
  poolCreateMember,
  poolClearMemberGalleryVotes,
  poolDeleteMember,
  poolGalleriesSorted,
  poolRemoveGallery,
  poolRemovePhoto,
  poolSubmitPhoto,
  poolSubmitPhotoReserved,
  poolSubmitVotes,
  poolUpdateMember,
  type Pool,
} from '../../src/server/core/Pool'
import { checkPool } from '../../src/server/core/Pool-Check'
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
  event_start?: Date
  submission_expire?: Date
  event_end?: Date
  vote_limit?: number
} = {}): { pool: Pool; gallery_id: number } {
  const next = poolCreateGallery(pool, now, {
    name: 'Gallery',
    index: 0,
    vote_limit: options.vote_limit ?? 0,
    event_start: options.event_start ?? date(-2 * 24 * 60 * 60 * 1000),
    submission_expire: options.submission_expire ?? date(24 * 60 * 60 * 1000),
    event_end: options.event_end ?? date(2 * 24 * 60 * 60 * 1000),
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
    expect(pool.schema_version).toBe(2)
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

  it('inserts photos with reserved ids without consuming next_id twice', () => {
    const member = addMember(makePool(), 10001, 'A')
    const gallery = addGallery(member.pool)

    const allocated = allocateId(gallery.pool)
    expect(allocated.id).toBe(Number(gallery.pool.next_id))
    expect(allocated.pool.next_id).toBe(Number(gallery.pool.next_id) + 1)

    const photo_id = asPhotoID(allocated.id)
    const added = poolAddPhotoReserved(allocated.pool, now, asGalleryID(gallery.gallery_id), {
      id: photo_id,
      index: 0,
      desc: 'reserved',
      src: `${allocated.id}.png`,
      width: 100,
      height: 100,
      has_hdr_optimized: false,
      member_id: asMemberID(member.member_id),
    })

    expect(Number(added.photo.id)).toBe(allocated.id)
    expect(added.pool.next_id).toBe(allocated.pool.next_id)

    const second_member = addMember(added.pool, 10002, 'B')
    const second_allocated = allocateId(second_member.pool)
    const submitted = poolSubmitPhotoReserved(
      second_allocated.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asMemberID(second_member.member_id),
      {
        id: asPhotoID(second_allocated.id),
        index: 0,
        desc: 'reserved submission',
        src: `${second_allocated.id}.png`,
        width: 100,
        height: 100,
        has_hdr_optimized: false,
        member_id: asMemberID(second_member.member_id),
      },
    )

    expect(Number(submitted.photo.id)).toBe(second_allocated.id)
    expect(submitted.pool.next_id).toBe(second_allocated.pool.next_id)
  })

  it('rejects a reserved photo id that is already occupied', () => {
    const author = addMember(makePool(), 10001, 'A')
    const other = addMember(author.pool, 10002, 'B')
    const gallery = addGallery(other.pool)
    const photo = addPreparedPhoto(gallery.pool, gallery.gallery_id, author.member_id, 'existing')
    const allocated = allocateId(photo.pool)
    expect(() => poolAddPhotoReserved(
      allocated.pool,
      now,
      asGalleryID(gallery.gallery_id),
      {
        id: asPhotoID(photo.photo_id),
        index: 0,
        desc: 'duplicate',
        src: `${photo.photo_id}.png`,
        width: 100,
        height: 100,
        has_hdr_optimized: false,
        member_id: asMemberID(other.member_id),
      },
    )).toThrowError(/已经存在/)
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
  it('uses < for submission and >= for voting at submission_expire', () => {
    const created = addGallery(makePool(), {
      submission_expire: now,
    })
    const gallery = galleryOf(created.pool, created.gallery_id)

    expect(galleryInEvent(now, gallery)).toBe(true)
    expect(galleryCanSubmission(now, gallery)).toBe(false)
    expect(galleryInVotingPeriod(now, gallery)).toBe(true)
  })

  it('includes event_end in the event window', () => {
    const created = addGallery(makePool(), {
      event_start: date(-3 * 60 * 60 * 1000),
      submission_expire: date(-2 * 60 * 60 * 1000),
      event_end: now,
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

describe('gallery event overlap', () => {
  it('rejects overlapping event periods', () => {
    const first = addGallery(makePool())
    const second = addGallery(first.pool)
    expect(() => checkPool(second.pool))
      .toThrowError(/活动期间不能有重合/)
  })

  it('allows adjacent periods to touch only at their boundary if they do not overlap', () => {
    const first = addGallery(makePool(), {
      event_start: date(-3 * 60 * 60 * 1000),
      submission_expire: date(-2 * 60 * 60 * 1000),
      event_end: date(-60 * 60 * 1000),
    })
    const second = addGallery(first.pool, {
      event_start: now,
      submission_expire: date(60 * 60 * 1000),
      event_end: date(2 * 60 * 60 * 1000),
    })
    expect(() => checkPool(second.pool)).not.toThrow()
  })

  it('treats touching inclusive boundaries as overlap', () => {
    const first = addGallery(makePool(), {
      event_start: date(-3 * 60 * 60 * 1000),
      submission_expire: date(-2 * 60 * 60 * 1000),
      event_end: now,
    })
    const second = addGallery(first.pool, {
      event_start: now,
      submission_expire: date(60 * 60 * 1000),
      event_end: date(2 * 60 * 60 * 1000),
    })
    expect(() => checkPool(second.pool))
      .toThrowError(/活动期间不能有重合/)
  })
})

describe('gallery removal', () => {
  it('removes an empty gallery', () => {
    const created = addGallery(makePool())
    const removed = poolRemoveGallery(created.pool, asGalleryID(created.gallery_id))
    expect(removed.gallery.id).toBe(created.gallery_id)
    expect(removed.pool.galleries.size).toBe(0)
  })

  it('refuses to remove a gallery that still has photos', () => {
    const member = addMember(makePool(), 10001, 'A')
    const gallery = addGallery(member.pool)
    const photo = addPreparedPhoto(gallery.pool, gallery.gallery_id, member.member_id, 'A')

    expect(() => poolRemoveGallery(photo.pool, asGalleryID(gallery.gallery_id)))
      .toThrowError(/还有 1 张相片/)
    expect(photo.pool.galleries.size).toBe(1)
    expect(galleryOf(photo.pool, gallery.gallery_id).photos.size).toBe(1)
  })

  it('allows removal after the last photo is removed', () => {
    const member = addMember(makePool(), 10001, 'A')
    const gallery = addGallery(member.pool)
    const photo = addPreparedPhoto(gallery.pool, gallery.gallery_id, member.member_id, 'A')
    const without_photo = poolRemovePhoto(
      photo.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asPhotoID(photo.photo_id),
    )
    const removed = poolRemoveGallery(without_photo.pool, asGalleryID(gallery.gallery_id))

    expect(removed.pool.galleries.size).toBe(0)
  })
})

describe('gallery time boundaries before and after the event', () => {
  it('is neither in event nor accepting submissions outside the window', () => {
    const before = addGallery(makePool(), {
      event_start: date(60 * 60 * 1000),
      submission_expire: date(2 * 60 * 60 * 1000),
      event_end: date(3 * 60 * 60 * 1000),
    })
    const before_gallery = galleryOf(before.pool, before.gallery_id)
    expect(galleryInEvent(now, before_gallery)).toBe(false)
    expect(galleryCanSubmission(now, before_gallery)).toBe(false)

    const after = addGallery(makePool(), {
      event_start: date(-3 * 60 * 60 * 1000),
      submission_expire: date(-2 * 60 * 60 * 1000),
      event_end: date(-60 * 60 * 1000),
    })
    const after_gallery = galleryOf(after.pool, after.gallery_id)
    expect(galleryInEvent(now, after_gallery)).toBe(false)
    expect(galleryCanSubmission(now, after_gallery)).toBe(false)
  })
})

describe('submission and voting rules', () => {
  it('rejects submissions before the event starts and after it ends', () => {
    const member = addMember(makePool(), 10001, 'A')
    const before = addGallery(member.pool, {
      event_start: date(60 * 60 * 1000),
      submission_expire: date(2 * 60 * 60 * 1000),
      event_end: date(3 * 60 * 60 * 1000),
    })
    const before_id = asPhotoID(Number(before.pool.next_id))
    expect(() => poolSubmitPhoto(
      before.pool,
      now,
      asGalleryID(before.gallery_id),
      asMemberID(member.member_id),
      {
        id: before_id,
        index: 0,
        desc: 'before',
        src: `${Number(before_id)}.png`,
        width: 100,
        height: 100,
        has_hdr_optimized: false,
        member_id: asMemberID(member.member_id),
      },
    )).toThrowError(/当前不在投稿期间/)

    const after = addGallery(member.pool, {
      event_start: date(-3 * 60 * 60 * 1000),
      submission_expire: date(-2 * 60 * 60 * 1000),
      event_end: date(-60 * 60 * 1000),
    })
    const after_id = asPhotoID(Number(after.pool.next_id))
    expect(() => poolSubmitPhoto(
      after.pool,
      now,
      asGalleryID(after.gallery_id),
      asMemberID(member.member_id),
      {
        id: after_id,
        index: 0,
        desc: 'after',
        src: `${Number(after_id)}.png`,
        width: 100,
        height: 100,
        has_hdr_optimized: false,
        member_id: asMemberID(member.member_id),
      },
    )).toThrowError(/当前不在投稿期间/)
  })

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

  it('rejects voting before the event starts and after it ends', () => {
    const voter = addMember(makePool(), 10001, 'Voter')
    const author = addMember(voter.pool, 10002, 'A')
    const before = addGallery(author.pool, {
      event_start: date(60 * 60 * 1000),
      submission_expire: date(2 * 60 * 60 * 1000),
      event_end: date(3 * 60 * 60 * 1000),
    })
    const before_photo = addPreparedPhoto(before.pool, before.gallery_id, author.member_id, 'before')
    expect(() => poolSubmitVotes(
      before_photo.pool,
      now,
      asGalleryID(before.gallery_id),
      asMemberID(voter.member_id),
      [asPhotoID(before_photo.photo_id)],
    )).toThrowError(/当前不在投票期间/)

    const after = addGallery(author.pool, {
      event_start: date(-3 * 60 * 60 * 1000),
      submission_expire: date(-2 * 60 * 60 * 1000),
      event_end: date(-60 * 60 * 1000),
    })
    const after_photo = addPreparedPhoto(after.pool, after.gallery_id, author.member_id, 'after')
    expect(() => poolSubmitVotes(
      after_photo.pool,
      now,
      asGalleryID(after.gallery_id),
      asMemberID(voter.member_id),
      [asPhotoID(after_photo.photo_id)],
    )).toThrowError(/当前不在投票期间/)
  })

  it('allows unlimited votes when vote_limit is zero', () => {
    const voter = addMember(makePool(), 10001, 'Voter')
    const authorA = addMember(voter.pool, 10002, 'A')
    const authorB = addMember(authorA.pool, 10003, 'B')
    const gallery = addGallery(authorB.pool, {
      submission_expire: date(-1000),
      vote_limit: 0,
    })
    const photoA = addPreparedPhoto(gallery.pool, gallery.gallery_id, authorA.member_id, 'A')
    const photoB = addPreparedPhoto(photoA.pool, gallery.gallery_id, authorB.member_id, 'B')

    const voted = poolSubmitVotes(
      photoB.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asMemberID(voter.member_id),
      [asPhotoID(photoA.photo_id), asPhotoID(photoB.photo_id)],
    )
    expect(voted.votes).toHaveLength(2)
  })

  it('rejects empty votes, duplicate photo ids and photos from another gallery', () => {
    const voter = addMember(makePool(), 10001, 'Voter')
    const author = addMember(voter.pool, 10002, 'A')
    const gallery = addGallery(author.pool, { submission_expire: date(-1000) })
    const photo = addPreparedPhoto(gallery.pool, gallery.gallery_id, author.member_id, 'A')
    const other_gallery = addGallery(photo.pool, { submission_expire: date(-1000) })
    const other_photo = addPreparedPhoto(other_gallery.pool, other_gallery.gallery_id, author.member_id, 'B')

    expect(() => poolSubmitVotes(
      other_photo.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asMemberID(voter.member_id),
      [],
    )).toThrowError(/至少需要选择一张相片/)

    expect(() => poolSubmitVotes(
      other_photo.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asMemberID(voter.member_id),
      [asPhotoID(photo.photo_id), asPhotoID(photo.photo_id)],
    )).toThrowError(/不能重复选择同一张相片/)

    let error: unknown
    try {
      poolSubmitVotes(
        other_photo.pool,
        now,
        asGalleryID(gallery.gallery_id),
        asMemberID(voter.member_id),
        [asPhotoID(other_photo.photo_id)],
      )
    } catch (caught) {
      error = caught
    }
    expect(isApiError(error)).toBe(true)
    expect((error as any).status).toBe(404)
  })

  it('allows deleting a member only when they have no references', () => {
    const member = addMember(makePool(), 10001, 'A')
    const gallery = addGallery(member.pool)
    const photo = addPreparedPhoto(gallery.pool, gallery.gallery_id, member.member_id, 'A')

    expect(() => poolDeleteMember(photo.pool, asMemberID(member.member_id))).toThrowError(/投稿或投票/)

    const removed = poolDeleteMember(member.pool, asMemberID(member.member_id))
    expect(removed.pool.members.size).toBe(0)
  })

  it('refuses to delete a member who voted, then allows deletion after clearing votes', () => {
    const voter = addMember(makePool(), 10001, 'Voter')
    const author = addMember(voter.pool, 10002, 'A')
    const gallery = addGallery(author.pool, { submission_expire: date(-1000) })
    const photo = addPreparedPhoto(gallery.pool, gallery.gallery_id, author.member_id, 'A')
    const voted = poolSubmitVotes(
      photo.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asMemberID(voter.member_id),
      [asPhotoID(photo.photo_id)],
    )

    expect(() => poolDeleteMember(voted.pool, asMemberID(voter.member_id)))
      .toThrowError(/投稿或投票/)

    const cleared = poolClearMemberGalleryVotes(
      voted.pool,
      now,
      asGalleryID(gallery.gallery_id),
      asMemberID(voter.member_id),
    )
    expect(cleared.removed).toHaveLength(1)
    expect(() => poolDeleteMember(cleared.pool, asMemberID(voter.member_id)))
      .not.toThrow()
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
