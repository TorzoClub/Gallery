import Immutable from 'immutable'
import {
  asGalleryID,
  asMemberID,
  asNextID,
  asSchemaVersion,
  asVoteID,
  type GalleryID,
  type MemberID,
  type NextID,
  type PhotoID,
  type SchemaVersion,
} from '../common/ID'
import { badRequest, conflict, notFound } from '../common/error'
import {
  checkGallery,
  galleryClearMemberVotes,
  galleryPhoto,
  galleryPhotosSorted,
  galleryRemovePhoto,
  galleryRemoveSubmission,
  gallerySetSubmission,
  gallerySortPhotosByVoteCount,
  gallerySubmitVotes,
  galleryUpdatePhoto,
  galleryVotesForMember,
  galleryVotesForPhoto,
  memberHasSubmitted,
  memberHasVoted,
  voteCountByPhoto,
  type Gallery,
  type Vote,
} from './Gallery'
import {
  asQQNumber,
  createMember,
  updateMember,
  type Member,
  type MemberUpdate,
  type QQNumber,
} from './Member'
import {
  createPhoto,
  type Photo,
  type PhotoDraft,
} from './Photo'

export const CURRENT_SCHEMA_VERSION: SchemaVersion = asSchemaVersion(1)

export type Pool = {
  schema_version: SchemaVersion
  next_id: NextID
  galleries: Immutable.Map<GalleryID, Gallery>
  members: Immutable.Map<QQNumber, Member>
}

export type GalleriesDiff = {
  adds: Immutable.Map<GalleryID, Gallery>
  changes: Immutable.Map<GalleryID, Gallery>
  dels: Immutable.Map<GalleryID, Gallery>
}

export function diffGalleriesMap(
  map_new: Pool['galleries'],
  map_prev: Pool['galleries'],
): GalleriesDiff {
  let adds = Immutable.Map<GalleryID, Gallery>()
  let changes = Immutable.Map<GalleryID, Gallery>()
  let dels = Immutable.Map<GalleryID, Gallery>()

  map_new.forEach((gallery, id) => {
    const prev = map_prev.get(id)
    if (prev === undefined) {
      adds = adds.set(id, gallery)
    } else if (prev !== gallery) {
      changes = changes.set(id, gallery)
    }
  })

  map_prev.forEach((gallery, id) => {
    if (!map_new.has(id)) {
      dels = dels.set(id, gallery)
    }
  })

  return { adds, changes, dels }
}

export function maxEntityId(pool: Pool): number {
  let max = Number(pool.next_id) - 1

  pool.galleries.forEach((gallery) => {
    if (Number(gallery.id) > max) {
      max = Number(gallery.id)
    }
    gallery.photos.forEach((photo) => {
      if (Number(photo.id) > max) {
        max = Number(photo.id)
      }
    })
    gallery.vote_records.forEach((vote) => {
      if (Number(vote.id) > max) {
        max = Number(vote.id)
      }
    })
  })
  pool.members.forEach((member) => {
    if (Number(member.id) > max) {
      max = Number(member.id)
    }
  })

  return max
}

export function createPool(galleries: Gallery[], members: Member[]): Pool {
  const pool: Pool = {
    schema_version: CURRENT_SCHEMA_VERSION,
    next_id: asNextID(1),
    galleries: Immutable.Map<GalleryID, Gallery>(
      galleries.map((gallery) => [gallery.id, gallery]),
    ),
    members: Immutable.Map<QQNumber, Member>(
      members.map((member) => [member.qq_num, member]),
    ),
  }

  return {
    ...pool,
    next_id: asNextID(maxEntityId(pool) + 1),
  }
}

export function updatePool(pool: Pool, items: Partial<Pool>): Pool {
  return { ...pool, ...items }
}

export function allocateId(pool: Pool): { pool: Pool; id: number } {
  const id = Number(pool.next_id)
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('next_id 已溢出或非法')
  }
  return {
    pool: updatePool(pool, { next_id: asNextID(id + 1) }),
    id,
  }
}

export function findGalleryOrNull(pool: Pool, gallery_id: GalleryID): Gallery | undefined {
  return pool.galleries.get(gallery_id)
}

export function findGallery(pool: Pool, gallery_id: GalleryID): Gallery {
  const gallery = findGalleryOrNull(pool, gallery_id)
  if (gallery === undefined) {
    throw notFound(`相册(id=${gallery_id})不存在`)
  }
  return gallery
}

