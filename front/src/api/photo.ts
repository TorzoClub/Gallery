import { appInitInfomation } from 'App'
import { Memo } from 'new-vait'
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
  src: string
  src_urlpath: string
  src_url: string

  thumb: string
  thumb_urlpath: string
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

export type fetchListResult = {
  active: GalleryInActive | null
  galleries: GalleryNormal[]
}
export const fetchList = () => request<fetchListResult>({
  method: 'GET',
  url: 'photo/'
}).then(transformListPictureType)

function transformListPictureType(data: fetchListResult | fetchListWithQQNumResult) {
  if (data.active) {
    transformPhotoListPictureType(data.active.photos)
    data.active.photos = transformPhotoListPictureType(data.active.photos)
  }

  data.galleries = data.galleries.map(gallery => {
    gallery.photos = transformPhotoListPictureType(gallery.photos)
    gallery.photos = transformMemberPictureType(gallery.photos)
    return gallery
  })

  return data
}

function transformMemberPictureType<T extends PhotoNormal>(list: T[]) {
  return list.map(photo => {
    photo.member.avatar_thumb_url = selectPictureType(photo.member.avatar_thumb_url)
    return photo
  })
}

function transformPhotoListPictureType<T extends PhotoCommon>(list: T[]) {
  return (
    list.map(photo => {
      return {
        ...photo,
        thumb: selectPictureType(photo.thumb),
        thumb_url: selectPictureType(photo.thumb_url),
        thumb_urlpath: selectPictureType(photo.thumb_urlpath),
      }
    })
  )
}

function selectPictureType(picture_url: string) {
  const [ getAppInitInfo ] = appInitInfomation
  const { avif, webp } = getAppInitInfo().picutre_support
  if (avif) {
    return picture_url.replace('.jpg', '.avif')
  } else if (webp) {
    return picture_url.replace('.jpg', '.webp')
  } else {
    return picture_url
  }
}

export type fetchListWithQQNumResult = {
  active: GalleryInActive | null
  galleries: GalleryNormal[]
}
export const fetchListWithQQNum = (qq_num: number) => request<fetchListWithQQNumResult>({
  method: 'POST',
  url: 'member/photo',
  data: { qq_num }
}).then(transformListPictureType)

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
