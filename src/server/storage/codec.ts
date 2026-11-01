import Immutable from 'immutable'
import * as z from 'zod'
import {
  asGalleryID,
  asMemberID,
  asNextID,
  asPhotoID,
  asSchemaVersion,
  asVoteID,
  type GalleryID,
  type NextID,
  type PhotoID,
  type SchemaVersion,
} from '../common/ID'
import { type Gallery, type Vote } from '../core/Gallery'
import { asQQNumber, type Member } from '../core/Member'
import { type Photo } from '../core/Photo'
import { type Pool } from '../core/Pool'
import { type InstanceConfig } from '../config/instance'

const dateString = z.iso.datetime()
const idNumber = z.number().int().positive()
const format = z.enum(['jpg', 'png', 'gif', 'webp', 'avif'])

export const MemberJsonSchema = z.strictObject({
  id: idNumber,
  qq_num: idNumber,
  name: z.string(),
  avatar_src: z.string(),
  created_at: dateString,
  updated_at: dateString,
})

export const PhotoJsonSchema = z.strictObject({
  id: idNumber,
  index: z.number().int().nonnegative(),
  desc: z.string(),
  src: z.string(),
  format,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  has_hdr_optimized: z.boolean().default(false),
  is_hdr: z.boolean().optional(),
  member_id: idNumber,
  created_at: dateString,
  updated_at: dateString,
})

export const VoteJsonSchema = z.strictObject({
  id: idNumber,
  photo_id: idNumber,
  member_id: idNumber,
  created_at: dateString,
  updated_at: dateString,
})

export const GalleryJsonSchema = z.strictObject({
  id: idNumber,
  index: z.number().int().nonnegative(),
  name: z.string(),
  vote_limit: z.number().int().nonnegative(),
  event_start: dateString,
  submission_expire: dateString,
  event_end: dateString,
  photos: z.array(PhotoJsonSchema),
  vote_records: z.array(VoteJsonSchema),
  created_at: dateString,
  updated_at: dateString,
})

export const PoolFileSchema = z.strictObject({
  schema_version: z.number().int().positive(),
  next_id: idNumber,
})

export const MembersFileSchema = z.array(MemberJsonSchema)
export const GalleryFileSchema = GalleryJsonSchema

export type MemberJson = z.infer<typeof MemberJsonSchema>
export type PhotoJson = z.infer<typeof PhotoJsonSchema>
export type VoteJson = z.infer<typeof VoteJsonSchema>
export type GalleryJson = z.infer<typeof GalleryJsonSchema>
export type PoolFile = z.infer<typeof PoolFileSchema>

const toDateString = (date: Date): string => date.toISOString()
const toDate = (value: string): Date => new Date(value)

export function toMemberJson(member: Member): MemberJson {
  return {
    id: member.id,
    qq_num: member.qq_num,
    name: member.name,
    avatar_src: member.avatar_src,
    created_at: toDateString(member.created_at),
    updated_at: toDateString(member.updated_at),
  }
}

export function fromMemberJson(json: MemberJson): Member {
  return {
    id: asMemberID(json.id),
    qq_num: asQQNumber(json.qq_num),
    name: json.name,
    avatar_src: json.avatar_src,
    created_at: toDate(json.created_at),
    updated_at: toDate(json.updated_at),
  }
}

export function toPhotoJson(photo: Photo): PhotoJson {
  return {
    id: photo.id,
    index: photo.index,
    desc: photo.desc,
    src: photo.src,
    format: photo.format,
    width: photo.width,
    height: photo.height,
    has_hdr_optimized: photo.has_hdr_optimized,
    member_id: photo.member_id,
    created_at: toDateString(photo.created_at),
    updated_at: toDateString(photo.updated_at),
  }
}

export function fromPhotoJson(json: PhotoJson): Photo {
  return {
    id: asPhotoID(json.id),
    index: json.index,
    desc: json.desc,
    src: json.src,
    format: json.format,
    width: json.width,
    height: json.height,
    has_hdr_optimized: json.has_hdr_optimized,
    member_id: asMemberID(json.member_id),
    created_at: toDate(json.created_at),
    updated_at: toDate(json.updated_at),
  }
}

export function toVoteJson(vote: Vote): VoteJson {
  return {
    id: vote.id,
    photo_id: vote.photo_id,
    member_id: vote.member_id,
    created_at: toDateString(vote.created_at),
    updated_at: toDateString(vote.updated_at),
  }
}

export function fromVoteJson(json: VoteJson): Vote {
  return {
    id: asVoteID(json.id),
    photo_id: asPhotoID(json.photo_id),
    member_id: asMemberID(json.member_id),
    created_at: toDate(json.created_at),
    updated_at: toDate(json.updated_at),
  }
}

export function toGalleryJson(gallery: Gallery): GalleryJson {
  return {
    id: gallery.id,
    index: gallery.index,
    name: gallery.name,
    vote_limit: gallery.vote_limit,
    event_start: toDateString(gallery.event_start),
    submission_expire: toDateString(gallery.submission_expire),
    event_end: toDateString(gallery.event_end),
    photos: gallery.photos
      .valueSeq()
      .toArray()
      .sort((left, right) => Number(left.id) - Number(right.id))
      .map(toPhotoJson),
    vote_records: gallery.vote_records
      .toArray()
      .sort((left, right) => Number(left.id) - Number(right.id))
      .map(toVoteJson),
    created_at: toDateString(gallery.created_at),
    updated_at: toDateString(gallery.updated_at),
  }
}

export function fromGalleryJson(json: GalleryJson): Gallery {
  return {
    id: asGalleryID(json.id),
    index: json.index,
    name: json.name,
    vote_limit: json.vote_limit,
    event_start: toDate(json.event_start),
    submission_expire: toDate(json.submission_expire),
    event_end: toDate(json.event_end),
    photos: Immutable.Map<PhotoID, Photo>(
      json.photos.map((photo) => {
        const parsed = fromPhotoJson(photo)
        return [parsed.id, parsed] as const
      }),
    ),
    vote_records: Immutable.List<Vote>(json.vote_records.map(fromVoteJson)),
    created_at: toDate(json.created_at),
    updated_at: toDate(json.updated_at),
  }
}

export function toPoolFile(pool: Pool): PoolFile {
  return {
    schema_version: Number(pool.schema_version),
    next_id: Number(pool.next_id),
  }
}

export function fromPoolFile(json: PoolFile): { schema_version: SchemaVersion; next_id: NextID } {
  return {
    schema_version: asSchemaVersion(json.schema_version),
    next_id: asNextID(json.next_id),
  }
}

export function toInstanceConfigJson(config: InstanceConfig): InstanceConfig {
  return config
}

export function parsePoolFile(input: unknown): PoolFile {
  return PoolFileSchema.parse(input)
}

export function parseMembersFile(input: unknown): MemberJson[] {
  return MembersFileSchema.parse(input)
}

export function parseGalleryFile(input: unknown): GalleryJson {
  return GalleryFileSchema.parse(input)
}

export type GalleryFiles = Map<GalleryID, GalleryJson>