export function findMemberByIdOrNull(pool: Pool, member_id: MemberID): Member | undefined {
  return pool.members.find((member) => member.id === member_id)
}

export function findMemberById(pool: Pool, member_id: MemberID): Member {
  const member = findMemberByIdOrNull(pool, member_id)
  if (member === undefined) {
    throw notFound(`成员(id=${member_id})不存在`)
  }
  return member
}

export function findMemberByQQOrNull(pool: Pool, qq_num: QQNumber): Member | undefined {
  return pool.members.get(qq_num)
}

export function findMemberByQQ(pool: Pool, qq_num: QQNumber): Member {
  const member = findMemberByQQOrNull(pool, qq_num)
  if (member === undefined) {
    throw notFound(`成员(QQ=${qq_num})不存在`)
  }
  return member
}

export function findPhotoOrNull(
  pool: Pool,
  photo_id: PhotoID,
): { gallery: Gallery; photo: Photo } | undefined {
  let found: { gallery: Gallery; photo: Photo } | undefined
  pool.galleries.forEach((gallery) => {
    if (found !== undefined) {
      return
    }
    const photo = gallery.photos.get(photo_id)
    if (photo !== undefined) {
      found = { gallery, photo }
    }
  })
  return found
}

export function findPhoto(
  pool: Pool,
  photo_id: PhotoID,
): { gallery: Gallery; photo: Photo } {
  const found = findPhotoOrNull(pool, photo_id)
  if (found === undefined) {
    throw notFound(`相片(id=${photo_id})不存在`)
  }
  return found
}

export function memberHasReferences(pool: Pool, member_id: MemberID): boolean {
  let found = false
  pool.galleries.forEach((gallery) => {
    if (found) {
      return
    }
    if (
      memberHasSubmitted(gallery, member_id) ||
      memberHasVoted(gallery, member_id)
    ) {
      found = true
    }
  })
  return found
}

export function poolGalleriesSorted(pool: Pool): Gallery[] {
  return pool.galleries
    .valueSeq()
    .toArray()
    .sort((left, right) => {
      const index_diff = right.index - left.index
      return index_diff !== 0 ? index_diff : Number(left.id) - Number(right.id)
    })
}

export function poolMembersSorted(pool: Pool): Member[] {
  return pool.members
    .valueSeq()
    .toArray()
    .sort((left, right) => Number(left.id) - Number(right.id))
}

export function poolAllPhotos(pool: Pool): Array<{ gallery: Gallery; photo: Photo }> {
  const result: Array<{ gallery: Gallery; photo: Photo }> = []
  pool.galleries.forEach((gallery) => {
    gallery.photos.forEach((photo) => {
      result.push({ gallery, photo })
    })
  })
  return result
}

export function poolAllVotes(pool: Pool): Array<{ gallery: Gallery; vote: Vote }> {
  const result: Array<{ gallery: Gallery; vote: Vote }> = []
  pool.galleries.forEach((gallery) => {
    gallery.vote_records.forEach((vote) => {
      result.push({ gallery, vote })
    })
  })
  return result
}

export function poolMemberVotes(gallery: Gallery, member_id: MemberID): Vote[] {
  return galleryVotesForMember(gallery, member_id)
}

export function poolPhotoVotes(gallery: Gallery, photo_id: PhotoID): Vote[] {
  return galleryVotesForPhoto(gallery, photo_id)
}

export function poolPhotoVoteCount(gallery: Gallery, photo_id: PhotoID): number {
  return voteCountByPhoto(gallery, photo_id)
}

export function poolPhotosSorted(gallery: Gallery): Photo[] {
  return galleryPhotosSorted(gallery)
}

export type GalleryCreateInput = {
  name: string
  index: number
  vote_limit: number
  event_start: Date
  submission_expire: Date
  event_end: Date
}

export function poolCreateGallery(
  pool: Pool,
  now: Date,
  input: GalleryCreateInput,
): { pool: Pool; gallery: Gallery } {
  const allocated = allocateId(pool)
  const gallery = checkGallery({
    id: asGalleryID(allocated.id),
    index: input.index,
    name: input.name,
    vote_limit: input.vote_limit,
    event_start: input.event_start,
    submission_expire: input.submission_expire,
    event_end: input.event_end,
    photos: Immutable.Map<PhotoID, Photo>(),
    vote_records: Immutable.List<Vote>(),
    created_at: now,
    updated_at: now,
  })

  return {
    pool: updatePool(allocated.pool, {
      galleries: allocated.pool.galleries.set(gallery.id, gallery),
    }),
    gallery,
  }
}

