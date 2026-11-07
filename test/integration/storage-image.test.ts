import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { crc32 } from 'node:zlib'
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
import { hdrToolsAvailable } from '../../src/server/storage/hdr'
import { heicToolsAvailable } from '../../src/server/storage/heic-hdr'

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
function pngWithCicp(png: Buffer, values: readonly [number, number, number, number]): Buffer {
  const type = Buffer.from('cICP')
  const data = Buffer.from(values)
  const header = Buffer.alloc(8)
  header.writeUInt32BE(data.length, 0)
  type.copy(header, 4)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0)
  const chunk = Buffer.concat([header, data, crc])
  const first_idat = png.indexOf(Buffer.from('IDAT')) - 4
  return Buffer.concat([png.subarray(0, first_idat), chunk, png.subarray(first_idat)])
}

async function makeHdrPng(values: readonly [number, number, number, number]): Promise<Buffer> {
  const png = await sharp({
    create: {
      width: 320,
      height: 200,
      channels: 3,
      background: { r: 20000, g: 12000, b: 6000 },
    },
  }).toColourspace('rgb16').png().toBuffer()
  return pngWithCicp(png, values)
}

async function avifCicp(file_path: string): Promise<string> {
  const { stdout } = await promisify(execFile)('avifdec', ['--info', file_path])
  return stdout
}
async function runTool(command: string, args: string[]): Promise<void> {
  await promisify(execFile)(command, args)
}

async function makeAvifGainMap(): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'torzo-hdr-gain-'))
  dirs.push(dir)
  const sdr_png = path.join(dir, 'sdr.png')
  const hdr_png = path.join(dir, 'hdr.png')
  const sdr_avif = path.join(dir, 'sdr.avif')
  const hdr_avif = path.join(dir, 'hdr.avif')
  const gain_avif = path.join(dir, 'gain.avif')
  await fs.writeFile(sdr_png, await makePng(320, 200))
  await fs.writeFile(hdr_png, await makeHdrPng([9, 16, 9, 1]))
  await runTool('avifenc', [
    '--depth', '8', '--cicp', '1/13/1', '--range', 'full',
    '--ignore-icc', '--ignore-exif', '--ignore-xmp', sdr_png, sdr_avif,
  ])
  await runTool('avifenc', [
    '--depth', '10', '--cicp', '9/16/9', '--range', 'full',
    '--ignore-icc', '--ignore-exif', '--ignore-xmp', hdr_png, hdr_avif,
  ])
  await runTool('avifgainmaputil', ['combine', sdr_avif, hdr_avif, gain_avif, '--ignore-profile'])
  return fs.readFile(gain_avif)
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
  return `${source.slice(0, dot)}-${variant}.avif`
}

function thumbName(source: string): string {
  const dot = source.lastIndexOf('.')
  return `${source.slice(0, dot)}.avif`
}

