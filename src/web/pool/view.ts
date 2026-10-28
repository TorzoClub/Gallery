import type {
  ClientGallery,
  ClientGalleryInEvent,
  ClientMember,
  ClientMemberView,
  ClientPhoto,
  ClientPhotoInEvent,
  ClientPool,
  ClientVote,
} from '@shared/client-pool'
import {
  memberAvatarUrl,
  photoOptimizedUrl,
  photoSourceUrl,
  photoThumbUrl,
} from './media'
import {
  canSubmit,
  canVote,
  memberById,
  memberMap,
  type MemberIndex,
} from './selectors'

export type MemberView = ClientMember & {
  avatar_thumb: string
  avatar_thumb_url: string
}

export type PhotoView = {
  id: number
  gallery_id: number
  index: number
  desc: string
  src: string
  format: string
  width: number
  height: number
  has_hdr_optimized: boolean
  member_id: number | null
  member: MemberView | null
  src_url: string
  src_optimized: string
  src_optimized_hdr: null
  vote_count: number
  thumb: string
  thumb_url: string
  is_voted: boolean
  created_at: string
  updated_at: string
}

export type GalleryView = {
  id: number
  index: number
  name: string
  vote_limit: number
  event_start: string
  submission_expire: string
  event_end: string
  created_at: string
  updated_at: string
  in_event: boolean
  can_submission: boolean
  can_vote: boolean
  vote_submitted: boolean
  photos: PhotoView[]
  vote_records?: ClientVote[]
}


function toMemberView(pool: ClientPool, member: ClientMember): MemberView {
  const avatar_thumb = member.avatar_src.replace(/\.([^.]+)$/, '.avif')
  return {
    ...member,
    avatar_thumb,
    avatar_thumb_url: memberAvatarUrl(pool, member),
  }
}

export function toPhotoView(
  pool: ClientPool,
  gallery_id: number,
  photo: ClientPhoto | ClientPhotoInEvent,
  members: MemberIndex,
  member_view: ClientMemberView | null,
): PhotoView {
  const member = memberById(members, photo.member_id)
  const member_view_data = member === null ? null : toMemberView(pool, member)
  const thumb = photoThumbUrl(pool, photo)
  return {
    id: photo.id,
    gallery_id,
    index: photo.index,
    desc: photo.desc,
    src: photo.src,
    format: photo.format,
    width: photo.width,
    height: photo.height,
    has_hdr_optimized: photo.has_hdr_optimized,
    member_id: photo.member_id,
    member: member_view_data,
    src_url: photoSourceUrl(pool, photo),
    src_optimized: photoOptimizedUrl(pool, photo),
    src_optimized_hdr: null,
    vote_count: 0,
    thumb,
    thumb_url: thumb,
    is_voted: member_view?.voted_photo_ids.includes(photo.id) ?? false,
    created_at: photo.created_at,
    updated_at: photo.updated_at,
  }
}

export function toGalleryView(
  pool: ClientPool,
  gallery: ClientGallery | ClientGalleryInEvent,
  members: MemberIndex,
  member_view: ClientMemberView | null,
  now = Date.now(),
): GalleryView {
  return {
    id: gallery.id,
    index: gallery.index,
    name: gallery.name,
    vote_limit: gallery.vote_limit,
    event_start: gallery.event_start,
    submission_expire: gallery.submission_expire,
    event_end: gallery.event_end,
    created_at: gallery.created_at,
    updated_at: gallery.updated_at,
    in_event: gallery.in_event,
    can_submission: canSubmit(gallery, now),
    can_vote: canVote(gallery, now),
    vote_submitted: member_view?.vote_submitted ?? false,
    photos: gallery.photos.map(photo => toPhotoView(pool, gallery.id, photo, members, member_view)),
    ...(gallery.in_event ? {} : { vote_records: gallery.vote_records }),
  }
}

export function submittedPhotoView(
  pool: ClientPool,
  member_view: ClientMemberView | null,
): PhotoView | null {
  if (member_view === null || member_view.active_gallery_id === null) {
    return null
  }
  const gallery = pool.galleries.find(item => item.id === member_view.active_gallery_id)
  if (gallery === undefined) {
    return null
  }
  const submitted = member_view.submitted_photo
  if (submitted === null) {
    return null
  }
  const photo = gallery.photos.find(item => item.id === submitted.id)
  if (photo === undefined) {
    return null
  }
  return toPhotoView(pool, gallery.id, photo, memberMap(pool), member_view)
}

export function toGalleryViews(
  pool: ClientPool,
  member_view: ClientMemberView | null,
  now = Date.now(),
): GalleryView[] {
  const members = memberMap(pool)
  return pool.galleries.map(gallery => toGalleryView(pool, gallery, members, member_view, now))
}
