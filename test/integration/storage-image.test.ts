import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTestContext,
  makePng,
  type TestContext,
} from '../helpers/app'
import { createStorage } from '../../src/server/storage'
import { crc32Hex } from '../../src/server/common/crc32'
import { isUuidV7, uuidV7Timestamp, uuidv7 } from '../../src/server/common/uuid'
import { createLogger } from '../../src/server/logger'
import { createImagePipeline, TEMP_IMAGE_TTL_MS, TEMP_CLEANUP_INTERVAL_MS } from '../../src/server/instance/prepare-photo'

const dirs: string[] = []
let active: TestContext | undefined

afterEach(async () => {
  if (active !== undefined) {
    await active.close()
    active = undefined
  }
  for (const dir of dirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

async function context(): Promise<TestContext> {
  active = await createTestContext({ remove_dir_on_close: false })
  dirs.push(active.dir)
  return active
}

const pixel_rotated_image_path = fileURLToPath(new URL('./test-pic.jpg', import.meta.url))

async function makeExifOriented6Image(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'torzo-exif-'))
  dirs.push(dir)
  const output_path = path.join(dir, 'ori6.jpg')
  await sharp(pixel_rotated_image_path)
    .withMetadata({ orientation: 6 })
    .toFile(output_path)
  return output_path
}

type ImageMetadata = {
  width?: number | undefined
  height?: number | undefined
  orientation?: number | undefined
}

function expectedOrientedSize(metadata: ImageMetadata): { width: number; height: number } {
  if (metadata.width === undefined || metadata.height === undefined) {
    throw new Error('测试图片缺少尺寸')
  }
  return (metadata.orientation ?? 1) >= 5
    ? { width: metadata.height, height: metadata.width }
    : { width: metadata.width, height: metadata.height }
}

describe('storage persistence', () => {
  it('reloads pool, members, galleries, next_id and instance config', async () => {
    const first = await context()
    const member = await first.createMember({ qq_num: 50001, name: 'Persisted' })
    const gallery = await first.createGallery({ name: 'Persisted Gallery' })
    const photo = await first.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
    })
    await first.adminMutate('adminUpdateInstanceConfig', {
      image_thumb_size: 222,
    })

    const dir = first.dir
    await first.close()
    active = undefined

    const second = await createTestContext({
      storage_path: dir,
      remove_dir_on_close: false,
    })
    active = second
    try {
      const galleries = await second.adminQuery('adminListGalleries')
      expect(galleries.body.data).toHaveLength(1)
      expect(galleries.body.data[0].name).toBe('Persisted Gallery')

      const photos = await second.adminQuery('adminListPhotos')
      expect(photos.body.data).toHaveLength(1)
      expect(photos.body.data[0].id).toBe(photo.id)

      const config = await second.adminQuery('adminGetInstanceConfig')
      expect(config.body.data.image_thumb_size).toBe(222)

      const pool = JSON.parse(await fs.readFile(path.join(dir, 'pool.json'), 'utf8'))
      expect(pool.schema_version).toBe(1)
      expect(pool.next_id).toBeGreaterThan(photo.id as number)
    } finally {
      await second.close()
      active = undefined
    }
  })

  it('rejects a second storage instance with the same lock', async () => {
    const first = await context()
    const logger = createLogger({ level: 'error', pretty: true })

    await expect(createStorage({
      storage_path: first.dir,
      allow_empty_data: true,
      logger,
    })).rejects.toThrowError(/已被另一个进程锁定/)

    const dir = first.dir
    await first.close()
    active = undefined

    const reopened = await createStorage({
      storage_path: dir,
      allow_empty_data: true,
      logger,
    })
    await reopened.close()
  })
})

