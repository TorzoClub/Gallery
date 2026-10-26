import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { createLogger } from '../../src/server/logger'
import { createStorage } from '../../src/server/storage'
import { migrateLegacy } from '../../src/server/migration/legacy'
import { normalizeLegacyApiUrl, type FetchLike } from '../../src/server/migration/legacy-api'
import { makePng } from '../helpers/app'

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'torzo-migration-test-'))
  dirs.push(dir)
  return dir
}

function variantName(source: string, variant: 'sdr' | 'hdr'): string {
  const dot = source.lastIndexOf('.')
  return `${source.slice(0, dot)}-${variant}.avif`
}

function thumbName(source: string): string {
  const dot = source.lastIndexOf('.')
  return `${source.slice(0, dot)}.avif`
}

function avatarThumbName(source: string): string {
  return thumbName(source)
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function imageResponse(value: Buffer): Response {
  return new Response(new Uint8Array(value), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  })
}

type Fixture = {
  galleries: unknown[]
  members: unknown[]
  photos: Record<number, unknown[]>
  member_votes: Record<number, unknown[]>
  images: Record<string, Buffer>
}

function makeFetch(fixture: Fixture, options: {
  fail_image?: boolean
  called?: string[]
} = {}): FetchLike {
  const called = options.called ?? []
  return (async (input, init) => {
    const url = String(input)
    called.push(url)
    const parsed = new URL(url)
    const pathname = parsed.pathname

    if (pathname === '/admin/login') {
      return jsonResponse({ token: 'legacy-token' })
    }
    if (pathname === '/admin/gallery') {
      return jsonResponse(fixture.galleries)
    }
    if (pathname === '/admin/member') {
      return jsonResponse(fixture.members)
    }

    const photo_match = pathname.match(/^\/admin\/gallery\/(\d+)\/photo$/)
    if (photo_match !== null) {
      return jsonResponse(fixture.photos[Number(photo_match[1])] ?? [])
    }
    const vote_match = pathname.match(/^\/admin\/gallery\/(\d+)\/member_vote$/)
    if (vote_match !== null) {
      return jsonResponse(fixture.member_votes[Number(vote_match[1])] ?? [])
    }

    if (pathname.startsWith('/src/')) {
      if (options.fail_image === true) {
        return new Response('image failed', { status: 500 })
      }
      const buffer = fixture.images[pathname]
      if (buffer === undefined) {
        return new Response('not found', { status: 404 })
      }
      return imageResponse(buffer)
    }

    return new Response(`unexpected ${url}`, { status: 500 })
  }) as FetchLike
}

const NOW = new Date('2026-06-01T00:00:00.000Z')

