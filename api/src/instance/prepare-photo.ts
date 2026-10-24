import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  type MemberID,
  type PhotoID,
} from '../common/ID'
import {
  badRequest,
  notFound,
} from '../common/error'
import { isSafeFilename, thumbFilename } from '../common/image-name'
import { createPhoto, type Photo } from '../core/Photo'
import { type Pool } from '../core/Pool'
import { type InstanceConfig } from '../config/instance'
import { type Storage } from '../storage'
import {
  readImageInfo,
  writeSourceImage,
  writeThumbImage,
  type ImageInfo,
} from '../storage/image'

export type TempImage = {
  temp_id: string
  width: number
  height: number
  format: string
  size: number
}

export type PreparedAvatar = {
  avatar_src: string
}

export type ImagePipeline = {
  storeTempImage(input: {
    buffer: Buffer
    original_name: string
    max_upload_bytes: number
  }): Promise<TempImage>
  preparePhoto(input: {
    photo_id: PhotoID
    temp_id: string
    desc: string
    index: number
    member_id: MemberID
    now: Date
  }): Promise<Photo>
  prepareAvatar(input: {
    temp_id: string
    now: Date
  }): Promise<PreparedAvatar>
  refreshThumb(source_filename: string): Promise<void>
  refreshAvatar(source_filename: string): Promise<void>
  collectGarbage(prev: Pool, next: Pool): Promise<void>
  cleanUnusedImages(pool: Pool): Promise<string[]>
}

function safeTempId(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const safe_ext = /^\.[a-z0-9]+$/.test(ext) ? ext : '.bin'
  return `${randomUUID()}${safe_ext}`
}

function imageName(prefix: string, now: Date, format: string): string {
  return `${prefix}-${now.getTime()}-${randomUUID().slice(0, 8)}.${format}`
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
}): ImagePipeline {
  const { storage, getConfig } = options

  async function storeTempImage(input: {
    buffer: Buffer
    original_name: string
    max_upload_bytes: number
  }): Promise<TempImage> {
    if (input.buffer.length === 0) {
      throw badRequest('上传文件为空')
    }
    if (input.buffer.length > input.max_upload_bytes) {
      throw badRequest(`上传文件不能超过 ${input.max_upload_bytes} 字节`)
    }

    const temp_id = safeTempId(input.original_name)
    await storage.saveTempFile(temp_id, input.buffer)

    try {
      const info = await readImageInfo(storage.tempPath(temp_id))
      return {
        temp_id,
        width: info.width,
        height: info.height,
        format: info.format,
        size: input.buffer.length,
      }
    } catch (error) {
      await storage.removeTemp(temp_id)
      throw error
    }
  }

  async function preparePhoto(input: {
    photo_id: PhotoID
    temp_id: string
    desc: string
    index: number
    member_id: MemberID
    now: Date
  }): Promise<Photo> {
    if (!isSafeFilename(input.temp_id)) {
      throw badRequest('非法的 temp_id')
    }

    const temp_path = storage.tempPath(input.temp_id)
    let source_filename: string | undefined
    let thumb_name: string | undefined

    try {
      const info: ImageInfo = await readImageInfo(temp_path)
      source_filename = imageName(`${input.photo_id}`, input.now, info.format)
      thumb_name = thumbFilename(source_filename)

      const source_path = storage.imagePath('source', source_filename)
      const thumb_path = storage.imagePath('thumb', thumb_name)

      const source_info = await writeSourceImage({
        input_path: temp_path,
        output_path: source_path,
        max_dimension: getConfig().max_image_dimension,
      })

      await writeThumbImage({
        input_path: source_path,
        output_path: thumb_path,
        size: getConfig().image_thumb_size,
        quality: getConfig().image_thumb_quality,
        effort: getConfig().image_thumb_effort,
      })

      await storage.removeTemp(input.temp_id)

      return createPhoto({
        id: input.photo_id,
        index: input.index,
        desc: input.desc,
        src: source_filename,
        width: source_info.width,
        height: source_info.height,
        member_id: input.member_id,
      }, input.now)
    } catch (error) {
      if (source_filename !== undefined) {
        await fs.rm(storage.imagePath('source', source_filename), { force: true })
      }
      if (thumb_name !== undefined) {
        await fs.rm(storage.imagePath('thumb', thumb_name), { force: true })
      }
      await storage.removeTemp(input.temp_id)
      throw error
    }
  }

  async function prepareAvatar(input: {
    temp_id: string
    now: Date
  }): Promise<PreparedAvatar> {
    if (!isSafeFilename(input.temp_id)) {
      throw badRequest('非法的 temp_id')
    }

    const temp_path = storage.tempPath(input.temp_id)
    let source_filename: string | undefined
    let thumb_name: string | undefined

    try {
      const info = await readImageInfo(temp_path)
      source_filename = imageName('avatar', input.now, info.format)
      thumb_name = thumbFilename(source_filename)

      const source_path = storage.imagePath('source', source_filename)
      const thumb_path = storage.imagePath('thumb', thumb_name)

      await writeSourceImage({
        input_path: temp_path,
        output_path: source_path,
        max_dimension: getConfig().max_image_dimension,
      })
      await writeThumbImage({
        input_path: source_path,
        output_path: thumb_path,
        size: getConfig().avatar_thumb_size,
        quality: getConfig().image_thumb_quality,
        effort: getConfig().image_thumb_effort,
      })
      await storage.removeTemp(input.temp_id)

      return { avatar_src: source_filename }
    } catch (error) {
      if (source_filename !== undefined) {
        await fs.rm(storage.imagePath('source', source_filename), { force: true })
      }
      if (thumb_name !== undefined) {
        await fs.rm(storage.imagePath('thumb', thumb_name), { force: true })
      }
      await storage.removeTemp(input.temp_id)
      throw error
    }
  }

  async function refreshWithSize(source_filename: string, size: number): Promise<void> {
    if (!isSafeFilename(source_filename)) {
      throw badRequest('非法的图片文件名')
    }

    const source_path = storage.imagePath('source', source_filename)
    const thumb_name = thumbFilename(source_filename)
    const thumb_path = storage.imagePath('thumb', thumb_name)
    const temp_path = storage.tempPath(`${randomUUID()}.avif`)

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

  return {
    storeTempImage,
    preparePhoto,
    prepareAvatar,
    refreshThumb,
    refreshAvatar,
    collectGarbage,
    cleanUnusedImages,
  }
}
