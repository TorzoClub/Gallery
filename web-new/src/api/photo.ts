import { mutate, query } from './dispatch'

type ID = number
type DateTimeString = string

export type Member = {
  id: ID
  created_at: DateTimeString
  updated_at: DateTimeString
  name: string
  qq_num: number
  avatar_thumb_url: string
}

type WireMember = Member & {
  avatar_src: string
  avatar_thumb: string
}

type PhotoCommon = {
  id: ID
  gallery_id: ID
  created_at: DateTimeString
  updated_at: DateTimeString
  index: number
  vote_count: number
  desc: string
  height: number
  width: number
  src: string
  format: string
  src_url: string
  thumb: string
  thumb_url: string
}

export type PhotoNormal = PhotoCommon & {
  member: Member
  member_id: ID
}

export type PhotoInActive = PhotoCommon & {
  member: null
  member_id: null
  is_voted: boolean
}

export type Photo = PhotoNormal | PhotoInActive

type WirePhoto = PhotoCommon & {
  member_id: ID
  member: WireMember | null
  is_voted?: boolean
}

export const normal2InActive = (p: PhotoNormal): PhotoInActive => ({
  ...p,
  is_voted: false,
  member: null,
  member_id: null,
})

export type GalleryCommon = {
  id: ID
  created_at: DateTimeString
  index: number
  name: string
  event_start: DateTimeString
  event_end: DateTimeString
  submission_expire: DateTimeString
  vote_limit: number
  vote_submitted: boolean
}

export type GalleryNormal = GalleryCommon & {
  photos: PhotoNormal[]
  in_event: false
  can_submission: false
}

export type GalleryInActive = GalleryCommon & {
  photos: PhotoInActive[]
  in_event: true
  can_submission: boolean
}

export type Gallery = GalleryInActive | GalleryNormal

type WireGallery = Omit<GalleryCommon, 'vote_submitted'> & {
  photos: WirePhoto[]
  in_event: boolean
  can_submission: boolean
  vote_submitted?: boolean
}

type WireHome = {
  active: WireGallery | null
  galleries: WireGallery[]
}

export type fetchListResult = {
  active: GalleryInActive | null
  galleries: GalleryNormal[]
}

export type fetchListWithQQNumResult = fetchListResult

export function normalizePhotoNormal(photo: WirePhoto): PhotoNormal {
  if (photo.member === null) {
    throw new Error('相片缺少成员信息')
  }
  return {
    ...photo,
    member_id: photo.member_id,
    member: photo.member,
  }
}

function toActivePhoto(photo: WirePhoto): PhotoInActive {
  const { member: _member, ...rest } = photo
  return {
    ...rest,
    member_id: null,
    member: null,
    is_voted: Boolean(photo.is_voted),
  }
}

function toActiveGallery(gallery: WireGallery): GalleryInActive {
  return {
    ...gallery,
    in_event: true,
    vote_submitted: Boolean(gallery.vote_submitted),
    photos: gallery.photos.map(toActivePhoto),
  }
}

function toNormalGallery(gallery: WireGallery): GalleryNormal {
  return {
    ...gallery,
    in_event: false,
    can_submission: false,
    vote_submitted: Boolean(gallery.vote_submitted),
    photos: gallery.photos.map(normalizePhotoNormal),
  }
}

function normalizeHome(data: WireHome): fetchListResult {
  return {
    active: data.active === null ? null : toActiveGallery(data.active),
    galleries: data.galleries.map(toNormalGallery),
  }
}

export const fetchList = () => query<WireHome>('listGalleries')
  .then(normalizeHome)

export function fetchListWithQQNum(qq_num: number): Promise<fetchListWithQQNumResult> {
  return query<WireHome>('getMemberPhotos', { qq_num }).then(normalizeHome)
}

export function vote({
  gallery_id,
  photo_id_list,
  qq_num,
}: {
  gallery_id: number
  photo_id_list: number[]
  qq_num: number
}) {
  return mutate('vote', {
    gallery_id,
    qq_num,
    photo_ids: photo_id_list,
  })
}

export function submitPhoto(input: {
  gallery_id: number
  qq_num: number
  desc: string
  temp_id: string
}): Promise<PhotoNormal> {
  return mutate<WirePhoto>('submitPhoto', input).then(normalizePhotoNormal)
}

export function updateSubmission(input: {
  photo_id: number
  qq_num: number
  desc?: string
  temp_id?: string
}): Promise<PhotoNormal> {
  return mutate<WirePhoto>('updateSubmission', input).then(normalizePhotoNormal)
}

export function cancelMySubmission(p: { qq_num: number | string; photo_id: number | string }) {
  return mutate('cancelSubmission', {
    photo_id: Number(p.photo_id),
    qq_num: Number(p.qq_num),
  })
}

// The new API serves an AVIF thumbnail directly. Keep this helper for callers
// that used to swap source extensions for next-generation variants.
export function toOptimizedImageType(picture_url: string): string {
  return picture_url
}

export function canUseCacheWorker(): boolean {
  const cacheWorkerURL = import.meta.env.VITE_CACHE_WORKER_URL
  if (import.meta.env.DEV) {
    return false
  } else if (typeof cacheWorkerURL !== 'string' || cacheWorkerURL.length === 0) {
    return false
  } else {
    return true
  }
}

export function transformCacheWorkerURL(picture_url: string): string {
  if (canUseCacheWorker()) {
    return `${import.meta.env.VITE_CACHE_WORKER_URL}?target=${encodeURIComponent(picture_url)}`
  } else {
    return picture_url
  }
}
