import fs from 'node:fs/promises'
import path from 'node:path'
import Immutable from 'immutable'
import { asGalleryID, asNextID, asSchemaVersion } from '../common/ID'
import { notFound } from '../common/error'
import {
  formatFromFilename,
  isSafeFilename,
  legacyPhotoVariantFilename,
  legacyUnversionedPhotoFilenames,
  photoThumbFilename,
  photoVariantFilename,
} from '../common/image-name'
import { type Gallery } from '../core/Gallery'
import { type Member } from '../core/Member'
import { type Photo } from '../core/Photo'
import {
  createPool,
  diffGalleriesMap,
  maxEntityId,
  type Pool,
} from '../core/Pool'
import {
  DEFAULT_INSTANCE_CONFIG,
  InstanceConfigFileSchema,
  parseInstanceConfig,
  type InstanceConfig,
} from '../config/instance'
import type { Logger } from '../logger'
import {
  fromGalleryJson,
  fromMemberJson,
  fromPoolFile,
  parseGalleryFile,
  parseMembersFile,
  parsePoolFile,
  toGalleryJson,
  toMemberJson,
  toPoolFile,
} from './codec'
import {
  ensureDir,
  fileExists,
  listJsonFiles,
  readJsonFile,
  removeFile,
  writeBufferAtomic,
  writeJsonAtomic,
} from './fs'
import { acquireStorageLock, type StorageLock } from './lock'
import { isUuidV7 } from '../common/uuid'

export type ImageKind = 'source' | 'optimized' | 'thumb'

export type StoragePaths = Readonly<{
  root: string
  galleries: string
  source: string
  optimized: string
  thumb: string
  temp: string
  pool_file: string
  members_file: string
  instance_config_file: string
  lock_file: string
}>

export type Storage = {
  paths: StoragePaths
  load(): Promise<{ pool: Pool; instance_config: InstanceConfig }>
  storeByDiff(latest: Pool, prev: Pool): Promise<void>
  storeInstanceConfig(config: InstanceConfig): Promise<void>
  readImage(kind: ImageKind, filename: string): Promise<Buffer>
  imagePath(kind: ImageKind, filename: string): string
  tempPath(filename: string): string
  findTempFile(temp_id: string): Promise<string | null>
  saveTempFile(filename: string, buffer: Buffer): Promise<void>
  removeTemp(filename: string): Promise<void>
  removeImage(source_filename: string): Promise<void>
  cleanupTemp(): Promise<void>
  close(): Promise<void>
}

export type CreateStorageOptions = {
  storage_path: string
  allow_empty_data: boolean
  logger?: Logger
}

function makePaths(storage_path: string): StoragePaths {
  const root = path.resolve(storage_path)
  const images = path.join(root, 'stored-images')
  return {
    root,
    galleries: path.join(root, 'galleries'),
    source: path.join(images, 'source'),
    optimized: path.join(images, 'optimized'),
    thumb: path.join(images, 'thumb'),
    temp: path.join(images, 'temp'),
    pool_file: path.join(root, 'pool.json'),
    members_file: path.join(root, 'members.json'),
    instance_config_file: path.join(root, 'instance-config.json'),
    lock_file: path.join(root, 'lock'),
  }
}

function validatePool(pool: Pool): void {
  const member_ids = new Set<number>()
  const photo_ids = new Set<number>()
  const vote_ids = new Set<number>()

  pool.members.forEach((member) => {
    if (member_ids.has(Number(member.id))) {
      throw new Error(`成员 id 重复: ${member.id}`)
    }
    member_ids.add(Number(member.id))
    if (pool.members.get(member.qq_num) !== member) {
      throw new Error(`成员 QQ Map key 不一致: ${member.qq_num}`)
    }
  })

  pool.galleries.forEach((gallery, key) => {
    if (gallery.id !== key) {
      throw new Error(`相册 Map key 与 id 不一致: ${key} / ${gallery.id}`)
    }

    gallery.photos.forEach((photo, photo_key) => {
      if (photo.id !== photo_key) {
        throw new Error(`相片 Map key 与 id 不一致: ${photo_key} / ${photo.id}`)
      }
      if (photo_ids.has(Number(photo.id))) {
        throw new Error(`相片 id 重复: ${photo.id}`)
      }
      photo_ids.add(Number(photo.id))
      if (!member_ids.has(Number(photo.member_id))) {
        throw new Error(`相片(${photo.id})引用了不存在的成员(${photo.member_id})`)
      }
    })

    gallery.vote_records.forEach((vote) => {
      if (vote_ids.has(Number(vote.id))) {
        throw new Error(`投票 id 重复: ${vote.id}`)
      }
      vote_ids.add(Number(vote.id))
      if (!member_ids.has(Number(vote.member_id))) {
        throw new Error(`投票(${vote.id})引用了不存在的成员(${vote.member_id})`)
      }
      if (!gallery.photos.has(vote.photo_id)) {
        throw new Error(`投票(${vote.id})引用了不存在的相片(${vote.photo_id})`)
      }
    })
  })

  const max_id = maxEntityId(pool)
  if (Number(pool.next_id) <= max_id) {
    throw new Error(`next_id(${pool.next_id}) 必须大于所有实体 id(${max_id})`)
  }
}

