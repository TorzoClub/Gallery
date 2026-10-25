export type ID = number
export type DateTimeString = string

export type MemberDTO = {
  id: ID
  qq_num: number
  name: string
  avatar_src: string
  avatar_thumb: string
  avatar_thumb_url: string
  created_at: DateTimeString
  updated_at: DateTimeString
}

export type PhotoDTO = {
  id: ID
  gallery_id: ID
  member_id: ID
  index: number
  desc: string
  src: string
  format: string
  width: number
  height: number
  thumb: string
  src_url: string
  thumb_url: string
  vote_count: number
  member: MemberDTO | null
  is_voted?: boolean
  created_at: DateTimeString
  updated_at: DateTimeString
}

export type GalleryDTO = {
  id: ID
  index: number
  name: string
  vote_limit: number
  event_start: DateTimeString
  submission_expire: DateTimeString
  event_end: DateTimeString
  in_event: boolean
  can_submission: boolean
  photos: PhotoDTO[]
  vote_submitted?: boolean
  created_at: DateTimeString
  updated_at: DateTimeString
}

export type PublicHomeDTO = {
  active: GalleryDTO | null
  galleries: GalleryDTO[]
}

export type VoteDTO = {
  id: ID
  gallery_id: ID
  photo_id: ID
  member_id: ID
  created_at: DateTimeString
  updated_at: DateTimeString
}

export type MemberVoteDTO = MemberDTO & {
  votes: VoteDTO[]
}

export type StatisticDTO = {
  gallery_count: number
  member_count: number
  photo_count: number
  vote_count: number
}

export type TempUploadResult = {
  temp_id: string
  width: number
  height: number
  format: string
  size: number
  crc32: number
}

export type UploadResult = TempUploadResult & {
  preview_url?: string
}

export type LoginResult = {
  token: string
}
