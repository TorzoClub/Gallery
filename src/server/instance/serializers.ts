import { avatarThumbFilename, photoThumbFilename, photoVariantFilename } from '../common/image-name'
import { type EnvConfig } from '../config'
import {
  galleryCanSubmission,
  galleryInEvent,
  galleryPhotosSorted,
  memberHasVoted,
  voteCountByPhoto,
  type Gallery,
  type Vote,
} from '../core/Gallery'
import { type Member } from '../core/Member'
import { type Photo } from '../core/Photo'
import { findMemberByIdOrNull, type Pool } from '../core/Pool'

export type {
  MemberDTO,
  PhotoDTO,
  GalleryDTO,
  VoteDTO,
  PublicHomeDTO,
  MemberVoteDTO,
  StatisticDTO,
} from '../../shared/dto'

import type {
  MemberDTO,
  PhotoDTO,
  GalleryDTO,
  VoteDTO,
  PublicHomeDTO,
  StatisticDTO,
} from '../../shared/dto'

function imageUrl(
  env: EnvConfig,
  kind: 'source' | 'optimized' | 'thumb',
  filename: string,
  instance_hash?: string,
): string {
  const prefix = env.api_base_path === '/' ? '' : env.api_base_path
  const base = `${env.public_base_url}${prefix}/images/${kind}/${encodeURIComponent(filename)}`
  return instance_hash === undefined ? base : `${base}?v=${instance_hash}`
}

export function memberDto(
  member: Member,
  env: EnvConfig,
  instance_hash: string,
): MemberDTO {
  const avatar_thumb = avatarThumbFilename(member.avatar_src)
  return {
    id: Number(member.id),
    qq_num: Number(member.qq_num),
    name: member.name,
    avatar_src: member.avatar_src,
    avatar_thumb,
    avatar_thumb_url: imageUrl(env, 'thumb', avatar_thumb, instance_hash),
    created_at: member.created_at.toISOString(),
    updated_at: member.updated_at.toISOString(),
  }
}

export function photoDto(options: {
  pool: Pool
  gallery: Gallery
  photo: Photo
  env: EnvConfig
  instance_hash: string
  voted?: boolean
  hide_member?: boolean
}): PhotoDTO {
  const { pool, gallery, photo, env, instance_hash } = options
  const member = findMemberByIdOrNull(pool, photo.member_id)
  const thumb = photoThumbFilename(photo.src)
  const optimized = photoVariantFilename(photo.src, 'sdr')
  const thumb_url = imageUrl(env, 'thumb', thumb, instance_hash)
  const hide_member = options.hide_member === true

  return {
    id: Number(photo.id),
    gallery_id: Number(gallery.id),
    member_id: Number(photo.member_id),
    index: photo.index,
    desc: photo.desc,
    src: photo.src,
    format: photo.format,
    width: photo.width,
    height: photo.height,
    has_hdr_optimized: photo.has_hdr_optimized,
    thumb: thumb_url,
    src_url: imageUrl(env, 'source', photo.src),
    src_optimized: imageUrl(env, 'optimized', optimized, instance_hash),
    src_optimized_hdr: null,
    thumb_url,
    vote_count: voteCountByPhoto(gallery, photo.id),
    member: member === undefined || hide_member ? null : memberDto(member, env, instance_hash),
    ...(options.voted === undefined ? {} : { is_voted: options.voted }),
    created_at: photo.created_at.toISOString(),
    updated_at: photo.updated_at.toISOString(),
  }
}

export function galleryDto(options: {
  pool: Pool
  gallery: Gallery
  env: EnvConfig
  instance_hash: string
  now: Date
  member?: Member
  hide_member?: boolean
}): GalleryDTO {
  const { pool, gallery, env, instance_hash, now, member } = options
  const voted_photo_ids = new Set(
    member === undefined
      ? []
      : gallery.vote_records
          .filter((vote) => vote.member_id === member.id)
          .map((vote) => vote.photo_id),
  )

  const photos = galleryPhotosSorted(gallery).map((photo) => photoDto({
    pool,
    gallery,
    photo,
    env,
    instance_hash,
    hide_member: options.hide_member,
    voted: member === undefined ? undefined : voted_photo_ids.has(photo.id),
  }))

  return {
    id: Number(gallery.id),
    index: gallery.index,
    name: gallery.name,
    vote_limit: gallery.vote_limit,
    event_start: gallery.event_start.toISOString(),
    submission_expire: gallery.submission_expire.toISOString(),
    event_end: gallery.event_end.toISOString(),
    in_event: galleryInEvent(now, gallery),
    can_submission: galleryCanSubmission(now, gallery),
    photos,
    ...(member === undefined
      ? {}
      : { vote_submitted: memberHasVoted(gallery, member.id) }),
    created_at: gallery.created_at.toISOString(),
    updated_at: gallery.updated_at.toISOString(),
  }
}

export function publicHomeDto(options: {
  pool: Pool
  env: EnvConfig
  instance_hash: string
  now: Date
}): PublicHomeDTO {
  const { pool, env, instance_hash, now } = options
  const galleries = pool.galleries
    .valueSeq()
    .toArray()
    .sort((left, right) => {
      const diff = right.index - left.index
      return diff !== 0 ? diff : Number(left.id) - Number(right.id)
    })

  const active_gallery = galleries.find((gallery) => galleryInEvent(now, gallery))
  const active = active_gallery === undefined
    ? null
    : galleryDto({
        pool,
        gallery: active_gallery,
        env,
        instance_hash,
        now,
        hide_member: true,
      })

  return {
    active,
    galleries: galleries
      .filter((gallery) => !galleryInEvent(now, gallery))
      .map((gallery) => galleryDto({ pool, gallery, env, instance_hash, now })),
  }
}

export function memberHomeDto(options: {
  pool: Pool
  env: EnvConfig
  instance_hash: string
  now: Date
  member: Member
}): PublicHomeDTO {
  const { pool, env, instance_hash, now, member } = options
  const galleries = pool.galleries
    .valueSeq()
    .toArray()
    .sort((left, right) => {
      const diff = right.index - left.index
      return diff !== 0 ? diff : Number(left.id) - Number(right.id)
    })

  const active_gallery = galleries.find((gallery) => galleryInEvent(now, gallery))
  const active = active_gallery === undefined
    ? null
    : galleryDto({
        pool,
        gallery: active_gallery,
        env,
        instance_hash,
        now,
        member,
        hide_member: true,
      })

  return {
    active,
    galleries: galleries
      .filter((gallery) => !galleryInEvent(now, gallery))
      .map((gallery) => galleryDto({ pool, gallery, env, instance_hash, now, member })),
  }
}

export function voteDto(gallery: Gallery, vote: Vote): VoteDTO {
  return {
    id: Number(vote.id),
    gallery_id: Number(gallery.id),
    photo_id: Number(vote.photo_id),
    member_id: Number(vote.member_id),
    created_at: vote.created_at.toISOString(),
    updated_at: vote.updated_at.toISOString(),
  }
}

export function statisticDto(pool: Pool): StatisticDTO {
  let photo_count = 0
  let vote_count = 0
  pool.galleries.forEach((gallery) => {
    photo_count += gallery.photos.size
    vote_count += gallery.vote_records.size
  })
  return {
    gallery_count: pool.galleries.size,
    member_count: pool.members.size,
    photo_count,
    vote_count,
  }
}
