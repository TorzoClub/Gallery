import {
  galleryInEvent,
  galleryPhotosSorted,
  type Gallery,
  type Vote,
} from '../core/Gallery'
import { type Member } from '../core/Member'
import { type Photo } from '../core/Photo'
import {
  poolGalleriesSorted,
  poolMembersSorted,
  type Pool,
} from '../core/Pool'
import type {
  ClientGallery,
  ClientGalleryInEvent,
  ClientMember,
  ClientPhoto,
  ClientPhotoBase,
  ClientPhotoInEvent,
  ClientPool,
  ClientVote,
} from '../../shared/client-pool'

export type ClientPoolMeta = {
  instance_hash: string
  app_startup_time: number
  version_time: number
  build_date: string
  git_hash: string
}

function photoBase(photo: Photo): ClientPhotoBase {
  return {
    id: Number(photo.id),
    index: photo.index,
    desc: photo.desc,
    src: photo.src,
    format: photo.format,
    width: photo.width,
    height: photo.height,
    has_hdr_optimized: photo.has_hdr_optimized,
    created_at: photo.created_at.toISOString(),
    updated_at: photo.updated_at.toISOString(),
  }
}

export function toClientPhoto(photo: Photo): ClientPhoto {
  return {
    ...photoBase(photo),
    member_id: Number(photo.member_id),
  }
}

function clientPhotoInEvent(photo: Photo): ClientPhotoInEvent {
  return {
    ...photoBase(photo),
    member_id: null,
  }
}

function clientMember(member: Member): ClientMember {
  return {
    id: Number(member.id),
    qq_num: null,
    name: member.name,
    avatar_src: member.avatar_src,
    created_at: member.created_at.toISOString(),
    updated_at: member.updated_at.toISOString(),
  }
}

function clientVote(vote: Vote): ClientVote {
  return {
    id: Number(vote.id),
    photo_id: Number(vote.photo_id),
    member_id: Number(vote.member_id),
    created_at: vote.created_at.toISOString(),
    updated_at: vote.updated_at.toISOString(),
  }
}

function galleryBase(gallery: Gallery) {
  return {
    id: Number(gallery.id),
    index: gallery.index,
    name: gallery.name,
    vote_limit: gallery.vote_limit,
    event_start: gallery.event_start.toISOString(),
    submission_expire: gallery.submission_expire.toISOString(),
    event_end: gallery.event_end.toISOString(),
    created_at: gallery.created_at.toISOString(),
    updated_at: gallery.updated_at.toISOString(),
  }
}

function clientGallery(gallery: Gallery): ClientGallery {
  return {
    ...galleryBase(gallery),
    in_event: false,
    photos: galleryPhotosSorted(gallery).map(toClientPhoto),
    vote_records: gallery.vote_records.map(clientVote).toArray(),
  }
}

function clientGalleryInEvent(gallery: Gallery): ClientGalleryInEvent {
  return {
    ...galleryBase(gallery),
    in_event: true,
    photos: galleryPhotosSorted(gallery).map(clientPhotoInEvent),
  }
}

export function toClientPool(
  pool: Pool,
  now: Date,
  meta: ClientPoolMeta,
): ClientPool {
  const galleries = poolGalleriesSorted(pool)
  const client_galleries = galleries.map(gallery => (
    galleryInEvent(now, gallery)
      ? clientGalleryInEvent(gallery)
      : clientGallery(gallery)
  ))

  const submissions = galleries.reduce(
    (total, gallery) => total + gallery.photos.size,
    0,
  )
  const votes = galleries.reduce(
    (total, gallery) => (
      galleryInEvent(now, gallery)
        ? total
        : total + gallery.vote_records.size
    ),
    0,
  )

  return {
    schema_version: Number(pool.schema_version),
    next_id: Number(pool.next_id),
    instance_hash: meta.instance_hash,
    app_startup_time: meta.app_startup_time,
    submissions,
    votes,
    version_time: meta.version_time,
    build_date: meta.build_date,
    git_hash: meta.git_hash,
    galleries: client_galleries,
    members: poolMembersSorted(pool).map(clientMember),
  }
}
