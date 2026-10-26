import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { crc32 } from 'node:zlib'
import Immutable from 'immutable'
import sharp from 'sharp'
import {
  asGalleryID,
  asMemberID,
  asPhotoID,
  asVoteID,
  type GalleryID,
  type MemberID,
  type PhotoID,
  type VoteID,
} from '../common/ID'
import { formatFromFilename, type ImageFormat } from '../common/image-name'
import { uuidv7 } from '../common/uuid'
import {
  checkGallery,
  type Gallery,
  type Vote,
} from '../core/Gallery'
import { asQQNumber, checkMember, type Member } from '../core/Member'
import { checkPhoto, type Photo } from '../core/Photo'
import { createPool, type Pool } from '../core/Pool'
import { createLogger, type Logger } from '../logger'
import { DEFAULT_INSTANCE_CONFIG, type InstanceConfig } from '../config/instance'
import { createStorage, type Storage } from '../storage'
import { createImagePipeline, type ImagePipeline } from '../instance/prepare-photo'
import {
  LegacyApiClient,
  type FetchLike,
  type LegacyGallery,
  type LegacyMember,
  type LegacyPhoto,
  type LegacySnapshot,
  type LegacyVote,
} from './legacy-api'

export type LegacyMigrationResult = {
  storage_path: string
  galleries: number
  members: number
  photos: number
  votes: number
  warnings: string[]
}

const MIGRATION_INSTANCE_CONFIG: InstanceConfig = Object.freeze({
  ...DEFAULT_INSTANCE_CONFIG,
  avatar_thumb_size: 128,
  image_thumb_size: 320,
  image_thumb_quality: 10,
  image_processing_effort: 3,
})

export type LegacyMigrationOptions = {
  api_url: string
  admin_password: string
  storage_path: string
  fetch_impl?: FetchLike
  logger?: Logger
  now?: () => Date
  on_progress?: (message: string) => void
}

type IdMaps = {
  gallery: Map<number, GalleryID>
  member: Map<number, MemberID>
  photo: Map<number, PhotoID>
  vote: Map<number, VoteID>
  next_id: number
}

function fail(message: string): never {
  throw new Error(message)
}

