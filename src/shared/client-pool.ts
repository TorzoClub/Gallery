export type DateTimeString = string

export type ClientPhotoBase = {
  id: number
  index: number
  desc: string
  src: string
  format: string
  width: number
  height: number
  has_hdr_optimized: boolean
  created_at: DateTimeString
  updated_at: DateTimeString
}

export type ClientPhoto = ClientPhotoBase & {
  member_id: number
}

export type ClientPhotoInEvent = ClientPhotoBase & {
  member_id: null
}

export type ClientVote = {
  id: number
  photo_id: number
  member_id: number
  created_at: DateTimeString
  updated_at: DateTimeString
}

export type ClientMember = {
  id: number
  qq_num: number
  name: string
  avatar_src: string
  created_at: DateTimeString
  updated_at: DateTimeString
}

type ClientGalleryBase = {
  id: number
  index: number
  name: string
  vote_limit: number
  event_start: DateTimeString
  submission_expire: DateTimeString
  event_end: DateTimeString
  created_at: DateTimeString
  updated_at: DateTimeString
}

export type ClientGallery = ClientGalleryBase & {
  in_event: false
  photos: ClientPhoto[]
  vote_records: ClientVote[]
}

export type ClientGalleryInEvent = ClientGalleryBase & {
  in_event: true
  photos: ClientPhotoInEvent[]
}

export type ClientGalleryNode = ClientGallery | ClientGalleryInEvent

export type ClientPool = {
  schema_version: number
  next_id: number
  instance_hash: string
  app_startup_time: number
  submissions: number
  votes: number
  version_time: number
  build_date: string
  git_hash: string
  galleries: ClientGalleryNode[]
  members: ClientMember[]
}

export type ClientMemberView = {
  member_id: number
  active_gallery_id: number | null
  vote_submitted: boolean
  voted_photo_ids: number[]
  submitted_photo: ClientPhoto | null
}

export type Gallery = ClientGallery
export type GalleryInEvent = ClientGalleryInEvent
