import fs from 'node:fs/promises'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import {
  type GalleryID,
  type MemberID,
  type PhotoID,
} from '../common/ID'
import {
  badRequest,
  notFound,
} from '../common/error'
import {
  avatarThumbFilename,
  formatFromFilename,
  isSafeFilename,
  legacyPhotoVariantFilename,
  legacyUnversionedPhotoFilenames,
  photoThumbFilename,
  photoVariantFilename,
} from '../common/image-name'
import { crc32ToHex } from '../common/crc32'
import { isUuidV7, uuidV7Timestamp, uuidv7 } from '../common/uuid'
import { type PhotoDraft } from '../core/Photo'
import { type Pool } from '../core/Pool'
import { type InstanceConfig } from '../config/instance'
import { type Storage } from '../storage'
import { fileExists } from '../storage/fs'
import {
  readImageInfo,
  writeOptimizedImage,
  writeThumbImage,
  type ImageInfo,
} from '../storage/image'

export const TEMP_IMAGE_TTL_MS = 24 * 60 * 60 * 1000
export const TEMP_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

export type TempImage = {
  temp_id: string
  width: number
  height: number
  format: string
  size: number
  crc32: number
}

type PreparedImage = {
  src: string
  width: number
  height: number
  has_hdr_optimized: boolean
  discard(): Promise<void>
}

export type PreparedPhoto = PhotoDraft & {
  discard(): Promise<void>
}

export type PreparedAvatar = {
  avatar_src: string
  discard(): Promise<void>
}

export type ImagePipeline = {
  storeTempImage(input: {
    stream: Readable
    temp_id: string
    format: string
    crc32: Promise<number>
  }): Promise<TempImage>
  preparePhoto(input: {
    gallery_id: GalleryID
    photo_id: PhotoID
    temp_id: string
    desc: string
    index: number
    member_id: MemberID
  }): Promise<PreparedPhoto>
  prepareAvatar(input: {
    qq_num: number
    temp_id: string
  }): Promise<PreparedAvatar>
  refreshThumb(source_filename: string): Promise<void>
  refreshAvatar(source_filename: string): Promise<void>
  collectGarbage(prev: Pool, next: Pool): Promise<void>
  cleanupStaleTemps(): Promise<void>
  close(): Promise<void>
}

type TempMetadata = {
  crc32: number
  format: string
  size: number
}

function sourceNamesOfPool(pool: Pool): Set<string> {
  const used = new Set<string>()
  pool.galleries.forEach((gallery) => {
    gallery.photos.forEach((photo) => used.add(photo.src))
  })
  pool.members.forEach((member) => used.add(member.avatar_src))
  return used
}