export type GalleryUpdateInput = Partial<GalleryCreateInput>

export function poolUpdateGallery(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
  input: GalleryUpdateInput,
): { pool: Pool; gallery: Gallery } {
  const current = findGallery(pool, gallery_id)
  const gallery = checkGallery({
    ...current,
    ...input,
    updated_at: now,
  })

  return {
    pool: updatePool(pool, {
      galleries: pool.galleries.set(gallery.id, gallery),
    }),
    gallery,
  }
}

export function poolRemoveGallery(pool: Pool, gallery_id: GalleryID): { pool: Pool; gallery: Gallery } {
  const gallery = findGallery(pool, gallery_id)
  return {
    pool: updatePool(pool, {
      galleries: pool.galleries.remove(gallery_id),
    }),
    gallery,
  }
}

export type MemberCreateInput = {
  qq_num: number
  name: string
  avatar_src: string
}

export function poolCreateMember(
  pool: Pool,
  now: Date,
  input: MemberCreateInput,
): { pool: Pool; member: Member } {
  const qq_num = asQQNumber(input.qq_num)
  if (pool.members.has(qq_num)) {
    throw conflict(`成员(QQ=${input.qq_num})已存在`)
  }

  const allocated = allocateId(pool)
  const member = createMember({
    id: asMemberID(allocated.id),
    qq_num: input.qq_num,
    name: input.name,
    avatar_src: input.avatar_src,
  }, now)

  return {
    pool: updatePool(allocated.pool, {
      members: allocated.pool.members.set(member.qq_num, member),
    }),
    member,
  }
}

export function poolUpdateMember(
  pool: Pool,
  now: Date,
  member_id: MemberID,
  input: MemberUpdate,
): { pool: Pool; member: Member } {
  const current = findMemberById(pool, member_id)
  const updated = updateMember(current, input, now)
  const members = pool.members.set(current.qq_num, updated)

  return {
    pool: updatePool(pool, { members }),
    member: updated,
  }
}

export function assertCanRemoveMember(pool: Pool, member_id: MemberID): Member {
  const member = findMemberById(pool, member_id)
  if (memberHasReferences(pool, member_id)) {
    throw conflict('该成员还有投稿或投票，不能删除')
  }
  return member
}

export function poolDeleteMember(
  pool: Pool,
  member_id: MemberID,
): { pool: Pool; member: Member } {
  const member = assertCanRemoveMember(pool, member_id)
  return {
    pool: updatePool(pool, {
      members: pool.members.remove(member.qq_num),
    }),
    member,
  }
}

function assertNextPhotoId(pool: Pool, photo: Photo): void {
  if (Number(photo.id) !== Number(pool.next_id)) {
    throw new Error('相片 id 必须等于当前 next_id')
  }
}

export function poolAddPhoto(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
  photo_input: PhotoDraft,
): { pool: Pool; gallery: Gallery; photo: Photo } {
  const gallery = findGallery(pool, gallery_id)
  findMemberById(pool, photo_input.member_id)

  if (memberHasSubmitted(gallery, photo_input.member_id)) {
    throw conflict('该成员在这个相册已经有投稿了')
  }

  const photo = createPhoto(photo_input, now)
  assertNextPhotoId(pool, photo)

  const next_gallery = checkGallery({
    ...gallery,
    photos: gallery.photos.set(photo.id, photo),
    updated_at: now,
  })

  return {
    pool: updatePool(pool, {
      next_id: asNextID(Number(pool.next_id) + 1),
      galleries: pool.galleries.set(gallery_id, next_gallery),
    }),
    gallery: next_gallery,
    photo,
  }
}

export function poolSubmitPhoto(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
  member_id: MemberID,
  photo_input: PhotoDraft,
): { pool: Pool; gallery: Gallery; photo: Photo } {
  const gallery = findGallery(pool, gallery_id)
  findMemberById(pool, member_id)

  const photo = createPhoto(photo_input, now)
  assertNextPhotoId(pool, photo)
  const next_gallery = gallerySetSubmission(now, gallery, member_id, photo)

  return {
    pool: updatePool(pool, {
      next_id: asNextID(Number(pool.next_id) + 1),
      galleries: pool.galleries.set(gallery_id, next_gallery),
    }),
    gallery: next_gallery,
    photo,
  }
}

export type PhotoUpdateInput = {
  index?: number
  desc?: string
  src?: string
  width?: number
  height?: number
  has_hdr_optimized?: boolean
  member_id?: MemberID
}