describe('legacy migration', () => {
  it('migrates data, remaps IDs and rebuilds image variants', async () => {
    const root = await tempDir()
    const target = path.join(root, 'storage')
    const avatar_a = await makePng(64, 64, { r: 10, g: 20, b: 30 })
    const avatar_b = await makePng(64, 64, { r: 30, g: 20, b: 10 })
    const photo_a = await makePng(300, 200, { r: 200, g: 10, b: 10 })
    const photo_b = await makePng(240, 160, { r: 10, g: 200, b: 10 })
    const hdr = await sharp(await makePng(220, 140, { r: 10, g: 10, b: 220 }))
      .avif({ bitdepth: 10, quality: 75, effort: 6 })
      .toBuffer()

    const fixture: Fixture = {
      galleries: [
        {
          id: 1,
          name: 'Legacy One',
          index: 2,
          vote_limit: 3,
          event_start: '2024-01-01T00:00:00.000Z',
          submission_expire: '2024-01-02T00:00:00.000Z',
          event_end: '2024-01-03T00:00:00.000Z',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 2,
          name: 'Legacy Two',
          index: 1,
          vote_limit: 0,
          event_start: '2024-02-01T00:00:00.000Z',
          submission_expire: '2024-02-02T00:00:00.000Z',
          event_end: '2024-02-03T00:00:00.000Z',
          created_at: '2024-02-01T00:00:00.000Z',
          updated_at: '2024-02-02T00:00:00.000Z',
        },
      ],
      members: [
        {
          id: 1,
          qq_num: 10001,
          name: 'A',
          avatar_src: 'avatar-1.png',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-02T00:00:00.000Z',
        },
        {
          id: 2,
          qq_num: 10002,
          name: 'B',
          avatar_src: 'avatar-2.png',
          created_at: '2023-02-01T00:00:00.000Z',
          updated_at: '2023-02-02T00:00:00.000Z',
        },
      ],
      photos: {
        1: [
          {
            id: 1,
            gallery_id: 1,
            member_id: 1,
            desc: 'first',
            src: 'photo-1.jpg',
            index: 3,
            vote_count: 3,
            created_at: '2024-01-02T00:00:00.000Z',
            updated_at: '2024-01-03T00:00:00.000Z',
            src_url: 'http://10.0.0.5:7001/src/do-not-use.png',
          },
          {
            id: 3,
            gallery_id: 1,
            member_id: 2,
            desc: 'hdr',
            src: 'hdr.avif',
            index: 0,
            vote_count: 0,
            created_at: '2024-01-04T00:00:00.000Z',
            updated_at: '2024-01-05T00:00:00.000Z',
          },
        ],
        2: [
          {
            id: 2,
            gallery_id: 2,
            member_id: 2,
            desc: 'second',
            src: 'photo-2.png',
            index: 1,
            vote_count: 1,
            created_at: '2024-02-02T00:00:00.000Z',
            updated_at: '2024-02-03T00:00:00.000Z',
          },
        ],
      },
      member_votes: {
        1: [
          {
            id: 1,
            qq_num: 10001,
            name: 'A',
            avatar_src: 'avatar-1.png',
            votes: [
              {
                id: 1,
                gallery_id: 1,
                photo_id: 1,
                member_id: 1,
                created_at: '2024-01-02T01:00:00.000Z',
                updated_at: '2024-01-02T01:00:00.000Z',
              },
            ],
          },
          {
            id: 2,
            qq_num: 10002,
            name: 'B',
            avatar_src: 'avatar-2.png',
            votes: [],
          },
        ],
        2: [
          {
            id: 1,
            qq_num: 10001,
            name: 'A',
            avatar_src: 'avatar-1.png',
            votes: [
              {
                id: 2,
                gallery_id: 2,
                photo_id: 2,
                member_id: 1,
                created_at: '2024-02-02T01:00:00.000Z',
                updated_at: '2024-02-02T01:00:00.000Z',
              },
            ],
          },
          {
            id: 2,
            qq_num: 10002,
            name: 'B',
            avatar_src: 'avatar-2.png',
            votes: [],
          },
        ],
      },
      images: {
        '/src/avatar-1.png': avatar_a,
        '/src/avatar-2.png': avatar_b,
        '/src/photo-1.jpg': photo_a,
        '/src/hdr.avif': hdr,
        '/src/photo-2.png': photo_b,
      },
    }

    const result = await migrateLegacy({
      api_url: 'http://legacy.test/',
      admin_password: 'test-password',
      storage_path: target,
      fetch_impl: makeFetch(fixture),
      now: () => NOW,
    })

    expect(result).toMatchObject({
      storage_path: target,
      galleries: 2,
      members: 2,
      photos: 3,
      votes: 2,
    })
    expect(result.warnings).toHaveLength(1)

    const storage = await createStorage({
      storage_path: target,
      allow_empty_data: false,
      logger: createLogger({ level: 'error', pretty: true }),
    })
    try {
      const loaded = await storage.load()
      expect(loaded.instance_config.image_processing_effort).toBe(3)
      expect(loaded.instance_config.image_thumb_size).toBe(320)
      expect(loaded.instance_config.avatar_thumb_size).toBe(128)
      expect(loaded.instance_config.image_thumb_quality).toBe(10)
      const galleries = loaded.pool.galleries.valueSeq().toArray()
      const members = loaded.pool.members.valueSeq().toArray()
      const all_ids = [
        ...galleries.map(gallery => Number(gallery.id)),
        ...galleries.flatMap(gallery => gallery.photos.valueSeq().toArray().map(photo => Number(photo.id))),
        ...galleries.flatMap(gallery => gallery.vote_records.toArray().map(vote => Number(vote.id))),
        ...members.map(member => Number(member.id)),
      ]
      expect(new Set(all_ids).size).toBe(all_ids.length)
      expect(Number(loaded.pool.next_id)).toBe(Math.max(...all_ids) + 1)
      expect(galleries).toHaveLength(2)
      expect(members).toHaveLength(2)
      expect(galleries.every(gallery => Number(gallery.id) > 0)).toBe(true)
      // Legacy gallery/member/photo all used id 1; new IDs must be distinct.
      expect(galleries[0]?.id).not.toBe(members[0]?.id)

      const first = galleries.find(gallery => gallery.name === 'Legacy One')
      expect(first?.index).toBe(2)
      expect(first?.event_start.toISOString()).toBe('2024-01-01T00:00:00.000Z')
      expect(first?.photos.size).toBe(2)
      expect(first?.vote_records.size).toBe(1)
      const first_photo = first?.photos.valueSeq().toArray().find(photo => photo.desc === 'first')
      expect(first_photo?.index).toBe(3)
      expect(first_photo?.created_at.toISOString()).toBe('2024-01-02T00:00:00.000Z')
      expect(first_photo?.has_hdr_optimized).toBe(false)
      const hdr_photo = first?.photos.valueSeq().toArray().find(photo => photo.desc === 'hdr')
      expect(hdr_photo?.has_hdr_optimized).toBe(false)

      const first_member = members.find(member => member.name === 'A')
      expect(first_member?.qq_num).toBe(10001)
      expect(first_member?.created_at.toISOString()).toBe('2023-01-01T00:00:00.000Z')
      expect(first_member?.avatar_src).toMatch(/^avatar-10001-[0-9a-f]{8}\.png$/)

      await expect(fs.readFile(storage.imagePath('source', first_photo!.src)))
        .resolves.toEqual(photo_a)
      await expect(fs.access(storage.imagePath('optimized', variantName(first_photo!.src, 'sdr'))))
        .resolves.toBeUndefined()
      await expect(fs.access(storage.imagePath('thumb', thumbName(first_photo!.src))))
        .resolves.toBeUndefined()
      await expect(fs.access(storage.imagePath('optimized', variantName(hdr_photo!.src, 'sdr'))))
        .resolves.toBeUndefined()
      await expect(fs.access(storage.imagePath('optimized', variantName(hdr_photo!.src, 'hdr'))))
        .rejects.toMatchObject({ code: 'ENOENT' })
      await expect(fs.access(storage.imagePath('thumb', avatarThumbName(first_member!.avatar_src))))
        .resolves.toBeUndefined()
    } finally {
      await storage.close()
    }
  })

  it('normalizes the legacy API URL', () => {
    expect(normalizeLegacyApiUrl('http://legacy.test')).toBe('http://legacy.test/')
    expect(normalizeLegacyApiUrl('https://legacy.test/torzo-gallery-server'))
      .toBe('https://legacy.test/torzo-gallery-server/')
    expect(normalizeLegacyApiUrl('https://legacy.test/torzo-gallery-server/?x=1#y'))
      .toBe('https://legacy.test/torzo-gallery-server/')
    expect(() => normalizeLegacyApiUrl('file:///tmp/x')).toThrow(/http/)
  })

  it('rejects an existing target before making requests', async () => {
    const root = await tempDir()
    const target = path.join(root, 'storage')
    await fs.mkdir(target)
    const called: string[] = []
    await expect(migrateLegacy({
      api_url: 'http://legacy.test/',
      admin_password: 'test-password',
      storage_path: target,
      fetch_impl: makeFetch({
        galleries: [],
        members: [],
        photos: {},
        member_votes: {},
        images: {},
      }, { called }),
    })).rejects.toThrow(/已存在/)

    expect(called).toEqual([])
  })

  it('removes staging when a remote image fails', async () => {
    const root = await tempDir()
    const target = path.join(root, 'storage')
    const fixture: Fixture = {
      galleries: [{
        id: 10,
        name: 'G',
        index: 0,
        vote_limit: 0,
        event_start: '2024-01-01T00:00:00.000Z',
        submission_expire: '2024-01-02T00:00:00.000Z',
        event_end: '2024-01-03T00:00:00.000Z',
      }],
      members: [{
        id: 1,
        qq_num: 10001,
        name: 'A',
        avatar_src: 'avatar.png',
      }],
      photos: {},
      member_votes: {},
      images: {},
    }

    await expect(migrateLegacy({
      api_url: 'http://legacy.test/',
      admin_password: 'test-password',
      storage_path: target,
      fetch_impl: makeFetch(fixture, { fail_image: true }),
    })).rejects.toThrow(/图片下载失败|HTTP 500/)

    await expect(fs.access(target)).rejects.toMatchObject({ code: 'ENOENT' })
    const entries = await fs.readdir(root)
    expect(entries).toEqual([])
  })
})