async function assertTargetMissing(target: string): Promise<void> {
  try {
    await fs.lstat(target)
    fail(`目标 storage_path 已存在，拒绝覆盖: ${target}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

function dateOrFallback(
  value: string | undefined,
  fallback: Date,
  label: string,
): Date {
  if (value === undefined) {
    return fallback
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    fail(`${label} 不是合法日期: ${value}`)
  }
  return date
}

function assertUniqueIds(items: readonly { id: number }[], label: string): void {
  const ids = new Set<number>()
  for (const item of items) {
    if (ids.has(item.id)) {
      fail(`${label} id 重复: ${item.id}`)
    }
    ids.add(item.id)
  }
}

function assertUniqueQQ(members: readonly LegacyMember[]): void {
  const qqs = new Set<number>()
  for (const member of members) {
    if (qqs.has(member.qq_num)) {
      fail(`Legacy 成员 QQ 重复: ${member.qq_num}`)
    }
    qqs.add(member.qq_num)
  }
}

function sortGalleries(galleries: readonly LegacyGallery[]): LegacyGallery[] {
  return [...galleries].sort((left, right) => left.id - right.id)
}

function sortMembers(members: readonly LegacyMember[]): LegacyMember[] {
  return [...members].sort((left, right) => left.id - right.id)
}

function sortPhotos(photos: readonly LegacyPhoto[]): LegacyPhoto[] {
  return [...photos].sort((left, right) => (
    left.gallery_id - right.gallery_id
    || left.index - right.index
    || left.id - right.id
  ))
}

function sortVotes(votes: readonly (LegacyVote & { gallery_id: number })[]): Array<LegacyVote & { gallery_id: number }> {
  return [...votes].sort((left, right) => (
    left.gallery_id - right.gallery_id
    || left.id - right.id
  ))
}

function assignIds(snapshot: LegacySnapshot): {
  maps: IdMaps
  galleries: LegacyGallery[]
  members: LegacyMember[]
  photos: LegacyPhoto[]
  votes: Array<LegacyVote & { gallery_id: number }>
} {
  const galleries = sortGalleries(snapshot.galleries)
  const members = sortMembers(snapshot.members)
  const photos = sortPhotos(snapshot.photos)
  const votes = sortVotes(snapshot.votes.map(vote => ({
    ...vote,
    gallery_id: vote.gallery_id ?? fail(`Legacy vote(${vote.id}) 缺少 gallery_id`),
  })))

  assertUniqueIds(galleries, 'Legacy gallery')
  assertUniqueIds(members, 'Legacy member')
  assertUniqueIds(photos, 'Legacy photo')
  assertUniqueIds(votes, 'Legacy vote')
  assertUniqueQQ(members)

  const gallery_set = new Set(galleries.map(gallery => gallery.id))
  const member_set = new Set(members.map(member => member.id))
  const photo_set = new Set(photos.map(photo => photo.id))

  for (const photo of photos) {
    if (!gallery_set.has(photo.gallery_id)) {
      fail(`Legacy photo(${photo.id}) 引用了不存在的 gallery(${photo.gallery_id})`)
    }
    if (!member_set.has(photo.member_id)) {
      fail(`Legacy photo(${photo.id}) 引用了不存在的 member(${photo.member_id})`)
    }
  }

  for (const vote of votes) {
    if (!gallery_set.has(vote.gallery_id)) {
      fail(`Legacy vote(${vote.id}) 引用了不存在的 gallery(${vote.gallery_id})`)
    }
    if (!photo_set.has(vote.photo_id)) {
      fail(`Legacy vote(${vote.id}) 引用了不存在的 photo(${vote.photo_id})`)
    }
    if (!member_set.has(vote.member_id)) {
      fail(`Legacy vote(${vote.id}) 引用了不存在的 member(${vote.member_id})`)
    }
  }

  let next_id = 1
  const next = (): number => {
    const id = next_id
    next_id += 1
    return id
  }

  const gallery_ids = new Map<number, GalleryID>()
  const member_ids = new Map<number, MemberID>()
  const photo_ids = new Map<number, PhotoID>()
  const vote_ids = new Map<number, VoteID>()

  for (const gallery of galleries) {
    gallery_ids.set(gallery.id, asGalleryID(next()))
  }
  for (const member of members) {
    member_ids.set(member.id, asMemberID(next()))
  }
  for (const photo of photos) {
    photo_ids.set(photo.id, asPhotoID(next()))
  }
  for (const vote of votes) {
    vote_ids.set(vote.id, asVoteID(next()))
  }

  return {
    maps: {
      gallery: gallery_ids,
      member: member_ids,
      photo: photo_ids,
      vote: vote_ids,
      next_id,
    },
    galleries,
    members,
    photos,
    votes,
  }
}

function requireMap<K, V>(map: Map<K, V>, key: K, label: string): V {
  const value = map.get(key)
  if (value === undefined) {
    fail(`找不到 ${label}: ${String(key)}`)
  }
  return value
}

function formatOf(filename: string, label: string): ImageFormat {
  const format = formatFromFilename(filename)
  if (format === null) {
    fail(`${label} 的图片格式不受支持: ${filename}`)
  }
  return format
}

async function detectFormat(buffer: Buffer, label: string): Promise<ImageFormat> {
  let format: string | undefined
  try {
    format = (await sharp(buffer).metadata()).format
  } catch (error) {
    fail(`${label} 不是可解析的图片: ${error instanceof Error ? error.message : String(error)}`)
  }
  switch (format) {
    case 'jpeg':
    case 'jpg':
      return 'jpg'
    case 'png':
      return 'png'
    case 'gif':
      return 'gif'
    case 'webp':
      return 'webp'
    case 'avif':
    case 'heif':
      return 'avif'
    default:
      fail(`${label} 的图片格式不受支持: ${format ?? 'unknown'}`)
  }
}

async function storeTempImage(
  pipeline: ImagePipeline,
  buffer: Buffer,
  format: string,
): Promise<string> {
  const temp_id = uuidv7()
  await pipeline.storeTempImage({
    stream: Readable.from(buffer),
    temp_id,
    format,
    crc32: Promise.resolve(crc32(buffer)),
  })
  return temp_id
}

async function prepareAvatar(
  pipeline: ImagePipeline,
  client: LegacyApiClient,
  legacy_member: LegacyMember,
): Promise<string> {
  let buffer: Buffer
  try {
    buffer = await client.downloadSource(legacy_member.avatar_src)
  } catch (error) {
    throw new Error(
      `成员(${legacy_member.id}) 头像下载失败: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const format = await detectFormat(buffer, `成员(${legacy_member.id}) 头像`)
  const temp_id = await storeTempImage(pipeline, buffer, format)
  try {
    const prepared = await pipeline.prepareAvatar({
      qq_num: asQQNumber(legacy_member.qq_num),
      temp_id,
    })
    return prepared.avatar_src
  } catch (error) {
    throw new Error(
      `成员(${legacy_member.id}) 头像处理失败: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

async function preparePhoto(
  pipeline: ImagePipeline,
  client: LegacyApiClient,
  legacy_photo: LegacyPhoto,
  gallery_id: GalleryID,
  member_id: MemberID,
  photo_id: PhotoID,
): Promise<{
  src: string
  width: number
  height: number
  has_hdr_optimized: boolean
}> {
  let buffer: Buffer
  try {
    buffer = await client.downloadSource(legacy_photo.src)
  } catch (error) {
    throw new Error(
      `相片(${legacy_photo.id}) 图片下载失败: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const format = await detectFormat(buffer, `相片(${legacy_photo.id})`)
  const temp_id = await storeTempImage(pipeline, buffer, format)
  try {
    const prepared = await pipeline.preparePhoto({
      gallery_id,
      photo_id,
      temp_id,
      desc: legacy_photo.desc,
      index: legacy_photo.index,
      member_id,
    })
    return {
      src: prepared.src,
      width: prepared.width,
      height: prepared.height,
      has_hdr_optimized: prepared.has_hdr_optimized,
    }
  } catch (error) {
    throw new Error(
      `相片(${legacy_photo.id}) 图片处理失败: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next_index = 0
  let failure: unknown = null

  const worker = async (): Promise<void> => {
    while (failure === null) {
      const index = next_index
      next_index += 1
      if (index >= items.length) {
        return
      }
      try {
        results[index] = await fn(items[index] as T, index)
      } catch (error) {
        failure = error
        return
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker),
  )
  if (failure !== null) {
    throw failure
  }
  return results
}

async function buildMembers(input: {
  pipeline: ImagePipeline
  client: LegacyApiClient
  legacy_members: LegacyMember[]
  maps: IdMaps
  migration_time: Date
}): Promise<{ members: Member[]; by_legacy_id: Map<number, Member> }> {
  const prepared = await mapWithConcurrency(
    input.legacy_members,
    8,
    async (legacy_member) => ({
      legacy_member,
      avatar_src: await prepareAvatar(input.pipeline, input.client, legacy_member),
    }),
  )
  const members: Member[] = []
  const by_legacy_id = new Map<number, Member>()

  for (const item of prepared) {
    const legacy_member = item.legacy_member
    const created_at = dateOrFallback(
      legacy_member.created_at,
      input.migration_time,
      `成员(${legacy_member.id}) created_at`,
    )
    const updated_at = dateOrFallback(
      legacy_member.updated_at,
      created_at,
      `成员(${legacy_member.id}) updated_at`,
    )
    const member = checkMember({
      id: requireMap(input.maps.member, legacy_member.id, `member 映射(${legacy_member.id})`),
      qq_num: asQQNumber(legacy_member.qq_num),
      name: legacy_member.name,
      avatar_src: item.avatar_src,
      created_at,
      updated_at,
    })
    members.push(member)
    by_legacy_id.set(legacy_member.id, member)
  }

  return { members, by_legacy_id }
}

async function buildPhotos(input: {
  pipeline: ImagePipeline
  client: LegacyApiClient
  legacy_photos: LegacyPhoto[]
  maps: IdMaps
  members: Map<number, Member>
  migration_time: Date
  on_progress?: (message: string) => void
}): Promise<{
  photos: Photo[]
  by_legacy_id: Map<number, Photo>
  by_gallery: Map<GalleryID, Immutable.Map<PhotoID, Photo>>
}> {
  let prepared_count = 0
  const prepared = await mapWithConcurrency(
    input.legacy_photos,
    8,
    async (legacy_photo) => {
      const member = requireMap(
        input.members,
        legacy_photo.member_id,
        `member(${legacy_photo.member_id})`,
      )
      const gallery_id = requireMap(
        input.maps.gallery,
        legacy_photo.gallery_id,
        `gallery 映射(${legacy_photo.gallery_id})`,
      )
      const photo_id = requireMap(
        input.maps.photo,
        legacy_photo.id,
        `photo 映射(${legacy_photo.id})`,
      )
      const image = await preparePhoto(
        input.pipeline,
        input.client,
        legacy_photo,
        gallery_id,
        member.id,
        photo_id,
      )
      prepared_count += 1
      if ((prepared_count % 20 === 0) || prepared_count === input.legacy_photos.length) {
        input.on_progress?.(`准备相片 ${prepared_count}/${input.legacy_photos.length}`)
      }
      return { legacy_photo, member, gallery_id, photo_id, image }
    },
  )

  const photos: Photo[] = []
  const by_legacy_id = new Map<number, Photo>()
  const by_gallery = new Map<GalleryID, Immutable.Map<PhotoID, Photo>>()

  for (const item of prepared) {
    const legacy_photo = item.legacy_photo
    const format = formatOf(item.image.src, `相片(${legacy_photo.id}) 处理结果`)
    const created_at = dateOrFallback(
      legacy_photo.created_at,
      input.migration_time,
      `相片(${legacy_photo.id}) created_at`,
    )
    const updated_at = dateOrFallback(
      legacy_photo.updated_at,
      created_at,
      `相片(${legacy_photo.id}) updated_at`,
    )
    const photo = checkPhoto({
      id: item.photo_id,
      index: legacy_photo.index,
      desc: legacy_photo.desc,
      src: item.image.src,
      format,
      width: item.image.width,
      height: item.image.height,
      has_hdr_optimized: false,
      member_id: item.member.id,
      created_at,
      updated_at,
    })

    photos.push(photo)
    by_legacy_id.set(legacy_photo.id, photo)

    const gallery_photos = by_gallery.get(item.gallery_id) ?? Immutable.Map<PhotoID, Photo>()
    by_gallery.set(item.gallery_id, gallery_photos.set(photo.id, photo))
    if ((photos.length % 10 === 0) || photos.length === prepared.length) {
      input.on_progress?.(`处理相片 ${photos.length}/${prepared.length}`)
    }
  }

  return { photos, by_legacy_id, by_gallery }
}

function buildVotes(input: {
  legacy_votes: Array<LegacyVote & { gallery_id: number }>
  maps: IdMaps
  photos: Map<number, Photo>
  migration_time: Date
}): { votes: Vote[]; by_gallery: Map<GalleryID, Vote[]> } {
  const votes: Vote[] = []
  const by_gallery = new Map<GalleryID, Vote[]>()

  for (const legacy_vote of input.legacy_votes) {
    const photo = requireMap(
      input.photos,
      legacy_vote.photo_id,
      `photo(${legacy_vote.photo_id})`,
    )
    const gallery_id = requireMap(
      input.maps.gallery,
      legacy_vote.gallery_id,
      `gallery 映射(${legacy_vote.gallery_id})`,
    )
    const member_id = requireMap(
      input.maps.member,
      legacy_vote.member_id,
      `member 映射(${legacy_vote.member_id})`,
    )
    const created_at = dateOrFallback(
      legacy_vote.created_at,
      input.migration_time,
      `vote(${legacy_vote.id}) created_at`,
    )
    const updated_at = dateOrFallback(
      legacy_vote.updated_at,
      created_at,
      `vote(${legacy_vote.id}) updated_at`,
    )
    const vote: Vote = {
      id: requireMap(input.maps.vote, legacy_vote.id, `vote 映射(${legacy_vote.id})`),
      photo_id: photo.id,
      member_id,
      created_at,
      updated_at,
    }
    votes.push(vote)
    const gallery_votes = by_gallery.get(gallery_id) ?? []
    gallery_votes.push(vote)
    by_gallery.set(gallery_id, gallery_votes)
  }

  return { votes, by_gallery }
}

function voteCountWarnings(input: {
  legacy_photos: LegacyPhoto[]
  votes: Vote[]
  photos_by_legacy: Map<number, Photo>
}): string[] {
  const warnings: string[] = []
  for (const legacy_photo of input.legacy_photos) {
    const expected = legacy_photo.vote_count
    if (expected === undefined) {
      continue
    }
    const photo = requireMap(
      input.photos_by_legacy,
      legacy_photo.id,
      `photo(${legacy_photo.id})`,
    )
    const actual = input.votes.filter(vote => vote.photo_id === photo.id).length
    if (actual !== expected) {
      warnings.push(
        `相片(${legacy_photo.id}) 的 Legacy vote_count=${expected}，实际 votes=${actual}；已按实际 votes 迁移`,
      )
    }
  }
  return warnings
}

function buildPool(input: {
  legacy: {
    galleries: LegacyGallery[]
  }
  maps: IdMaps
  migration_time: Date
  built: {
    members: Member[]
    photos_by_gallery: Map<GalleryID, Immutable.Map<PhotoID, Photo>>
    votes_by_gallery: Map<GalleryID, Vote[]>
  }
}): Pool {
  const galleries: Gallery[] = []

  for (const legacy_gallery of input.legacy.galleries) {
    const gallery_id = requireMap(
      input.maps.gallery,
      legacy_gallery.id,
      `gallery 映射(${legacy_gallery.id})`,
    )
    const created_at = dateOrFallback(
      legacy_gallery.created_at,
      input.migration_time,
      `gallery(${legacy_gallery.id}) created_at`,
    )
    const updated_at = dateOrFallback(
      legacy_gallery.updated_at,
      created_at,
      `gallery(${legacy_gallery.id}) updated_at`,
    )
    const photos = input.built.photos_by_gallery.get(gallery_id) ?? Immutable.Map<PhotoID, Photo>()
    const votes = input.built.votes_by_gallery.get(gallery_id) ?? []
    galleries.push(checkGallery({
      id: gallery_id,
      index: legacy_gallery.index,
      name: legacy_gallery.name,
      vote_limit: legacy_gallery.vote_limit,
      event_start: dateOrFallback(
        legacy_gallery.event_start,
        created_at,
        `gallery(${legacy_gallery.id}) event_start`,
      ),
      submission_expire: dateOrFallback(
        legacy_gallery.submission_expire,
        created_at,
        `gallery(${legacy_gallery.id}) submission_expire`,
      ),
      event_end: dateOrFallback(
        legacy_gallery.event_end,
        created_at,
        `gallery(${legacy_gallery.id}) event_end`,
      ),
      photos,
      vote_records: Immutable.List(votes),
      created_at,
      updated_at,
    }))
  }

  const pool = createPool(galleries, input.built.members)
  if (Number(pool.next_id) !== input.maps.next_id) {
    fail(`next_id 不一致: 分配=${input.maps.next_id}, pool=${pool.next_id}`)
  }
  return pool
}

export async function migrateLegacy(
  options: LegacyMigrationOptions,
): Promise<LegacyMigrationResult> {
  const target = path.resolve(options.storage_path)
  const progress = options.on_progress ?? (() => undefined)
  const migration_time = options.now?.() ?? new Date()
  const logger = options.logger ?? createLogger({ level: 'error', pretty: true })

  await assertTargetMissing(target)
  await fs.mkdir(path.dirname(target), { recursive: true })

  const staging = path.join(
    path.dirname(target),
    `.${path.basename(target)}.migration-${randomUUID()}`,
  )

  let storage: Storage | null = null
  let pipeline: ImagePipeline | null = null

  try {
    progress('创建 staging storage')
    storage = await createStorage({
      storage_path: staging,
      allow_empty_data: true,
      logger,
    })
    const loaded = await storage.load()
    await storage.storeInstanceConfig(MIGRATION_INSTANCE_CONFIG)
    pipeline = createImagePipeline({
      storage,
      getConfig: () => MIGRATION_INSTANCE_CONFIG,
    })

    const client = new LegacyApiClient({
      api_url: options.api_url,
      admin_password: options.admin_password,
      fetch_impl: options.fetch_impl,
    })

    progress('登录 Legacy admin API')
    await client.login()
    progress('读取 Legacy galleries 和 members')
    const snapshot = await client.loadSnapshot()

    const assigned = assignIds(snapshot)
    const built_members = await buildMembers({
      pipeline,
      client,
      legacy_members: assigned.members,
      maps: assigned.maps,
      migration_time,
    })
    progress(`处理 ${assigned.photos.length} 张相片`)
    const built_photos = await buildPhotos({
      pipeline,
      client,
      legacy_photos: assigned.photos,
      maps: assigned.maps,
      members: built_members.by_legacy_id,
      migration_time,
      on_progress: progress,
    })
    const built_votes = buildVotes({
      legacy_votes: assigned.votes,
      maps: assigned.maps,
      photos: built_photos.by_legacy_id,
      migration_time,
    })
    const warnings = voteCountWarnings({
      legacy_photos: assigned.photos,
      votes: built_votes.votes,
      photos_by_legacy: built_photos.by_legacy_id,
    })

    const pool = buildPool({
      legacy: {
        galleries: assigned.galleries,
      },
      maps: assigned.maps,
      migration_time,
      built: {
        members: built_members.members,
        photos_by_gallery: built_photos.by_gallery,
        votes_by_gallery: built_votes.by_gallery,
      },
    })

    progress('写入 storage')
    await storage.storeByDiff(pool, loaded.pool)
    await storage.load()

    await pipeline.close()
    pipeline = null
    await storage.close()
    storage = null

    await fs.rename(staging, target)

    return {
      storage_path: target,
      galleries: pool.galleries.size,
      members: pool.members.size,
      photos: built_photos.photos.length,
      votes: built_votes.votes.length,
      warnings,
    }
  } catch (error) {
    if (pipeline !== null) {
      await pipeline.close().catch(() => undefined)
    }
    if (storage !== null) {
      await storage.close().catch(() => undefined)
    }
    await fs.rm(staging, { recursive: true, force: true })
    throw error
  }
}
