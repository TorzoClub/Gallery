import request from 'utils/request'

type ID = number
type DateTimeString = string

export type Member = {
  id: ID
  created_at: DateTimeString
  updated_at: DateTimeString
  name: string
  qq_num: number
  // avatar_src: string
  // avatar_thumb: string
  avatar_thumb_url: string
}

type PhotoCommon = {
  id: ID
  gallery_id: ID
  created_at: DateTimeString
  updated_at: DateTimeString
  index: number

  vote_count: number
  desc: string

  // is_voted: boolean

  height: number
  width: number
  // src: string
  // src_urlpath: string
  src_url: string

  // thumb: string
  // thumb_urlpath: string
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

export const normal2InActive = (p: PhotoNormal): PhotoInActive => ({
  ...p,
  is_voted: false,
  member: null,
  member_id: null,
})

type GalleryCommon = {
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

export type fetchListResult = {
  active: GalleryInActive | null
  galleries: GalleryNormal[]
}
export const fetchList = () => request<fetchListResult>({
  method: 'GET',
  url: 'photo/'
})

export type fetchListWithQQNumResult = {
  active: GalleryInActive | null
  galleries: GalleryNormal[]
}
export const fetchListWithQQNum = (qq_num: number) => request<fetchListWithQQNumResult>({
  method: 'POST',
  url: 'member/photo',
  data: { qq_num }
})

export const vote = ({
  gallery_id,
  photo_id_list,
  qq_num
}: {
  gallery_id: number
  photo_id_list: number[]
  qq_num: number
}) => request({
  method: 'POST',
  url: 'member/vote',
  data: {
    gallery_id,
    photo_id_list,
    qq_num
  }
})

export const cancelMySubmission = (p: { qq_num: number | string; photo_id: number | string }) => request({
  method: 'DELETE',
  url: `photo/${p.photo_id}?qq_num=${encodeURIComponent(p.qq_num)}`
})
