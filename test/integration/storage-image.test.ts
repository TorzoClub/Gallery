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
function variantName(source: string, variant: 'sdr' | 'hdr'): string {
  const dot = source.lastIndexOf('.')
  return `${source.slice(0, dot)}-${variant}${source.slice(dot)}`
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
  it('serves source/optimized/thumb and refreshes derived images', async () => {
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
    expect(photo.is_hdr).toBe(false)
    expect(photo.thumb).toBe(variantName(source_name, 'sdr'))

    const source_response = await ctx.app.request(`/images/source/${photo.src}`)
    expect(source_response.status).toBe(200)
    expect(source_response.headers.get('content-type')).toBe('image/png')
    expect(source_response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(Buffer.from(await source_response.arrayBuffer())).toEqual(image)

    const optimized_url = `/images/optimized/${variantName(source_name, 'sdr')}`
    const optimized_response = await ctx.app.request(optimized_url)
    expect(optimized_response.status).toBe(200)
    expect(optimized_response.headers.get('content-type')).toBe('image/avif')
    expect(optimized_response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    const optimized_metadata = await sharp(Buffer.from(await optimized_response.arrayBuffer())).metadata()
    expect(optimized_metadata.format).toBe('heif')
    expect(optimized_metadata.width).toBe(300)
    expect(optimized_metadata.height).toBe(200)

    const hdr_response = await ctx.app.request(`/images/optimized/${variantName(source_name, 'hdr')}`)
    expect(hdr_response.status).toBe(404)

    const thumb_response = await ctx.app.request(`/images/thumb/${photo.thumb}`)
    expect(thumb_response.status).toBe(200)
    expect(thumb_response.headers.get('content-type')).toBe('image/avif')
    expect(thumb_response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')

    await fs.rm(ctx.storage.imagePath('optimized', variantName(source_name, 'sdr')))
    const thumb_path = ctx.storage.imagePath('thumb', photo.thumb as string)
    await fs.rm(thumb_path)
    const refreshed = await ctx.adminMutate('adminRefreshThumb', { photo_id: photo.id })
    expect(refreshed.status).toBe(200)
    await expect(fs.access(ctx.storage.imagePath('optimized', variantName(source_name, 'sdr'))))
      .resolves.toBeUndefined()
    await expect(fs.access(thumb_path)).resolves.toBeUndefined()

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
    const metadata = await sharp(ori6_path).metadata()
    const expected = expectedOrientedSize(metadata)

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
    expect(source_metadata.width).toBe(metadata.width)
    expect(source_metadata.height).toBe(metadata.height)
    expect(source_metadata.orientation).toBe(6)

    const optimized_response = await ctx.app.request(`/images/optimized/${variantName(photo.src, 'sdr')}`)
    expect(optimized_response.status).toBe(200)
    const optimized_metadata = await sharp(Buffer.from(await optimized_response.arrayBuffer())).metadata()
    expect(optimized_metadata.width).toBe(expected.width)
    expect(optimized_metadata.height).toBe(expected.height)

    const thumb_response = await ctx.app.request(`/images/thumb/${photo.thumb}`)
    expect(thumb_response.status).toBe(200)
    const thumb_metadata = await sharp(Buffer.from(await thumb_response.arrayBuffer())).metadata()
    expect(thumb_metadata.width).toBeGreaterThan(thumb_metadata.height)
    expect(thumb_metadata.width).toBe(640)
    expect(thumb_metadata.height).toBe(Math.round(expected.height * 640 / expected.width))
  })

  it('generates SDR and HDR variants for 10-bit AVIF input', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51006 })
    const gallery = await ctx.createGallery()
    const avif = await sharp(await makePng(240, 160))
      .avif({ bitdepth: 10, quality: 75, effort: 6 })
      .toBuffer()
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image: avif,
      image_filename: 'hdr.avif',
    })
    expect(photo.is_hdr).toBe(true)
    const photo_src = photo.src as string
    const photo_thumb = photo.thumb as string

    const source_response = await ctx.app.request(`/images/source/${photo_src}`)
    expect(source_response.status).toBe(200)
    expect(Buffer.from(await source_response.arrayBuffer())).toEqual(avif)

    const sdr_url = `/images/optimized/${variantName(photo_src, 'sdr')}`
    const hdr_url = `/images/optimized/${variantName(photo_src, 'hdr')}`
    const sdr_response = await ctx.app.request(sdr_url)
    const hdr_response = await ctx.app.request(hdr_url)
    expect(sdr_response.status).toBe(200)
    expect(hdr_response.status).toBe(200)
    expect(sdr_response.headers.get('content-type')).toBe('image/avif')
    expect(hdr_response.headers.get('content-type')).toBe('image/avif')

    const sdr = await sharp(Buffer.from(await sdr_response.arrayBuffer())).metadata()
    const hdr = await sharp(Buffer.from(await hdr_response.arrayBuffer())).metadata()
    expect(sdr.bitsPerSample).toBe(8)
    expect(hdr.bitsPerSample).toBe(10)

    expect(photo_thumb).toBe(variantName(photo_src, 'sdr'))
    const sdr_thumb = await ctx.app.request(`/images/thumb/${photo_thumb}`)
    const hdr_thumb = await ctx.app.request(`/images/thumb/${variantName(photo_src, 'hdr')}`)
    expect(sdr_thumb.status).toBe(200)
    expect(hdr_thumb.status).toBe(200)
    expect(sdr_thumb.headers.get('content-type')).toBe('image/avif')
    expect(hdr_thumb.headers.get('content-type')).toBe('image/avif')

    await fs.rm(ctx.storage.imagePath('optimized', variantName(photo_src, 'sdr')))
    await fs.rm(ctx.storage.imagePath('optimized', variantName(photo_src, 'hdr')))
    await fs.rm(ctx.storage.imagePath('thumb', variantName(photo_src, 'sdr')))
    await fs.rm(ctx.storage.imagePath('thumb', variantName(photo_src, 'hdr')))
    const refreshed = await ctx.adminMutate('adminRefreshThumb', { photo_id: photo.id })
    expect(refreshed.status).toBe(200)
    for (const kind of ['optimized', 'thumb'] as const) {
      for (const variant of ['sdr', 'hdr'] as const) {
        await expect(fs.access(ctx.storage.imagePath(kind, variantName(photo_src, variant))))
          .resolves.toBeUndefined()
      }
    }
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

  it('stores avatar source and SDR thumb under the same filename', async () => {
    const ctx = await context()
    const avatar = await makePng(300, 200)
    const member = await ctx.createMember({ qq_num: 51007, avatar })
    const avatar_src = member.avatar_src as string
    const avatar_thumb = member.avatar_thumb as string
    expect(avatar_src).toBe(avatar_thumb)
    expect(avatar_thumb).toMatch(/^avatar-51007-[0-9a-f]{8}\.png$/)

    const source_response = await ctx.app.request(`/images/source/${avatar_src}`)
    expect(source_response.status).toBe(200)
    expect(Buffer.from(await source_response.arrayBuffer())).toEqual(avatar)

    const thumb_response = await ctx.app.request(`/images/thumb/${avatar_thumb}`)
    expect(thumb_response.status).toBe(200)
    expect(thumb_response.headers.get('content-type')).toBe('image/avif')
    const thumb = await sharp(Buffer.from(await thumb_response.arrayBuffer())).metadata()
    expect(thumb.bitsPerSample).toBe(8)

    const hdr_avatar = await sharp(await makePng(300, 200))
      .avif({ bitdepth: 10, quality: 75, effort: 6 })
      .toBuffer()
    const hdr_member = await ctx.createMember({
      qq_num: 51008,
      avatar: hdr_avatar,
      avatar_filename: 'avatar.avif',
    })
    expect(hdr_member.avatar_src).toBe(hdr_member.avatar_thumb)
    const hdr_avatar_thumb = hdr_member.avatar_thumb as string
    const hdr_thumb_response = await ctx.app.request(`/images/thumb/${hdr_avatar_thumb}`)
    expect(hdr_thumb_response.status).toBe(200)
    const hdr_thumb = await sharp(Buffer.from(await hdr_thumb_response.arrayBuffer())).metadata()
    expect(hdr_thumb.bitsPerSample).toBe(8)
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
    const old_base = old_source.slice(0, old_source.lastIndexOf('.'))
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
    expect(updated.body.data.thumb).toBe(variantName(first_source, 'sdr'))

    await expect(fs.access(ctx.storage.imagePath('source', old_source)))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('optimized', variantName(old_source, 'sdr'))))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('thumb', variantName(old_source, 'sdr'))))
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
    expect(second.body.data.thumb).toBe(variantName(second_source, 'sdr'))
    await expect(fs.access(ctx.storage.imagePath('source', first_source)))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('optimized', variantName(first_source, 'sdr'))))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('thumb', variantName(first_source, 'sdr'))))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('source', second_source)))
      .resolves.toBeUndefined()
    await expect(fs.access(ctx.storage.imagePath('optimized', variantName(second_source, 'sdr'))))
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