async function loadPoolFromDisk(paths: StoragePaths): Promise<Pool> {
  const members_raw = await readJsonFile(paths.members_file)
  const members_json = parseMembersFile(members_raw)
  const member_ids = new Set<number>()
  const member_qqs = new Set<number>()
  for (const member of members_json) {
    if (member_ids.has(member.id)) {
      throw new Error(`成员 id 重复: ${member.id}`)
    }
    if (member_qqs.has(member.qq_num)) {
      throw new Error(`成员 QQ 重复: ${member.qq_num}`)
    }
    member_ids.add(member.id)
    member_qqs.add(member.qq_num)
  }
  const members = members_json.map(fromMemberJson)

  const gallery_files = await listJsonFiles(paths.galleries)
  const galleries: Gallery[] = []
  const gallery_ids = new Set<number>()
  for (const file of gallery_files) {
    const raw = await readJsonFile(file)
    const gallery = fromGalleryJson(parseGalleryFile(raw))
    if (gallery_ids.has(Number(gallery.id))) {
      throw new Error(`相册 id 重复: ${gallery.id}`)
    }
    gallery_ids.add(Number(gallery.id))
    const expected_name = `${gallery.id}.json`
    if (path.basename(file) !== expected_name) {
      throw new Error(`gallery 文件名与 id 不一致: ${file}`)
    }
    galleries.push(gallery)
  }

  return {
    schema_version: asSchemaVersion(1),
    next_id: asNextID(1),
    galleries: Immutable.Map(galleries.map((gallery) => [gallery.id, gallery])),
    members: Immutable.Map<Member['qq_num'], Member>(
      members.map((member) => [member.qq_num, member]),
    ),
  }
}

async function loadInstanceConfig(paths: StoragePaths): Promise<InstanceConfig> {
  if (!(await fileExists(paths.instance_config_file))) {
    await writeJsonAtomic(paths.instance_config_file, DEFAULT_INSTANCE_CONFIG)
    return DEFAULT_INSTANCE_CONFIG
  }

  const raw = await readJsonFile(paths.instance_config_file)
  const parsed = InstanceConfigFileSchema.parse(raw)
  return parseInstanceConfig(parsed)
}