export function poolUpdatePhoto(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
  photo_id: PhotoID,
  input: PhotoUpdateInput,
): { pool: Pool; gallery: Gallery; photo: Photo } {
  const gallery = findGallery(pool, gallery_id)
  galleryPhoto(gallery, photo_id)

  if (input.member_id !== undefined) {
    findMemberById(pool, input.member_id)
  }

  const patch: PhotoUpdateInput = {
    ...(input.index === undefined ? {} : { index: input.index }),
    ...(input.desc === undefined ? {} : { desc: input.desc }),
    ...(input.src === undefined ? {} : { src: input.src }),
    ...(input.width === undefined ? {} : { width: input.width }),
    ...(input.height === undefined ? {} : { height: input.height }),
    ...(input.has_hdr_optimized === undefined ? {} : { has_hdr_optimized: input.has_hdr_optimized }),
    ...(input.member_id === undefined ? {} : { member_id: input.member_id }),
  }
  const next_gallery = galleryUpdatePhoto(now, gallery, photo_id, patch)
  return {
    pool: updatePool(pool, {
      galleries: pool.galleries.set(gallery_id, next_gallery),
    }),
    gallery: next_gallery,
    photo: galleryPhoto(next_gallery, photo_id),
  }
}

export function poolRemovePhoto(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
  photo_id: PhotoID,
): { pool: Pool; gallery: Gallery; photo: Photo } {
  const gallery = findGallery(pool, gallery_id)
  const photo = galleryPhoto(gallery, photo_id)
  const next_gallery = galleryRemovePhoto(now, gallery, photo_id)
  return {
    pool: updatePool(pool, {
      galleries: pool.galleries.set(gallery_id, next_gallery),
    }),
    gallery: next_gallery,
    photo,
  }
}

export function poolSubmitVotes(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
  member_id: MemberID,
  photo_ids: readonly PhotoID[],
): { pool: Pool; gallery: Gallery; votes: Vote[] } {
  const gallery = findGallery(pool, gallery_id)
  findMemberById(pool, member_id)

  if (photo_ids.length === 0) {
    throw badRequest('至少需要选择一张相片')
  }
  for (const photo_id of photo_ids) {
    if (!gallery.photos.has(photo_id)) {
      throw notFound(`相片(id=${photo_id})不属于该相册`)
    }
  }

  const base = Number(pool.next_id)
  const vote_ids = photo_ids.map((_, index) => asVoteID(base + index))
  const next_gallery = gallerySubmitVotes(
    now,
    gallery,
    member_id,
    vote_ids,
    photo_ids,
  )

  const votes = next_gallery.vote_records
    .filter((vote) => vote_ids.includes(vote.id))
    .toArray()

  return {
    pool: updatePool(pool, {
      next_id: asNextID(base + photo_ids.length),
      galleries: pool.galleries.set(gallery_id, next_gallery),
    }),
    gallery: next_gallery,
    votes,
  }
}

export function poolClearMemberGalleryVotes(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
  member_id: MemberID,
): { pool: Pool; gallery: Gallery; removed: Vote[] } {
  const gallery = findGallery(pool, gallery_id)
  findMemberById(pool, member_id)
  const removed = galleryVotesForMember(gallery, member_id)
  const next_gallery = galleryClearMemberVotes(now, gallery, member_id)
  return {
    pool: updatePool(pool, {
      galleries: pool.galleries.set(gallery_id, next_gallery),
    }),
    gallery: next_gallery,
    removed,
  }
}

export function poolSortPhotosByVoteCount(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
): { pool: Pool; gallery: Gallery } {
  const gallery = findGallery(pool, gallery_id)
  const next_gallery = gallerySortPhotosByVoteCount(now, gallery)
  return {
    pool: updatePool(pool, {
      galleries: pool.galleries.set(gallery_id, next_gallery),
    }),
    gallery: next_gallery,
  }
}

export function poolRemoveSubmission(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
  member_id: MemberID,
  photo_id: PhotoID,
): { pool: Pool; gallery: Gallery; photo: Photo } {
  const gallery = findGallery(pool, gallery_id)
  const photo = galleryPhoto(gallery, photo_id)
  const next_gallery = galleryRemoveSubmission(now, gallery, member_id, photo_id)
  return {
    pool: updatePool(pool, {
      galleries: pool.galleries.set(gallery_id, next_gallery),
    }),
    gallery: next_gallery,
    photo,
  }
}

export function poolCreateEmpty(): Pool {
  return createPool([], [])
}
