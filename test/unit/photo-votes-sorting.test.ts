import { describe, expect, it } from 'vitest'
import {
  createMagnetOffset,
  getVoteMagnetLayout,
  indexPhotoVotes,
  sortGalleryPhotos,
} from '../../src/web/layouts/AdminHome/components/photo-votes'

const photos = Object.freeze([
  Object.freeze({ id: 3, created_at: '2026-11-03T00:00:00Z' }),
  Object.freeze({ id: 1, created_at: '2026-11-01T00:00:00Z' }),
  Object.freeze({ id: 2, created_at: '2026-11-02T00:00:00Z' }),
  Object.freeze({ id: 4, created_at: '2026-11-02T00:00:00Z' }),
])
const votes = indexPhotoVotes(1, [1, 1, 2, 4].map((photo_id, index) => ({
  id: index + 1,
  gallery_id: 1,
  photo_id,
  member_id: index + 1,
  created_at: '2026-11-03T12:00:00Z',
  updated_at: '2026-11-03T12:00:00Z',
})), [])

describe('local photo sorting', () => {
  it.each([
    ['created_at', 'asc', [1, 2, 4, 3]],
    ['created_at', 'desc', [3, 2, 4, 1]],
    ['vote_count', 'asc', [3, 2, 4, 1]],
    ['vote_count', 'desc', [1, 2, 4, 3]],
  ] as const)('sorts by %s %s with a stable id tie break', (by, direction, ids) => {
    const sorted = sortGalleryPhotos(photos, votes, by, direction)
    expect(sorted.map(photo => photo.id)).toEqual(ids)
    expect(sorted).not.toBe(photos)
    expect(sorted.find(photo => photo.id === 3)).toBe(photos[0])
    expect(photos.map(photo => photo.id)).toEqual([3, 1, 2, 4])
    expect(votes.get(1)).toHaveLength(2)
  })

  it('updates vote order from a fresh snapshot and treats missing records as zero', () => {
    expect(sortGalleryPhotos(photos, new Map(), 'vote_count', 'desc').map(photo => photo.id))
      .toEqual([1, 2, 3, 4])
    expect(sortGalleryPhotos([], votes, 'created_at', 'asc')).toEqual([])
  })

  it('compares timestamps, not their timezone-dependent text', () => {
    const items = [
      { id: 1, created_at: '2026-11-03T08:00:00+08:00' },
      { id: 2, created_at: '2026-11-03T01:00:00Z' },
    ]
    expect(sortGalleryPhotos(items, votes, 'created_at', 'asc').map(photo => photo.id)).toEqual([1, 2])
  })
})

describe('magnet translation', () => {
  it.each([0, 0.5, 0.999999])('generates the requested offset range from %s', random => {
    const offset = createMagnetOffset(() => random)
    expect(offset.x).toBe(1 + random)
    expect(offset.y).toBe(2 + random)
    expect(offset.x).toBeGreaterThanOrEqual(1)
    expect(offset.x).toBeLessThanOrEqual(2)
    expect(offset.y).toBeGreaterThanOrEqual(2)
    expect(offset.y).toBeLessThanOrEqual(3)
  })

  it.each([[200, 150], [152, 100], [140, 8], [0.5, 0.25]])(
    'keeps translated circles inside a %s by %s cover', (width, height) => {
      for (const count of [1, 5, 23, 200]) {
        const layout = getVoteMagnetLayout(count, width, height)
        const scale = Math.min(1, layout.inset / 3)
        const right = width - layout.inset + 2 * scale
        const bottom = layout.inset + layout.height + 3 * scale
        expect(right).toBeLessThanOrEqual(width + 1e-8)
        expect(bottom).toBeLessThanOrEqual(height + 1e-8)
      }
    },
  )
})