function filenameFromUrl(value: string): string {
  return decodeURIComponent(new URL(value).pathname.split('/').pop() as string)
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
      const admin_pool = await second.adminPool()
      expect(admin_pool.galleries).toHaveLength(1)
      expect(admin_pool.galleries[0]?.name).toBe('Persisted Gallery')
      expect(admin_pool.galleries.flatMap(gallery => gallery.photos)[0]?.id).toBe(photo.id)
      expect(admin_pool.instance_config.image_thumb_size).toBe(222)

      const pool = JSON.parse(await fs.readFile(path.join(dir, 'pool.json'), 'utf8'))
      expect(pool.schema_version).toBe(2)
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
  it('handles two concurrent photo preparations', async () => {
    const ctx = await context()
    const memberA = await ctx.createMember({ qq_num: 52001 })
    const memberB = await ctx.createMember({ qq_num: 52002 })
    const gallery = await ctx.createGallery()
    const image = await makePng(320, 200)

    const [photoA, photoB] = await Promise.all([
      ctx.createPhoto({
        gallery_id: gallery.id as number,
        member_id: memberA.id as number,
        image,
      }),
      ctx.createPhoto({
        gallery_id: gallery.id as number,
        member_id: memberB.id as number,
        image,
      }),
    ])

    expect(photoA.src).not.toBe(photoB.src)
    expect(photoA.has_hdr_optimized).toBe(false)
    expect(photoB.has_hdr_optimized).toBe(false)
    expect(photoA.thumb).toBeTruthy()
    expect(photoB.thumb).toBeTruthy()
  })

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
    expect(photo.has_hdr_optimized).toBe(false)
    const thumb_name = thumbName(source_name)
    const optimized_name = variantName(source_name, 'sdr')
    const instance_hash = ctx.instance.getInstanceHash()
    expect(photo.thumb).toContain(`/images/thumb/${thumb_name}?v=${instance_hash}`)
    expect(photo.thumb_url).toBe(photo.thumb)
    expect(photo.src_optimized).toContain(`/images/optimized/${optimized_name}?v=${instance_hash}`)
    expect(photo.src_optimized_hdr).toBeNull()
    expect(photo.src_url).toBe(`http://test.local/images/source/${source_name}`)
    expect(photo.src_url).not.toContain('?v=')

    const source_response = await ctx.app.request(`/images/source/${photo.src}`)
    expect(source_response.status).toBe(200)
    expect(source_response.headers.get('content-type')).toBe('image/png')
    expect(source_response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(Buffer.from(await source_response.arrayBuffer())).toEqual(image)

    const optimized_url = new URL(photo.src_optimized as string).pathname
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

    const thumb_response = await ctx.app.request(`/images/thumb/${filenameFromUrl(photo.thumb as string)}`)
    expect(thumb_response.status).toBe(200)
    expect(thumb_response.headers.get('content-type')).toBe('image/avif')
    expect(thumb_response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')

    const old_photo_base = source_name.slice(0, source_name.lastIndexOf('.'))
    const old_suffixed = `${old_photo_base}-sdr.png`
    const old_source_ext = `${old_photo_base}.png`
    const old_thumb_avif = `${old_photo_base}-sdr.avif`
    for (const file of [old_suffixed, old_source_ext]) {
      await fs.writeFile(ctx.storage.imagePath('optimized', file), 'old')
      await fs.writeFile(ctx.storage.imagePath('thumb', file), 'old')
    }
    await fs.writeFile(ctx.storage.imagePath('thumb', old_thumb_avif), 'old')

    await fs.rm(ctx.storage.imagePath('optimized', variantName(source_name, 'sdr')))
    const thumb_path = ctx.storage.imagePath('thumb', thumb_name)
    await fs.rm(thumb_path)
    const refreshed = await ctx.adminMutate('adminRefreshThumb', { photo_id: photo.id })
    expect(refreshed.status).toBe(200)
    await expect(fs.access(ctx.storage.imagePath('optimized', variantName(source_name, 'sdr'))))
      .resolves.toBeUndefined()
    await expect(fs.access(thumb_path)).resolves.toBeUndefined()
    for (const file of [old_suffixed, old_source_ext]) {
      await expect(fs.access(ctx.storage.imagePath('optimized', file)))
        .rejects.toMatchObject({ code: 'ENOENT' })
      await expect(fs.access(ctx.storage.imagePath('thumb', file)))
        .rejects.toMatchObject({ code: 'ENOENT' })
    }
    await expect(fs.access(ctx.storage.imagePath('thumb', old_thumb_avif)))
      .rejects.toMatchObject({ code: 'ENOENT' })

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

  it('rejects images too long for the derived AVIF files at upload', async () => {
    const ctx = await context()
    // 默认缩略图宽 640：700×18000 的竖条缩略图会是 640×16457，超过 16384
    const form = new FormData()
    form.append('file', new File([new Uint8Array(await makePng(700, 18000))], 'tall.png', { type: 'image/png' }))
    const response = await ctx.app.request('/upload-image', { method: 'POST', body: form })
    expect(response.status).toBe(400)
    const body = await response.json() as any
    expect(JSON.stringify(body)).toContain('图片太长了')
    // 拒绝的图不留在 temp 里
    const left = (await fs.readdir(ctx.storage.paths.temp)).filter(name => name.endsWith('.png'))
    expect(left).toHaveLength(0)

    // 改小缩略图宽之后同一张图可以上传
    await ctx.adminMutate('adminUpdateInstanceConfig', { image_thumb_size: 256, avatar_thumb_size: 128 })
    await expect(ctx.uploadImage(await makePng(700, 18000), 'tall.png')).resolves.toMatchObject({ width: 700, height: 18000 })
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

    const optimized_response = await ctx.app.request(new URL(photo.src_optimized as string).pathname)
    expect(optimized_response.status).toBe(200)
    const optimized_metadata = await sharp(Buffer.from(await optimized_response.arrayBuffer())).metadata()
    expect(optimized_metadata.width).toBe(expected.width)
    expect(optimized_metadata.height).toBe(expected.height)

    const thumb_response = await ctx.app.request(`/images/thumb/${filenameFromUrl(photo.thumb as string)}`)
    expect(thumb_response.status).toBe(200)
    const thumb_metadata = await sharp(Buffer.from(await thumb_response.arrayBuffer())).metadata()
    expect(thumb_metadata.width).toBeGreaterThan(thumb_metadata.height)
    expect(thumb_metadata.width).toBe(640)
    expect(thumb_metadata.height).toBe(Math.round(expected.height * 640 / expected.width))
  })

  it('keeps a 10-bit source and generates only SDR derived images', async () => {
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
    expect(photo.has_hdr_optimized).toBe(false)
    const photo_src = photo.src as string
    const photo_thumb = photo.thumb as string
    expect(photo.src_optimized_hdr).toBeNull()

    const source_response = await ctx.app.request(`/images/source/${photo_src}`)
    expect(source_response.status).toBe(200)
    expect(Buffer.from(await source_response.arrayBuffer())).toEqual(avif)

    const sdr_url = new URL(photo.src_optimized as string).pathname
    const hdr_url = `/images/optimized/${variantName(photo_src, 'hdr')}`
    const sdr_response = await ctx.app.request(sdr_url)
    const hdr_response = await ctx.app.request(hdr_url)
    expect(sdr_response.status).toBe(200)
    expect(hdr_response.status).toBe(404)
    expect(sdr_response.headers.get('content-type')).toBe('image/avif')

    const sdr = await sharp(Buffer.from(await sdr_response.arrayBuffer())).metadata()
    expect(sdr.bitsPerSample).toBe(8)

    expect(photo_thumb).toContain(`/images/thumb/${thumbName(photo_src)}?v=`)
    const sdr_thumb_name = thumbName(photo_src)
    const sdr_thumb = await ctx.app.request(`/images/thumb/${sdr_thumb_name}`)
    const hdr_thumb = await ctx.app.request(`/images/thumb/${variantName(photo_src, 'hdr')}`)
    expect(sdr_thumb.status).toBe(200)
    expect(hdr_thumb.status).toBe(404)
    expect(sdr_thumb.headers.get('content-type')).toBe('image/avif')

    await fs.rm(ctx.storage.imagePath('optimized', variantName(photo_src, 'sdr')))
    await fs.rm(ctx.storage.imagePath('thumb', thumbName(photo_src)))
    const refreshed = await ctx.adminMutate('adminRefreshThumb', { photo_id: photo.id })
    expect(refreshed.status).toBe(200)
    await expect(fs.access(ctx.storage.imagePath('optimized', variantName(photo_src, 'sdr'))))
      .resolves.toBeUndefined()
    await expect(fs.access(ctx.storage.imagePath('thumb', thumbName(photo_src))))
      .resolves.toBeUndefined()
    await expect(fs.access(ctx.storage.imagePath('optimized', variantName(photo_src, 'hdr'))))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('thumb', variantName(photo_src, 'hdr'))))
      .rejects.toMatchObject({ code: 'ENOENT' })
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

  it('stores avatar source and an SDR thumb named .avif', async () => {
    const ctx = await context()
    const avatar = await makePng(300, 200)
    const member = await ctx.createMember({ qq_num: 51007, avatar })
    const avatar_src = member.avatar_src as string
    const avatar_thumb = member.avatar_thumb as string
    expect(avatar_src).toMatch(new RegExp(`^avatar-${member.id}-[0-9a-f]{8}\\.png$`))
    expect(avatar_thumb).toMatch(new RegExp(`^avatar-${member.id}-[0-9a-f]{8}\\.avif$`))
    expect(avatar_src).not.toBe(avatar_thumb)

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
    expect(member.avatar_thumb_url).toContain(`?v=${ctx.instance.getInstanceHash()}`)
    const hdr_avatar_thumb = hdr_member.avatar_thumb as string
    const hdr_thumb_response = await ctx.app.request(`/images/thumb/${hdr_avatar_thumb}`)
    expect(hdr_thumb_response.status).toBe(200)
    const hdr_thumb = await sharp(Buffer.from(await hdr_thumb_response.arrayBuffer())).metadata()
    expect(hdr_thumb.bitsPerSample).toBe(8)
  })

  it('rebuilds an avatar thumb without deleting it', async () => {
    const ctx = await context()
    const avatar = await makePng(128, 128)
    const member = await ctx.createMember({ qq_num: 51009, avatar })
    const thumb_name = filenameFromUrl(member.avatar_thumb_url as string)
    const thumb_path = ctx.storage.imagePath('thumb', thumb_name)
    const old_thumb_path = ctx.storage.imagePath('thumb', member.avatar_src as string)
    await fs.writeFile(old_thumb_path, 'old')
    await fs.rm(thumb_path)
    await expect(fs.access(thumb_path)).rejects.toMatchObject({ code: 'ENOENT' })

    const refreshed = await ctx.adminMutate('adminRefreshAvatar', { member_id: member.id })
    expect(refreshed.status).toBe(200)
    await expect(fs.access(thumb_path)).resolves.toBeUndefined()
    await expect(fs.access(old_thumb_path)).rejects.toMatchObject({ code: 'ENOENT' })
    const metadata = await sharp(await fs.readFile(thumb_path)).metadata()
    expect(metadata.format).toBe('heif')
    expect(metadata.width).toBe(128)
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
    const old_thumb = filenameFromUrl(photo.thumb as string)
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
    expect(updated.body.data.thumb).toContain(`/images/thumb/${thumbName(first_source)}?v=`)

    await expect(fs.access(ctx.storage.imagePath('source', old_source)))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('optimized', variantName(old_source, 'sdr'))))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('thumb', thumbName(old_source))))
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
    expect(second.body.data.thumb).toContain(`/images/thumb/${thumbName(second_source)}?v=`)
    await expect(fs.access(ctx.storage.imagePath('source', first_source)))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('optimized', variantName(first_source, 'sdr'))))
      .rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.access(ctx.storage.imagePath('thumb', thumbName(first_source))))
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


