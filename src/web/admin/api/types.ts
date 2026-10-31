import type {
  GalleryDTO,
  MemberDTO,
  MemberVoteDTO,
  PhotoDTO,
  StatisticDTO,
  AdminGalleryDTO,
  AdminPoolDTO,
  UploadResult,
  VoteDTO,
  LoginResult,
} from '@shared/dto'
import type { InstanceConfig } from '@shared/config'

export type {
  GalleryDTO,
  MemberDTO,
  MemberVoteDTO,
  PhotoDTO,
  StatisticDTO,
  AdminGalleryDTO,
  AdminPoolDTO,
  UploadResult,
  VoteDTO,
  LoginResult,
  InstanceConfig,
}

export type ID = number
export type DateTimeString = string

export type Gallery = GalleryDTO
export type Member = MemberDTO
export type Photo = PhotoDTO
export type Vote = VoteDTO
export type MemberVote = MemberVoteDTO
export type Statistic = StatisticDTO

export interface GalleryPayload {
  name: string
  vote_limit: number
  event_start: string
  submission_expire: string
  event_end: string
  index: number
}

export interface MemberCreatePayload {
  name: string
  qq_num: number
  avatar_temp_id?: string
}

export interface MemberUpdatePayload {
  name?: string
  avatar_temp_id?: string
}

export interface PhotoPayload {
  gallery_id: ID
  member_id: ID
  desc: string
  temp_id?: string
}
