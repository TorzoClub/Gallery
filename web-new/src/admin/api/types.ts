export type ID = number
export type DateTimeString = string

export interface Gallery {
  id: ID
  created_at?: DateTimeString
  updated_at?: DateTimeString
  name: string
  index: number
  vote_limit: number
  event_start: DateTimeString
  submission_expire: DateTimeString
  event_end: DateTimeString
  in_event?: boolean
  can_submission?: boolean
}

export interface GalleryPayload {
  name: string
  vote_limit: number
  event_start: string
  submission_expire: string
  event_end: string
  index: number
}

export interface Member {
  id: ID
  created_at?: DateTimeString
  updated_at?: DateTimeString
  name: string
  qq_num: number
  avatar_src: string
  avatar_thumb?: string
  avatar_thumb_url: string
}

export interface MemberPayload {
  name: string
  qq_num: number
  avatar_temp_id?: string
}

export interface Photo {
  id: ID
  gallery_id: ID
  member_id: ID
  created_at?: DateTimeString
  updated_at?: DateTimeString
  index: number
  vote_count: number
  desc: string
  src: string
  format: string
  thumb: string
  thumb_url: string
  src_url: string
  width: number
  height: number
  member?: Member | null
}

export interface PhotoPayload {
  gallery_id: ID
  member_id: ID
  desc: string
  temp_id?: string
}

export interface Vote {
  id: ID
  photo_id: ID
  member_id: ID
  gallery_id: ID
  created_at?: DateTimeString
  updated_at?: DateTimeString
}

export type MemberVote = Member & {
  votes: Vote[]
}

export interface Statistic {
  gallery_count: number
  member_count: number
  photo_count: number
  vote_count: number
}

export interface UploadResult {
  temp_id: string
  width: number
  height: number
  format: string
  size: number
  preview_url?: string
}

export interface LoginResult {
  token: string
}