const hdr_available = await hdrToolsAvailable()

describe.skipIf(!hdr_available)('HDR image flow', () => {
  it('generates and exposes HDR optimized for PQ PNG, then refreshes the flag', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51007 })
    const gallery = await ctx.createGallery()
    const image = await makeHdrPng([9, 16, 9, 1])
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image,
      image_filename: 'hdr.png',
    })

    expect(photo.has_hdr_optimized).toBe(true)
    expect(photo.src_optimized_hdr).toContain('-hdr.avif')
    const source_name = photo.src as string
    const hdr_name = variantName(source_name, 'hdr')
    const hdr_path = ctx.storage.imagePath('optimized', hdr_name)
    await expect(fs.access(hdr_path)).resolves.toBeUndefined()

    const info = await avifCicp(hdr_path)
    expect(info).toContain('Bit Depth      : 10')
    expect(info).toContain('Color Primaries: 9')
    expect(info).toContain('Transfer Char. : 16')
    expect(info).toContain('Matrix Coeffs. : 9')

    await fs.rm(hdr_path)
    const refreshed = await ctx.adminMutate('adminRefreshThumb', { photo_id: photo.id })
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.data.has_hdr_optimized).toBe(true)
    await expect(fs.access(hdr_path)).resolves.toBeUndefined()
  })

  it('converts a JPEG gain map to an HDR base', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51010 })
    const gallery = await ctx.createGallery()
    const image = await fs.readFile(fileURLToPath(new URL('../fixtures/hdr/apple_gainmap_new.jpg', import.meta.url)))
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image,
      image_filename: 'gain.jpg',
    })

    expect(photo.has_hdr_optimized).toBe(true)
    const hdr_name = variantName(photo.src as string, 'hdr')
    const info = await avifCicp(ctx.storage.imagePath('optimized', hdr_name))
    expect(info).toContain('Bit Depth      : 10')
    expect(info).toContain('Transfer Char. : 16')
  })

  it('swaps an AVIF gain map and exposes its HDR base', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51009 })
    const gallery = await ctx.createGallery()
    const image = await makeAvifGainMap()
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image,
      image_filename: 'gain.avif',
    })

    expect(photo.has_hdr_optimized).toBe(true)
    expect(photo.src_optimized_hdr).toContain('-hdr.avif')
    const hdr_name = variantName(photo.src as string, 'hdr')
    const info = await avifCicp(ctx.storage.imagePath('optimized', hdr_name))
    expect(info).toContain('Bit Depth      : 10')
    expect(info).toContain('Transfer Char. : 16')
  })

  it('does not guess HDR for a 16-bit PNG without cICP', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51008 })
    const gallery = await ctx.createGallery()
    const png = await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: '#804020',
      },
    }).toColourspace('rgb16').png().toBuffer()
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image: png,
      image_filename: 'no-cicp.png',
    })
    expect(photo.has_hdr_optimized).toBe(false)
    expect(photo.src_optimized_hdr).toBeNull()
  })
})