describe('image flow', () => {
  it('serves source/thumb, refreshes a thumb and cleans orphan files', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51001 })
    const gallery = await ctx.createGallery()
    const image = await makePng(300, 200)
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image,
    })
    const source_name = `photo-${gallery.id}-${photo.id}-${crc32Hex(image)}.png`
    expect(photo.src).toBe(source_name)
    expect(photo.thumb).toBe(`${source_name.slice(0, -4)}.avif`)

    const source_response = await ctx.app.request(`/images/source/${photo.src}`)
    expect(source_response.status).toBe(200)
    expect(source_response.headers.get('content-type')).toBe('image/png')
    expect(source_response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')

    const thumb_response = await ctx.app.request(`/images/thumb/${photo.thumb}`)
    expect(thumb_response.status).toBe(200)
    expect(thumb_response.headers.get('content-type')).toBe('image/avif')
    expect(thumb_response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')

    const thumb_path = ctx.storage.imagePath('thumb', photo.thumb as string)
    await fs.rm(thumb_path)
    const refreshed = await ctx.adminMutate('adminRefreshThumb', { photo_id: photo.id })
    expect(refreshed.status).toBe(200)
    await expect(fs.access(thumb_path)).resolves.toBeUndefined()

    const orphan_source = path.join(ctx.storage.paths.source, 'orphan.png')
    const orphan_thumb = path.join(ctx.storage.paths.thumb, 'orphan.avif')
    await fs.writeFile(orphan_source, 'orphan')
    await fs.writeFile(orphan_thumb, 'orphan')

    const cleaned = await ctx.adminMutate('adminCleanUnusedImages')
    expect(cleaned.status).toBe(200)
    expect(cleaned.body.data.removed).toContain(orphan_source)
    await expect(fs.access(orphan_source)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(orphan_thumb)).rejects.toMatchObject({ code: 'ENOENT' })

    // Referenced files survive.
    await expect(fs.access(ctx.storage.imagePath('source', photo.src as string)))
      .resolves.toBeUndefined()
    await expect(fs.access(thumb_path)).resolves.toBeUndefined()
  })

  it('rejects invalid image data and enforces max_upload_bytes', async () => {
    const ctx = await context()

    const invalid_form = new FormData()
    invalid_form.append('file', new File([new Uint8Array([1, 2, 3, 4])], 'bad.png', {
      type: 'image/png',
    }))
    const invalid = await ctx.app.request('/upload-image', {
      method: 'POST',
      body: invalid_form,
    })
    expect(invalid.status).toBe(400)

    await ctx.adminMutate('adminUpdateInstanceConfig', { max_upload_bytes: 2048 })
    const large_form = new FormData()
    large_form.append('file', new File([new Uint8Array(4096)], 'large.png', {
      type: 'image/png',
    }))
    const large = await ctx.app.request('/upload-image', {
      method: 'POST',
      body: large_form,
    })
    expect(large.status).toBe(413)

    const mismatch_form = new FormData()
    mismatch_form.append('file', new File([new Uint8Array(await makePng())], 'mismatch.jpg', {
      type: 'image/jpeg',
    }))
    const mismatch = await ctx.app.request('/upload-image', {
      method: 'POST',
      body: mismatch_form,
    })
    expect(mismatch.status).toBe(400)

    const bad_ext_form = new FormData()
    bad_ext_form.append('file', new File([new Uint8Array([1, 2, 3])], 'bad.php', {
      type: 'application/octet-stream',
    }))
    const bad_ext = await ctx.app.request('/upload-image', {
      method: 'POST',
      body: bad_ext_form,
    })
    expect(bad_ext.status).toBe(400)
  })

  it('handles photo dimensions rotated by EXIF Orientation', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51003 })
    const gallery = await ctx.createGallery()
    const ori6_path = await makeExifOriented6Image()
    const metadata = await sharp(ori6_path).metadata()
    const expected = expectedOrientedSize(metadata)
    expect(metadata.orientation).toBe(6)

    const buffer = await fs.readFile(ori6_path)
    const uploaded = await ctx.uploadImage(buffer, 'ori6.jpg')
    expect(uploaded.width).toBe(expected.width)
    expect(uploaded.height).toBe(expected.height)

    const response = await ctx.adminMutate('adminCreatePhoto', {
      gallery_id: gallery.id,
      member_id: member.id,
      desc: 'exif orientation',
      temp_id: uploaded.temp_id,
    })
    expect(response.status).toBe(200)
    expect(response.body.data.width).toBe(expected.width)
    expect(response.body.data.height).toBe(expected.height)
    expect(response.body.data.width).toBeGreaterThan(response.body.data.height)
  })

  it('handles thumbnails rotated by EXIF Orientation', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51004 })
    const gallery = await ctx.createGallery()
    const ori6_path = await makeExifOriented6Image()
    const expected = expectedOrientedSize(await sharp(ori6_path).metadata())

    const uploaded = await ctx.uploadImage(await fs.readFile(ori6_path), 'ori6.jpg')
    const created = await ctx.adminMutate('adminCreatePhoto', {
      gallery_id: gallery.id,
      member_id: member.id,
      desc: 'exif thumb',
      temp_id: uploaded.temp_id,
    })
    expect(created.status).toBe(200)
    const photo = created.body.data

    const source_response = await ctx.app.request(`/images/source/${photo.src}`)
    expect(source_response.status).toBe(200)
    const source_metadata = await sharp(Buffer.from(await source_response.arrayBuffer())).metadata()
    expect(source_metadata.width).toBe(expected.width)
    expect(source_metadata.height).toBe(expected.height)

    const thumb_response = await ctx.app.request(`/images/thumb/${photo.thumb}`)
    expect(thumb_response.status).toBe(200)
    const thumb_metadata = await sharp(Buffer.from(await thumb_response.arrayBuffer())).metadata()
    expect(thumb_metadata.width).toBeGreaterThan(thumb_metadata.height)
    expect(thumb_metadata.width).toBe(640)
    expect(thumb_metadata.height).toBe(Math.round(expected.height * 640 / expected.width))
  })

  it('stores uploads as UUIDv7 temp files with crc32 metadata', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51005 })
    const gallery = await ctx.createGallery()
    const image = await makePng(300, 200)
    const uploaded = await ctx.uploadImage(image)

    expect(isUuidV7(uploaded.temp_id)).toBe(true)
    expect(uploaded.crc32).toBe(Number.parseInt(crc32Hex(image), 16))
    expect(Math.abs(Date.now() - (uuidV7Timestamp(uploaded.temp_id) ?? 0))).toBeLessThan(10_000)

    const temp_path = path.join(ctx.storage.paths.temp, `${uploaded.temp_id}.${uploaded.format}`)
    await expect(fs.access(temp_path)).resolves.toBeUndefined()

    const path_attack = await ctx.uploadImage(await makePng(), '../../evil.png')
    expect(isUuidV7(path_attack.temp_id)).toBe(true)
    const attack_path = path.join(ctx.storage.paths.temp, `${path_attack.temp_id}.png`)
    await expect(fs.access(attack_path)).resolves.toBeUndefined()
    expect(path.basename(attack_path)).not.toContain('evil')

    const created = await ctx.adminMutate('adminCreatePhoto', {
      gallery_id: gallery.id,
      member_id: member.id,
      desc: 'temp upload',
      temp_id: uploaded.temp_id,
    })
    expect(created.status).toBe(200)
    await expect(fs.access(temp_path)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('cleans only stale UUIDv7 temp files', async () => {
    const ctx = await context()
    const now_ms = Date.now()
    const pipeline = createImagePipeline({
      storage: ctx.storage,
      getConfig: () => ctx.instance.getInstanceConfig(),
      now: () => now_ms,
    })
    const old_id = uuidv7({ msecs: now_ms - TEMP_IMAGE_TTL_MS - 1000 })
    const recent_id = uuidv7({ msecs: now_ms - 1000 })
    const old_path = path.join(ctx.storage.paths.temp, `${old_id}.png`)
    const recent_path = path.join(ctx.storage.paths.temp, `${recent_id}.png`)
    await fs.writeFile(old_path, 'old')
    await fs.writeFile(recent_path, 'recent')

    try {
      await pipeline.cleanupStaleTemps()
      await expect(fs.access(old_path)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(fs.access(recent_path)).resolves.toBeUndefined()
    } finally {
      await pipeline.close()
    }
  })

  it('stops the cleanup timer on close', async () => {
    const ctx = await context()
    vi.useFakeTimers()
    const pipeline = createImagePipeline({
      storage: ctx.storage,
      getConfig: () => ctx.instance.getInstanceConfig(),
      cleanup_interval_ms: TEMP_CLEANUP_INTERVAL_MS,
    })
    expect(vi.getTimerCount()).toBe(1)
    await pipeline.close()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })

  it('replaces a photo image and removes the old files', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51002 })
    const gallery = await ctx.createGallery()
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image: await makePng(300, 200),
    })

    const old_source = photo.src as string
    const old_thumb = photo.thumb as string
    const first_image = await makePng(320, 240, { r: 10, g: 20, b: 220 })
    const temp = await ctx.uploadImage(first_image)
    const updated = await ctx.adminMutate('adminUpdatePhoto', {
      gallery_id: gallery.id,
      photo_id: photo.id,
      temp_id: temp.temp_id,
    })
    expect(updated.status).toBe(200)
    const first_source = `photo-${gallery.id}-${photo.id}-${crc32Hex(first_image)}.png`
    expect(updated.body.data.src).toBe(first_source)
    expect(updated.body.data.thumb).toBe(`${first_source.slice(0, -4)}.avif`)

    await expect(fs.access(ctx.storage.imagePath('source', old_source)))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('thumb', old_thumb)))
      .rejects.toMatchObject({ code: 'ENOENT' })

    const second_image = await makePng(340, 260)
    const second_temp = await ctx.uploadImage(second_image)
    const second = await ctx.adminMutate('adminUpdatePhoto', {
      gallery_id: gallery.id,
      photo_id: photo.id,
      temp_id: second_temp.temp_id,
    })
    expect(second.status).toBe(200)
    const second_source = `photo-${gallery.id}-${photo.id}-${crc32Hex(second_image)}.png`
    expect(second.body.data.src).toBe(second_source)
    expect(second.body.data.thumb).toBe(`${second_source.slice(0, -4)}.avif`)
    await expect(fs.access(ctx.storage.imagePath('source', first_source)))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('thumb', `${first_source.slice(0, -4)}.avif`)))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('source', second_source)))
      .resolves.toBeUndefined()

    // 相同内容复用同一个 CRC 文件名，不产生新文件。
    const same_temp = await ctx.uploadImage(second_image)
    const same = await ctx.adminMutate('adminUpdatePhoto', {
      gallery_id: gallery.id,
      photo_id: photo.id,
      temp_id: same_temp.temp_id,
    })
    expect(same.status).toBe(200)
    expect(same.body.data.src).toBe(second_source)
    await expect(fs.access(ctx.storage.imagePath('source', second_source)))
      .resolves.toBeUndefined()
  })
})