export async function createStorage(options: CreateStorageOptions): Promise<Storage> {
  const paths = makePaths(options.storage_path)
  const logger = options.logger

  await ensureDir(paths.root)
  await ensureDir(paths.galleries)
  await ensureDir(paths.source)
  await ensureDir(paths.optimized)
  await ensureDir(paths.thumb)
  await ensureDir(paths.temp)

  const lock = await acquireStorageLock(paths.lock_file)
  let closed = false

  await fs.rm(paths.temp, { recursive: true, force: true })
  await ensureDir(paths.temp)

  async function load(): Promise<{ pool: Pool; instance_config: InstanceConfig }> {
    const pool_exists = await fileExists(paths.pool_file)
    const members_exists = await fileExists(paths.members_file)
    const gallery_files = await listJsonFiles(paths.galleries)

    if (!pool_exists && !members_exists && gallery_files.length === 0) {
      if (!options.allow_empty_data) {
        throw new Error(`storage 为空，但当前环境不允许创建空数据: ${paths.root}`)
      }

      const empty = createPool([], [])
      await writeJsonAtomic(paths.pool_file, toPoolFile(empty))
      await writeJsonAtomic(paths.members_file, [])
      const instance_config = await loadInstanceConfig(paths)
      logger?.info('created empty storage', { storage_path: paths.root })
      return { pool: empty, instance_config }
    }

    if (!pool_exists || !members_exists) {
      throw new Error(`storage 数据不完整: ${paths.root}`)
    }

    const pool_file = parsePoolFile(await readJsonFile(paths.pool_file))
    const pool_base = fromPoolFile(pool_file)
    const loaded = await loadPoolFromDisk(paths)

    const max_id = maxEntityId(loaded)
    const next_id = Math.max(Number(pool_base.next_id), max_id + 1)

    let pool: Pool = {
      ...loaded,
      schema_version: pool_base.schema_version,
      next_id: asNextID(next_id),
    }
    validatePool(pool)

    if (Number(pool.next_id) !== Number(pool_base.next_id)) {
      await writeJsonAtomic(paths.pool_file, toPoolFile(pool))
      logger?.warn('reconciled next_id from persisted entities', {
        old_next_id: pool_base.next_id,
        next_id: pool.next_id,
      })
    }

    const instance_config = await loadInstanceConfig(paths)
    return { pool, instance_config }
  }

  async function storeByDiff(latest: Pool, prev: Pool): Promise<void> {
    validatePool(latest)

    if (
      latest.schema_version !== prev.schema_version ||
      latest.next_id !== prev.next_id
    ) {
      await writeJsonAtomic(paths.pool_file, toPoolFile(latest))
    }

    if (latest.members !== prev.members) {
      const members = latest.members
        .valueSeq()
        .toArray()
        .sort((left, right) => Number(left.id) - Number(right.id))
        .map(toMemberJson)
      await writeJsonAtomic(paths.members_file, members)
    }

    const diff = diffGalleriesMap(latest.galleries, prev.galleries)

    for (const gallery of diff.adds.values()) {
      await writeJsonAtomic(
        path.join(paths.galleries, `${gallery.id}.json`),
        toGalleryJson(gallery),
      )
    }
    for (const gallery of diff.changes.values()) {
      await writeJsonAtomic(
        path.join(paths.galleries, `${gallery.id}.json`),
        toGalleryJson(gallery),
      )
    }
    for (const gallery of diff.dels.values()) {
      await removeFile(path.join(paths.galleries, `${gallery.id}.json`))
    }
  }

  async function storeInstanceConfig(config: InstanceConfig): Promise<void> {
    await writeJsonAtomic(paths.instance_config_file, config)
  }

  function imagePath(kind: ImageKind, filename: string): string {
    if (!isSafeFilename(filename)) {
      throw notFound('图片不存在')
    }
    const dir = kind === 'source'
      ? paths.source
      : kind === 'optimized'
        ? paths.optimized
        : paths.thumb
    return path.join(dir, filename)
  }

  async function readImage(kind: ImageKind, filename: string): Promise<Buffer> {
    const file = imagePath(kind, filename)
    try {
      return await fs.readFile(file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw notFound('图片不存在')
      }
      throw error
    }
  }

  function tempPath(filename: string): string {
    if (!isSafeFilename(filename)) {
      throw new Error('非法的 temp 文件名')
    }
    return path.join(paths.temp, filename)
  }

  async function findTempFile(temp_id: string): Promise<string | null> {
    if (!isUuidV7(temp_id)) {
      return null
    }
    const prefix = `${temp_id}.`
    let entries: string[]
    try {
      entries = await fs.readdir(paths.temp)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
    return entries.find((name) => (
      name.startsWith(prefix)
      && isSafeFilename(name)
      && formatFromFilename(name) !== null
    )) ?? null
  }

  async function saveTempFile(filename: string, buffer: Buffer): Promise<void> {
    await writeBufferAtomic(tempPath(filename), buffer)
  }

  async function removeTemp(filename: string): Promise<void> {
    await removeFile(tempPath(filename))
  }

  async function removeImage(source_filename: string): Promise<void> {
    if (!isSafeFilename(source_filename)) {
      throw new Error('非法的图片文件名')
    }
    const photo_base = photoThumbFilename(source_filename)
    const source_ext = source_filename.slice(source_filename.lastIndexOf('.') + 1).toLowerCase()
    const legacy_thumb_base = `${source_filename.slice(0, source_filename.lastIndexOf('.'))}.${source_ext}`

    await removeFile(path.join(paths.source, source_filename))

    // Optimized: current SDR/HDR files plus all pre-variant and pre-avif names.
    for (const variant of ['sdr', 'hdr'] as const) {
      const variant_name = photoVariantFilename(source_filename, variant)
      const legacy_variant_name = legacyPhotoVariantFilename(source_filename, variant)
      await removeFile(path.join(paths.optimized, variant_name))
      if (legacy_variant_name !== variant_name) {
        await removeFile(path.join(paths.optimized, legacy_variant_name))
      }
    }
    for (const legacy_name of legacyUnversionedPhotoFilenames(source_filename)) {
      await removeFile(path.join(paths.optimized, legacy_name))
    }

    // Thumb: current no-suffix file, old variant files and old avatar same-name file.
    await removeFile(path.join(paths.thumb, photo_base))
    for (const variant of ['sdr', 'hdr'] as const) {
      const legacy_variant_name = legacyPhotoVariantFilename(source_filename, variant)
      if (legacy_variant_name !== photo_base) {
        await removeFile(path.join(paths.thumb, legacy_variant_name))
      }
      const old_avif_variant = photoVariantFilename(source_filename, variant)
      if (old_avif_variant !== photo_base) {
        await removeFile(path.join(paths.thumb, old_avif_variant))
      }
    }
    if (legacy_thumb_base !== photo_base) {
      await removeFile(path.join(paths.thumb, legacy_thumb_base))
    }
    await removeFile(path.join(paths.thumb, source_filename))
  }

  async function cleanupTemp(): Promise<void> {
    await fs.rm(paths.temp, { recursive: true, force: true })
    await ensureDir(paths.temp)
  }

  async function close(): Promise<void> {
    if (closed) {
      return
    }
    closed = true
    await lock.release()
  }

  return {
    paths,
    load,
    storeByDiff,
    storeInstanceConfig,
    readImage,
    imagePath,
    tempPath,
    findTempFile,
    saveTempFile,
    removeTemp,
    removeImage,
    cleanupTemp,
    close,
  }
}

export type { StorageLock }