const heic_available = await heicToolsAvailable()

describe.skipIf(!heic_available)('HEIC image flow', () => {
  it('stores a native HEIC source and generates SDR images', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51011 })
    const gallery = await ctx.createGallery()
    const image = await fs.readFile(fileURLToPath(new URL('../fixtures/hdr/plain-sdr.heic', import.meta.url)))
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image,
      image_filename: 'iphone.heic',
    })

    expect(photo.src).toMatch(/\.heic$/)
    expect(photo.format).toBe('heic')
    expect(photo.has_hdr_optimized).toBe(false)
    expect(photo.src_optimized_hdr).toBeNull()

    const source = await ctx.app.request(`/images/source/${photo.src}`)
    expect(source.status).toBe(200)
    expect(source.headers.get('content-type')).toBe('image/heic')
    const thumb = await ctx.app.request(new URL(photo.thumb as string).pathname)
    expect(thumb.status).toBe(200)
    expect(thumb.headers.get('content-type')).toBe('image/avif')
  })
})

describe.skipIf(!hdr_available || !heic_available)('HEIC HDR image flow', () => {
  it('converts an Apple HDR HEIC to a 10-bit HDR AVIF', async () => {
    const ctx = await context()
    const member = await ctx.createMember({ qq_num: 51012 })
    const gallery = await ctx.createGallery()
    const image = await fs.readFile(fileURLToPath(new URL('../fixtures/hdr/iphone-hdr.heic', import.meta.url)))
    const photo = await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      image,
      image_filename: 'iphone-hdr.heic',
    })

    expect(photo.has_hdr_optimized).toBe(true)
    expect(photo.src_optimized_hdr).toContain('-hdr.avif')
    const hdr_name = variantName(photo.src as string, 'hdr')
    const info = await avifCicp(ctx.storage.imagePath('optimized', hdr_name))
    expect(info).toContain('Bit Depth      : 10')
    expect(info).toContain('Color Primaries: 9')
    expect(info).toContain('Transfer Char. : 16')
    expect(info).toContain('Matrix Coeffs. : 9')
  })
})
