import Immutable from 'immutable'
import {
  type GalleryID,
  type MemberID,
  type PhotoID,
  type VoteID,
} from '../common/ID'
import { badRequest, conflict, forbidden, notFound } from '../common/error'
import { formatFromFilename } from '../common/image-name'
import { checkPhoto, type Photo } from './Photo'

export type Vote = {
  id: VoteID
  photo_id: PhotoID
  member_id: MemberID
  created_at: Date
  updated_at: Date
}

export type Gallery = {
  id: GalleryID
  index: number
  name: string
  vote_limit: number
  event_start: Date
  submission_expire: Date
  event_end: Date
  photos: Immutable.Map<PhotoID, Photo>
  vote_records: Immutable.List<Vote>
  created_at: Date
  updated_at: Date
}

function checkDate(name: string, value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${name} 不是合法日期`)
  }
}

function checkVote(vote: Vote): Vote {
  if (!Number.isSafeInteger(vote.id) || vote.id <= 0) {
    throw badRequest('投票 id 必须是正整数')
  }
  if (!Number.isSafeInteger(vote.photo_id) || vote.photo_id <= 0) {
    throw badRequest('投票的 photo_id 必须是正整数')
  }
  if (!Number.isSafeInteger(vote.member_id) || vote.member_id <= 0) {
    throw badRequest('投票的 member_id 必须是正整数')
  }
  checkDate('created_at', vote.created_at)
  checkDate('updated_at', vote.updated_at)
  return vote
}

export function checkGallery(gallery: Gallery): Gallery {
  if (!Number.isSafeInteger(gallery.id) || gallery.id <= 0) {
    throw badRequest('相册 id 必须是正整数')
  }
  if (!Number.isSafeInteger(gallery.index) || gallery.index < 0) {
    throw badRequest('相册 index 必须是非负整数')
  }

  const name = gallery.name.trim()
  if (name.length === 0) {
    throw badRequest('相册名称不能为空')
  }

  if (!Number.isSafeInteger(gallery.vote_limit) || gallery.vote_limit < 0) {
    throw badRequest('vote_limit 必须是非负整数')
  }

  checkDate('event_start', gallery.event_start)
  checkDate('submission_expire', gallery.submission_expire)
  checkDate('event_end', gallery.event_end)
  checkDate('created_at', gallery.created_at)
  checkDate('updated_at', gallery.updated_at)

  if (!(
    gallery.event_start.getTime() < gallery.submission_expire.getTime() &&
    gallery.submission_expire.getTime() < gallery.event_end.getTime()
  )) {
    throw badRequest('event_start、submission_expire、event_end 必须依次递增')
  }

  if (!Immutable.Map.isMap(gallery.photos) || !Immutable.List.isList(gallery.vote_records)) {
    throw new Error('gallery 的 photos/vote_records 不是 Immutable 结构')
  }

  gallery.photos.forEach((photo) => checkPhoto(photo))
  gallery.vote_records.forEach((vote) => checkVote(vote))

  return { ...gallery, name }
}

function updateGallery(gallery: Gallery, items: Partial<Gallery>, now: Date): Gallery {
  return checkGallery({
    ...gallery,
    ...items,
    updated_at: now,
  })
}

export function galleryInEvent(now: Date, gallery: Gallery): boolean {
  return (
    now.getTime() >= gallery.event_start.getTime() &&
    now.getTime() <= gallery.event_end.getTime()
  )
}

export function galleryCanSubmission(now: Date, gallery: Gallery): boolean {
  return (
    galleryInEvent(now, gallery) &&
    now.getTime() < gallery.submission_expire.getTime()
  )
}

export function galleryInVotingPeriod(now: Date, gallery: Gallery): boolean {
  return (
    galleryInEvent(now, gallery) &&
    now.getTime() >= gallery.submission_expire.getTime()
  )
}

export function voteCountByPhoto(gallery: Gallery, photo_id: PhotoID): number {
  return gallery.vote_records.count((vote) => vote.photo_id === photo_id)
}

export function memberHasVoted(gallery: Gallery, member_id: MemberID): boolean {
  return gallery.vote_records.some((vote) => vote.member_id === member_id)
}

export function memberHasSubmitted(gallery: Gallery, member_id: MemberID): boolean {
  return gallery.photos.some((photo) => photo.member_id === member_id)
}

export function galleryPhotoByMember(
  gallery: Gallery,
  member_id: MemberID,
): Photo | undefined {
  return gallery.photos.find((photo) => photo.member_id === member_id)
}

export function galleryPhoto(gallery: Gallery, photo_id: PhotoID): Photo {
  const photo = gallery.photos.get(photo_id)
  if (photo === undefined) {
    throw notFound(`相片(id=${photo_id})不存在`)
  }
  return photo
}

export function gallerySetSubmission(
  now: Date,
  gallery: Gallery,
  member_id: MemberID,
  photo: Photo,
): Gallery {
  if (!galleryCanSubmission(now, gallery)) {
    throw forbidden('当前不在投稿期间，不能投稿')
  }
  if (memberHasSubmitted(gallery, member_id)) {
    throw conflict('该成员已经在这个相册投过稿了')
  }
  if (gallery.photos.has(photo.id)) {
    throw conflict(`相片(id=${photo.id})已经存在`)
  }
  if (photo.member_id !== member_id) {
    throw badRequest('相片的 member_id 与投稿成员不一致')
  }

  return updateGallery(gallery, {
    photos: gallery.photos.set(photo.id, photo),
  }, now)
}

export function galleryRemoveSubmission(
  now: Date,
  gallery: Gallery,
  member_id: MemberID,
  photo_id: PhotoID,
): Gallery {
  if (!galleryCanSubmission(now, gallery)) {
    throw forbidden('当前不在投稿期间，不能取消投稿')
  }

  const photo = gallery.photos.get(photo_id)
  if (photo === undefined) {
    throw notFound(`相片(id=${photo_id})不存在`)
  }
  if (photo.member_id !== member_id) {
    throw forbidden('不能取消其他成员的投稿')
  }

  return updateGallery(gallery, {
    photos: gallery.photos.remove(photo_id),
    vote_records: gallery.vote_records.filter((vote) => vote.photo_id !== photo_id),
  }, now)
}

export function gallerySubmitVotes(
  now: Date,
  gallery: Gallery,
  member_id: MemberID,
  vote_ids: readonly VoteID[],
  photo_ids: readonly PhotoID[],
): Gallery {
  if (!galleryInVotingPeriod(now, gallery)) {
    throw forbidden('当前不在投票期间，不能投票')
  }
  if (memberHasVoted(gallery, member_id)) {
    throw conflict('该成员已经在这个相册投过票了')
  }
  if (photo_ids.length === 0) {
    throw badRequest('至少需要选择一张相片')
  }
  if (vote_ids.length !== photo_ids.length) {
    throw new Error('vote_ids 与 photo_ids 数量不一致')
  }

  const unique_photo_ids = new Set(photo_ids)
  if (unique_photo_ids.size !== photo_ids.length) {
    throw badRequest('不能重复选择同一张相片')
  }

  if (gallery.vote_limit !== 0 && photo_ids.length > gallery.vote_limit) {
    throw forbidden(`一次最多只能投 ${gallery.vote_limit} 张相片`)
  }

  for (const photo_id of photo_ids) {
    if (!gallery.photos.has(photo_id)) {
      throw notFound(`相片(id=${photo_id})不属于该相册`)
    }
  }

  const votes = photo_ids.map((photo_id, index) => {
    const id = vote_ids[index]
    if (id === undefined) {
      throw new Error('投票 id 分配失败')
    }
    return checkVote({
      id,
      photo_id,
      member_id,
      created_at: now,
      updated_at: now,
    })
  })

  return updateGallery(gallery, {
    vote_records: gallery.vote_records.push(...votes),
  }, now)
}

export function galleryClearMemberVotes(
  now: Date,
  gallery: Gallery,
  member_id: MemberID,
): Gallery {
  return updateGallery(gallery, {
    vote_records: gallery.vote_records.filter((vote) => vote.member_id !== member_id),
  }, now)
}

export function galleryUpdatePhoto(
  now: Date,
  gallery: Gallery,
  photo_id: PhotoID,
  patch: Partial<Omit<Photo, 'id' | 'created_at' | 'updated_at'>>,
): Gallery {
  const current = galleryPhoto(gallery, photo_id)
  const next_src = patch.src ?? current.src
  const format = formatFromFilename(next_src)
  if (format === null) {
    throw badRequest('相片 src 的格式不受支持')
  }
  const next_photo = checkPhoto({
    ...current,
    ...patch,
    src: next_src,
    format,
    id: current.id,
    created_at: current.created_at,
    updated_at: now,
  })

  if (next_photo.member_id !== current.member_id) {
    const other = gallery.photos.find(
      (photo) => photo.id !== photo_id && photo.member_id === next_photo.member_id,
    )
    if (other !== undefined) {
      throw conflict('目标成员在这个相册已经有投稿了')
    }
  }

  return updateGallery(gallery, {
    photos: gallery.photos.set(photo_id, next_photo),
  }, now)
}

export function galleryRemovePhoto(
  now: Date,
  gallery: Gallery,
  photo_id: PhotoID,
): Gallery {
  galleryPhoto(gallery, photo_id)
  return updateGallery(gallery, {
    photos: gallery.photos.remove(photo_id),
    vote_records: gallery.vote_records.filter((vote) => vote.photo_id !== photo_id),
  }, now)
}

export function gallerySortPhotosByVoteCount(
  now: Date,
  gallery: Gallery,
): Gallery {
  const sorted = gallery.photos
    .valueSeq()
    .toArray()
    .sort((left, right) => {
      const diff = voteCountByPhoto(gallery, right.id) - voteCountByPhoto(gallery, left.id)
      if (diff !== 0) {
        return diff
      }
      return Number(left.id) - Number(right.id)
    })

  const photos = Immutable.Map<PhotoID, Photo>(
    sorted.map((photo, index) => [
      photo.id,
      checkPhoto({ ...photo, index, updated_at: now }),
    ] as const),
  )

  return updateGallery(gallery, { photos }, now)
}

export function galleryPhotosSorted(gallery: Gallery): Photo[] {
  return gallery.photos
    .valueSeq()
    .toArray()
    .sort((left, right) => {
      const index_diff = left.index - right.index
      return index_diff !== 0 ? index_diff : Number(left.id) - Number(right.id)
    })
}

export function galleryVotesForMember(gallery: Gallery, member_id: MemberID): Vote[] {
  return gallery.vote_records.filter((vote) => vote.member_id === member_id).toArray()
}

export function galleryVotesForPhoto(gallery: Gallery, photo_id: PhotoID): Vote[] {
  return gallery.vote_records.filter((vote) => vote.photo_id === photo_id).toArray()
}
