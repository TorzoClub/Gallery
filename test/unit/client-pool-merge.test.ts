import { describe, expect, it } from 'vitest'
import type { ClientMember, ClientPhoto, ClientPool } from '../../src/shared/client-pool'
import type { AdminGalleryDTO, AdminPoolDTO } from '../../src/shared/dto'
import {
  mergeAdminPool,
  mergeClientPool,
  mergeGalleryPhotos,
  mergePublicMembers,
} from '../../src/web/pool/merge'

function photo(id: number, updated_at: string): ClientPhoto {
  return {
    id,
    index: id,
    desc: '',
    src: `${id}.jpg`,
    format: 'jpg',
    width: 10,
    height: 10,
    has_hdr_optimized: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at,
    member_id: 1,
  }
}

function member(id: number, updated_at: string): ClientMember {
  return {
    id,
    qq_num: null,
    name: `m${id}`,
    avatar_src: `${id}.jpg`,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at,
  }
}

function pool(photos: ClientPhoto[], members: ClientMember[]): ClientPool {
  return {
    schema_version: 2,
    next_id: 10,
    instance_hash: 'hash',
    app_startup_time: 1,
    submissions: photos.length,
    votes: 0,
    version_time: 1,
    build_date: 'N/A',
    git_hash: 'N/A',
    galleries: [{
      id: 1,
      index: 0,
      name: 'g',
      vote_limit: 0,
      event_start: '2026-01-01T00:00:00.000Z',
      submission_expire: '2026-02-01T00:00:00.000Z',
      event_end: '2026-03-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      in_event: false,
      photos,
      vote_records: [],
    }],
    members,
  }
}

function adminGallery(photo_value: ReturnType<typeof photo>): AdminGalleryDTO {
  return {
    ...photo_value,
    gallery_id: 1,
    thumb: 'thumb',
    src_url: '/src',
    src_optimized: '/opt',
    src_optimized_hdr: null,
    thumb_url: '/thumb',
    vote_count: 0,
    member: null,
    photos: [photo_value],
    vote_records: [],
  } as unknown as AdminGalleryDTO
}

describe('client pool merge', () => {
  it('keeps newer local photos and accepts newer incoming photos', () => {
    const local = pool([photo(1, '2026-01-02T00:00:00.000Z'), photo(2, '2026-01-01T00:00:00.000Z')], [])
    const incoming = pool([photo(1, '2026-01-01T00:00:00.000Z'), photo(2, '2026-01-03T00:00:00.000Z')], [])

    const merged = mergeClientPool(local, incoming)
    expect(merged.galleries[0]!.photos[0]).toBe(local.galleries[0]!.photos[0])
    expect(merged.galleries[0]!.photos[1]).toBe(incoming.galleries[0]!.photos[1])
  })

  it('removes photos and members missing from a complete snapshot', () => {
    const local = pool([photo(1, '2026-01-01T00:00:00.000Z')], [member(1, '2026-01-01T00:00:00.000Z')])
    const incoming = pool([], [])

    const merged = mergeClientPool(local, incoming)
    expect(merged.galleries[0]!.photos).toHaveLength(0)
    expect(merged.members).toHaveLength(0)
  })

  it('reuses unchanged gallery/member objects', () => {
    const local = pool([photo(1, '2026-01-01T00:00:00.000Z')], [member(1, '2026-01-01T00:00:00.000Z')])
    const incoming = pool([photo(1, '2026-01-01T00:00:00.000Z')], [member(1, '2026-01-01T00:00:00.000Z')])

    const merged = mergeClientPool(local, incoming)
    expect(merged.galleries[0]!).toBe(local.galleries[0]!)
    expect(merged.galleries[0]!.photos[0]).toBe(local.galleries[0]!.photos[0])
    expect(merged.members[0]!).toBe(local.members[0]!)
  })

  it('merges independent photo and member events without replacing the pool', () => {
    const local = pool([photo(1, '2026-01-01T00:00:00.000Z')], [member(1, '2026-01-01T00:00:00.000Z')])
    const with_photo = mergeGalleryPhotos(local, [{
      id: 1,
      in_event: false,
      photos: [photo(1, '2026-01-02T00:00:00.000Z'), photo(2, '2026-01-02T00:00:00.000Z')],
    }])
    expect(with_photo.galleries[0]!.photos).toHaveLength(2)
    expect(with_photo.members).toBe(local.members)

    const with_member = mergePublicMembers(with_photo, [member(2, '2026-01-03T00:00:00.000Z')])
    expect(with_member.galleries).toBe(with_photo.galleries)
    expect(with_member.members).toHaveLength(1)
    expect(with_member.members[0]!.id).toBe(2)
  })

  it('merges a full admin pool with stable references', () => {
    const local_photo = photo(1, '2026-01-01T00:00:00.000Z')
    const local: AdminPoolDTO = {
      schema_version: 2,
      next_id: 2,
      instance_hash: 'hash',
      app_startup_time: 1,
      version_time: 1,
      build_date: 'N/A',
      git_hash: 'N/A',
      galleries: [adminGallery(local_photo)],
      members: [{
        ...member(1, '2026-01-01T00:00:00.000Z'),
        qq_num: 123,
        avatar_thumb: 'a',
        avatar_thumb_url: '/a',
      }],
      instance_config: {} as AdminPoolDTO['instance_config'],
    }
    const incoming: AdminPoolDTO = {
      ...local,
      galleries: [{
        ...local.galleries[0]!,
        name: 'renamed',
        updated_at: '2026-01-02T00:00:00.000Z',
      }],
      members: local.members,
    }
    const merged = mergeAdminPool(local, incoming)
    expect(merged.galleries[0]!).not.toBe(local.galleries[0]!)
    expect(merged.galleries[0]!.name).toBe('renamed')
    expect(merged.galleries[0]!.photos[0]).toBe(local.galleries[0]!.photos[0])
    expect(merged.members[0]!).toBe(local.members[0]!)
  })
})