export function createImagePipeline(options: {
  storage: Storage
  getConfig: () => InstanceConfig
  now?: () => number
  cleanup_interval_ms?: number
}): ImagePipeline {
  const { storage, getConfig } = options
  const now = options.now ?? Date.now
  const cleanup_interval_ms = options.cleanup_interval_ms ?? TEMP_CLEANUP_INTERVAL_MS
  const temp_metadata = new Map<string, TempMetadata>()
  let closing = false
  let cleanup_promise: Promise<void> | null = null

  async function storeTempImage(input: {
    stream: Readable
    temp_id: string
    format: string
    crc32: Promise<number>
  }): Promise<TempImage> {
    if (!isUuidV7(input.temp_id)) {
      throw badRequest('非法的 temp_id')
    }
    const format = formatFromFilename(`upload.${input.format}`)
    if (format === null || format !== input.format) {
      throw badRequest('不支持的图片格式')
    }

    const temp_filename = `${input.temp_id}.${format}`
    const temp_path = storage.tempPath(temp_filename)

    try {
      await pipeline(
        input.stream,
        createWriteStream(temp_path, { flags: 'wx', mode: 0o600 }),
      )
      const crc32 = await input.crc32
      const info = await readImageInfo(temp_path)
      if (info.format !== format) {
        throw badRequest(`图片实际格式(${info.format})与扩展名(${format})不一致`)
      }
      const stat = await fs.stat(temp_path)
      temp_metadata.set(input.temp_id, {
        crc32,
        format: info.format,
        size: stat.size,
      })
      return {
        temp_id: input.temp_id,
        width: info.width,
        height: info.height,
        format: info.format,
        size: stat.size,
        crc32,
      }
    } catch (error) {
      await fs.rm(temp_path, { force: true })
      temp_metadata.delete(input.temp_id)
      throw error
    }
  }

  async function cleanupLegacyPhotoVariants(
    source_filename: string,
    kind: 'optimized' | 'thumb',
    variant: 'sdr' | 'hdr',
  ): Promise<void> {
    const legacy_variant = legacyPhotoVariantFilename(source_filename, variant)
    const current_variant = kind === 'optimized'
      ? photoVariantFilename(source_filename, variant)
      : photoThumbFilename(source_filename)
    if (legacy_variant !== current_variant) {
      await fs.rm(storage.imagePath(kind, legacy_variant), { force: true })
    }
    // Early AVIF naming used -sdr.avif in the thumb directory.
    if (kind === 'thumb') {
      const old_avif_variant = photoVariantFilename(source_filename, variant)
      if (old_avif_variant !== current_variant) {
        await fs.rm(storage.imagePath(kind, old_avif_variant), { force: true })
      }
    }
    const legacy_names = kind === 'optimized'
      ? legacyUnversionedPhotoFilenames(source_filename)
      : legacyUnversionedPhotoFilenames(source_filename)
          .filter(name => name !== photoThumbFilename(source_filename))
    for (const legacy_name of legacy_names) {
      await fs.rm(storage.imagePath(kind, legacy_name), { force: true })
    }
  }

  async function prepareImage(input: {
    temp_filename: string
    format: string
    crc32: number
    prefix: string
    thumb_size: number
    kind: 'photo' | 'avatar'
  }): Promise<PreparedImage> {
    const temp_path = storage.tempPath(input.temp_filename)
    const source_filename = `${input.prefix}-${crc32ToHex(input.crc32)}.${input.format}`
    const source_path = storage.imagePath('source', source_filename)
    const source_existed = await fileExists(source_path)
    let source_created = false
    let discarded = false

    type DerivedFile = {
      kind: 'optimized' | 'thumb'
      variant: 'sdr' | 'hdr'
      path: string
      existed: boolean
      created: boolean
    }

    const derived: DerivedFile[] = []

    const discard = async (): Promise<void> => {
      if (discarded) {
        return
      }
      discarded = true
      if (source_created) {
        await fs.rm(source_path, { force: true })
      }
      for (const file of derived) {
        if (file.created) {
          await fs.rm(file.path, { force: true })
        }
      }
    }

    try {
      if (!source_existed) {
        const staging = storage.tempPath(`${uuidv7()}.${input.format}`)
        try {
          await fs.copyFile(temp_path, staging)
          await fs.rename(staging, source_path)
        } finally {
          await fs.rm(staging, { force: true })
        }
        source_created = true
      }

      const source_info = source_existed
        ? await readImageInfo(source_path)
        : await readImageInfo(temp_path)

      if (input.kind === 'photo') {
        const target = storage.imagePath(
          'optimized',
          photoVariantFilename(source_filename, 'sdr'),
        )
        derived.push({
          kind: 'optimized',
          variant: 'sdr',
          path: target,
          existed: await fileExists(target),
          created: false,
        })
        const thumb_target = storage.imagePath('thumb', photoThumbFilename(source_filename))
        derived.push({
          kind: 'thumb',
          variant: 'sdr',
          path: thumb_target,
          existed: await fileExists(thumb_target),
          created: false,
        })
      } else {
        const target = storage.imagePath('thumb', avatarThumbFilename(source_filename))
        derived.push({
          kind: 'thumb',
          variant: 'sdr',
          path: target,
          existed: await fileExists(target),
          created: false,
        })
      }

      for (const file of derived) {
        if (!source_created && file.existed) {
          continue
        }
        file.created = true
        const staging = storage.tempPath(`${uuidv7()}.avif`)
        try {
          if (file.kind === 'optimized') {
            await writeOptimizedImage({
              input_path: source_path,
              output_path: staging,
              max_dimension: getConfig().max_image_dimension,
              quality: getConfig().avif_source_quality,
              effort: getConfig().image_processing_effort,
            })
          } else {
            await writeThumbImage({
              input_path: source_path,
              output_path: staging,
              size: input.thumb_size,
              quality: getConfig().image_thumb_quality,
              effort: getConfig().image_processing_effort,
            })
          }
          await fs.rename(staging, file.path)
        } finally {
          await fs.rm(staging, { force: true })
        }
      }

      if (input.kind === 'photo') {
        for (const variant of ['sdr', 'hdr'] as const) {
          await cleanupLegacyPhotoVariants(source_filename, 'optimized', variant)
          await cleanupLegacyPhotoVariants(source_filename, 'thumb', variant)
        }
        await fs.rm(storage.imagePath('optimized', photoVariantFilename(source_filename, 'hdr')), {
          force: true,
        })
        await fs.rm(storage.imagePath('thumb', photoVariantFilename(source_filename, 'hdr')), {
          force: true,
        })
      } else if (source_filename !== avatarThumbFilename(source_filename)) {
        await fs.rm(storage.imagePath('thumb', source_filename), { force: true })
      }

      return {
        src: source_filename,
        width: source_info.width,
        height: source_info.height,
        has_hdr_optimized: false,
        discard,
      }
    } catch (error) {
      await discard()
      throw error
    }
  }

  async function loadTemp(temp_id: string): Promise<{
    meta: TempMetadata
    temp_filename: string
  }> {
    if (!isUuidV7(temp_id)) {
      throw badRequest('临时图片不存在或已过期')
    }
    const meta = temp_metadata.get(temp_id)
    const temp_filename = await storage.findTempFile(temp_id)
    if (meta === undefined || temp_filename === null) {
      throw badRequest('临时图片不存在或已过期')
    }
    return { meta, temp_filename }
  }

  async function discardTemp(temp_id: string, temp_filename: string): Promise<void> {
    temp_metadata.delete(temp_id)
    await storage.removeTemp(temp_filename)
  }

  async function preparePhoto(input: {
    gallery_id: GalleryID
    photo_id: PhotoID
    temp_id: string
    desc: string
    index: number
    member_id: MemberID
  }): Promise<PreparedPhoto> {
    const { meta, temp_filename } = await loadTemp(input.temp_id)
    try {
      const prepared = await prepareImage({
        temp_filename,
        format: meta.format,
        crc32: meta.crc32,
        prefix: `photo-${input.gallery_id}-${input.photo_id}`,
        thumb_size: getConfig().image_thumb_size,
        kind: 'photo',
      })
      return {
        id: input.photo_id,
        index: input.index,
        desc: input.desc,
        src: prepared.src,
        width: prepared.width,
        height: prepared.height,
        has_hdr_optimized: prepared.has_hdr_optimized,
        member_id: input.member_id,
        discard: prepared.discard,
      }
    } finally {
      await discardTemp(input.temp_id, temp_filename)
    }
  }

  async function prepareAvatar(input: {
    qq_num: number
    temp_id: string
  }): Promise<PreparedAvatar> {
    const { meta, temp_filename } = await loadTemp(input.temp_id)
    try {
      const prepared = await prepareImage({
        temp_filename,
        format: meta.format,
        crc32: meta.crc32,
        prefix: `avatar-${input.qq_num}`,
        thumb_size: getConfig().avatar_thumb_size,
        kind: 'avatar',
      })
      return {
        avatar_src: prepared.src,
        discard: prepared.discard,
      }
    } finally {
      await discardTemp(input.temp_id, temp_filename)
    }
  }

  async function refreshThumbFile(
    source_filename: string,
    thumb_name: string,
    size: number,
    variant: 'sdr' | 'hdr',
    cleanup_legacy: boolean,
  ): Promise<void> {
    if (!isSafeFilename(source_filename)) {
      throw badRequest('非法的图片文件名')
    }

    const source_path = storage.imagePath('source', source_filename)
    const thumb_path = storage.imagePath('thumb', thumb_name)
    const temp_path = storage.tempPath(`${uuidv7()}.avif`)

    try {
      await writeThumbImage({
        input_path: source_path,
        output_path: temp_path,
        size,
        quality: getConfig().image_thumb_quality,
        effort: getConfig().image_processing_effort,
      })
      await fs.rename(temp_path, thumb_path)
      if (cleanup_legacy) {
        await cleanupLegacyPhotoVariants(source_filename, 'thumb', variant)
      }
    } catch (error) {
      await fs.rm(temp_path, { force: true })
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw notFound('原图不存在')
      }
      throw error
    }
  }

  async function refreshOptimizedFile(
    source_filename: string,
    variant: 'sdr' | 'hdr',
  ): Promise<void> {
    if (!isSafeFilename(source_filename)) {
      throw badRequest('非法的图片文件名')
    }

    const source_path = storage.imagePath('source', source_filename)
    const optimized_path = storage.imagePath(
      'optimized',
      photoVariantFilename(source_filename, variant),
    )
    const staging = storage.tempPath(`${uuidv7()}.avif`)

    try {
      await writeOptimizedImage({
        input_path: source_path,
        output_path: staging,
        max_dimension: getConfig().max_image_dimension,
        quality: getConfig().avif_source_quality,
        effort: getConfig().image_processing_effort,
      })
      await fs.rename(staging, optimized_path)
      await cleanupLegacyPhotoVariants(source_filename, 'optimized', variant)
    } catch (error) {
      await fs.rm(staging, { force: true })
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw notFound('原图不存在')
      }
      throw error
    }
  }

  async function refreshThumb(source_filename: string): Promise<void> {
    await refreshOptimizedFile(source_filename, 'sdr')
    await refreshThumbFile(
      source_filename,
      photoThumbFilename(source_filename),
      getConfig().image_thumb_size,
      'sdr',
      true,
    )

    // HDR uses the original source directly; remove stale generated HDR files.
    await fs.rm(storage.imagePath('optimized', photoVariantFilename(source_filename, 'hdr')), {
      force: true,
    })
    await fs.rm(storage.imagePath('thumb', photoVariantFilename(source_filename, 'hdr')), {
      force: true,
    })
    await cleanupLegacyPhotoVariants(source_filename, 'optimized', 'hdr')
    await cleanupLegacyPhotoVariants(source_filename, 'thumb', 'hdr')
  }

  async function refreshAvatar(source_filename: string): Promise<void> {
    await refreshThumbFile(
      source_filename,
      avatarThumbFilename(source_filename),
      getConfig().avatar_thumb_size,
      'sdr',
      false,
    )
    if (source_filename !== avatarThumbFilename(source_filename)) {
      await fs.rm(storage.imagePath('thumb', source_filename), { force: true })
    }
  }

  async function collectGarbage(prev: Pool, next: Pool): Promise<void> {
    const prev_used = sourceNamesOfPool(prev)
    const next_used = sourceNamesOfPool(next)
    for (const source of prev_used) {
      if (!next_used.has(source)) {
        await storage.removeImage(source)
      }
    }
  }

  async function cleanupStaleTemps(): Promise<void> {
    if (closing) {
      return
    }
    if (cleanup_promise !== null) {
      return cleanup_promise
    }

    cleanup_promise = (async () => {
      const cutoff = now() - TEMP_IMAGE_TTL_MS
      let entries: string[]
      try {
        entries = await fs.readdir(storage.paths.temp)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return
        }
        throw error
      }

      for (const filename of entries) {
        const ext = path.extname(filename)
        const temp_id = filename.slice(0, filename.length - ext.length)
        if (formatFromFilename(filename) === null) {
          continue
        }
        const timestamp = uuidV7Timestamp(temp_id)
        if (timestamp === null || timestamp > cutoff) {
          continue
        }
        await storage.removeTemp(filename)
        temp_metadata.delete(temp_id)
      }
    })()

    try {
      await cleanup_promise
    } finally {
      cleanup_promise = null
    }
  }

  const cleanup_timer = setInterval(() => {
    void cleanupStaleTemps().catch(() => undefined)
  }, cleanup_interval_ms)
  cleanup_timer.unref()

  async function close(): Promise<void> {
    if (closing) {
      return
    }
    closing = true
    clearInterval(cleanup_timer)
    if (cleanup_promise !== null) {
      await cleanup_promise
    }
  }

  return {
    storeTempImage,
    preparePhoto,
    prepareAvatar,
    refreshThumb,
    refreshAvatar,
    collectGarbage,
    cleanupStaleTemps,
    close,
  }
}
