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
import { formatFromFilename, isSafeFilename, thumbFilename } from '../common/image-name'
import { crc32ToHex } from '../common/crc32'
import { isUuidV7, uuidV7Timestamp, uuidv7 } from '../common/uuid'
import { type PhotoDraft } from '../core/Photo'
import { type Pool } from '../core/Pool'
import { type InstanceConfig } from '../config/instance'
import { type Storage } from '../storage'
import { fileExists } from '../storage/fs'
import {
  readImageInfo,
  writeSourceImage,
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
  cleanUnusedImages(pool: Pool): Promise<string[]>
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

function thumbNamesOfSources(sources: Iterable<string>): Set<string> {
  const result = new Set<string>()
  for (const source of sources) {
    result.add(thumbFilename(source))
  }
  return result
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

  async function prepareImage(input: {
    temp_filename: string
    format: string
    crc32: number
    prefix: string
    thumb_size: number
  }): Promise<PreparedImage> {
    const temp_path = storage.tempPath(input.temp_filename)
    const source_filename = `${input.prefix}-${crc32ToHex(input.crc32)}.${input.format}`
    const thumb_name = thumbFilename(source_filename)
    const source_path = storage.imagePath('source', source_filename)
    const thumb_path = storage.imagePath('thumb', thumb_name)
    const source_existed = await fileExists(source_path)
    const thumb_existed = await fileExists(thumb_path)
    let source_created = false
    let thumb_created = false
    let discarded = false

    const discard = async (): Promise<void> => {
      if (discarded) {
        return
      }
      discarded = true
      if (source_created) {
        await fs.rm(source_path, { force: true })
      }
      if (thumb_created) {
        await fs.rm(thumb_path, { force: true })
      }
    }

    try {
      let source_info: ImageInfo
      if (source_existed) {
        source_info = await readImageInfo(source_path)
      } else {
        source_info = await writeSourceImage({
          input_path: temp_path,
          output_path: source_path,
          max_dimension: getConfig().max_image_dimension,
        })
        source_created = true
      }

      if (!(source_existed && thumb_existed)) {
        await writeThumbImage({
          input_path: source_path,
          output_path: thumb_path,
          size: input.thumb_size,
          quality: getConfig().image_thumb_quality,
          effort: getConfig().image_thumb_effort,
        })
        thumb_created = true
      }

      return {
        src: source_filename,
        width: source_info.width,
        height: source_info.height,
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
      })
      return {
        id: input.photo_id,
        index: input.index,
        desc: input.desc,
        src: prepared.src,
        width: prepared.width,
        height: prepared.height,
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
      })
      return {
        avatar_src: prepared.src,
        discard: prepared.discard,
      }
    } finally {
      await discardTemp(input.temp_id, temp_filename)
    }
  }

  async function refreshWithSize(source_filename: string, size: number): Promise<void> {
    if (!isSafeFilename(source_filename)) {
      throw badRequest('非法的图片文件名')
    }

    const source_path = storage.imagePath('source', source_filename)
    const thumb_name = thumbFilename(source_filename)
    const thumb_path = storage.imagePath('thumb', thumb_name)
    const temp_path = storage.tempPath(`${uuidv7()}.avif`)

    try {
      await writeThumbImage({
        input_path: source_path,
        output_path: temp_path,
        size,
        quality: getConfig().image_thumb_quality,
        effort: getConfig().image_thumb_effort,
      })
      await fs.rename(temp_path, thumb_path)
    } catch (error) {
      await fs.rm(temp_path, { force: true })
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw notFound('原图不存在')
      }
      throw error
    }
  }

  async function refreshThumb(source_filename: string): Promise<void> {
    await refreshWithSize(source_filename, getConfig().image_thumb_size)
  }

  async function refreshAvatar(source_filename: string): Promise<void> {
    await refreshWithSize(source_filename, getConfig().avatar_thumb_size)
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

  async function cleanUnusedImages(pool: Pool): Promise<string[]> {
    const used_sources = sourceNamesOfPool(pool)
    const used_thumbs = thumbNamesOfSources(used_sources)
    const removed: string[] = []

    for (const filename of await storage.listImageFiles('source')) {
      if (!used_sources.has(filename)) {
        await storage.removeImage(filename)
        removed.push(storage.imagePath('source', filename))
      }
    }

    for (const filename of await storage.listImageFiles('thumb')) {
      if (!used_thumbs.has(filename)) {
        const file = storage.imagePath('thumb', filename)
        await fs.rm(file, { force: true })
        removed.push(file)
      }
    }

    return removed
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
    cleanUnusedImages,
    cleanupStaleTemps,
    close,
  }
}
