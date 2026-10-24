import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createTestContext,
  makePng,
  type TestContext,
} from '../helpers/app'
import { createStorage } from '../../src/server/storage'
import { createLogger } from '../../src/server/logger'

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
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image: await makePng(300, 200),
    })

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

    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image: await fs.readFile(ori6_path),
    })

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
    const temp = await ctx.uploadImage(await makePng(320, 240, { r: 10, g: 20, b: 220 }))
    const updated = await ctx.adminMutate('adminUpdatePhoto', {
      gallery_id: gallery.id,
      photo_id: photo.id,
      temp_id: temp.temp_id,
    })
    expect(updated.status).toBe(200)
    expect(updated.body.data.src).not.toBe(old_source)

    await expect(fs.access(ctx.storage.imagePath('source', old_source)))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('thumb', old_thumb)))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })
})
