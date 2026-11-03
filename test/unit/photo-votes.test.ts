import { describe, expect, it } from 'vitest'
import type { MemberDTO, VoteDTO } from '../../src/shared/dto'
import {
  getVoteMagnetLayout,
  getVoteMagnetValues,
  indexPhotoVotes,
} from '../../src/web/layouts/AdminHome/components/photo-votes'

function vote(id: number, overrides: Partial<VoteDTO> = {}): VoteDTO {
  return {
    id,
    gallery_id: 1,
    photo_id: 10,
    member_id: id,
    created_at: '2026-11-01T12:00:00.000Z',
    updated_at: '2026-11-01T12:00:00.000Z',
    ...overrides,
  }
}

function member(id: number): MemberDTO {
  return {
    id,
    name: `成员 ${id}`,
    qq_num: 10000 + id,
    avatar_src: '',
    avatar_thumb: '',
    avatar_thumb_url: '',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  }
}

describe('photo vote records', () => {
  it('groups votes by photo and joins the voter, not the photo submitter', () => {
    const voter = member(2)
    const records = indexPhotoVotes(1, [
      vote(1, { member_id: 2 }),
      vote(2, { photo_id: 11, member_id: 3 }),
      vote(3, { gallery_id: 2 }),
    ], [member(1), voter, member(3)])

    expect([...records.keys()]).toEqual([10, 11])
    expect(records.get(10)).toHaveLength(1)
    expect(records.get(10)?.[0]?.member).toBe(voter)
    expect(records.get(11)?.[0]?.vote.id).toBe(2)
  })

  it('retains votes with missing members so that the count stays accurate', () => {
    const records = indexPhotoVotes(1, [vote(1)], [])
    expect(records.get(10)).toEqual([{ vote: vote(1), member: null }])
  })

  it('orders newest first with a stable id tie break without mutating input', () => {
    const votes = Object.freeze([
      Object.freeze(vote(1)),
      Object.freeze(vote(2, { created_at: '2026-11-02T10:00:00.000Z' })),
      Object.freeze(vote(3, { created_at: '2026-11-02T10:00:00.000Z' })),
    ])
    const records = indexPhotoVotes(1, votes, [])
    expect(records.get(10)?.map(record => record.vote.id)).toEqual([3, 2, 1])
    expect(votes.map(record => record.id)).toEqual([1, 2, 3])
  })

  it('rebuilds from the latest snapshot after clearing votes or updating members', () => {
    const votes = [vote(1), vote(2)] as const
    expect(indexPhotoVotes(1, votes, []).get(10)).toHaveLength(2)
    const renamed = { ...member(1), name: '新昵称' }
    const refreshed = indexPhotoVotes(1, [votes[0]], [renamed])
    expect(refreshed.get(10)).toHaveLength(1)
    expect(refreshed.get(10)?.[0]?.member?.name).toBe('新昵称')
    expect(indexPhotoVotes(1, [], []).size).toBe(0)
  })
})

describe('vote magnet denominations', () => {
  it.each([
    [0, 0, 0],
    [1, 0, 1],
    [4, 0, 4],
    [5, 1, 0],
    [6, 1, 1],
    [13, 2, 3],
    [49, 9, 4],
    [50, 10, 0],
    [99, 19, 4],
  ])('%i votes become %i red magnets and %i blue magnets', (count, red, blue) => {
    const values = getVoteMagnetValues(count)
    expect(values.filter(value => value === 5)).toHaveLength(red)
    expect(values.filter(value => value === 1)).toHaveLength(blue)
    expect(values).toEqual([...Array(blue).fill(1), ...Array(red).fill(5)])
    expect(values.reduce<number>((total, value) => total + value, 0)).toBe(count)
  })

  it('preserves the exact total for every count from 0 to 1000', () => {
    for (let count = 0; count <= 1000; count += 1) {
      const values = getVoteMagnetValues(count)
      expect(values.reduce<number>((total, value) => total + value, 0)).toBe(count)
      expect(values.filter(value => value === 1).length).toBeLessThan(5)
    }
  })
})

describe('vote magnet image bounds', () => {
  it('uses 16px circles, 6px gaps and an 8px inset for a normal photo', () => {
    expect(getVoteMagnetLayout(5, 200, 150)).toEqual({
      columns: 5,
      inset: 8,
      diameter: 16,
      gap: 6,
      width: 104,
      height: 16,
      font_size: 10,
    })
  })

  it('wraps dozens of votes onto multiple rows without losing magnets', () => {
    const values = getVoteMagnetValues(99)
    const layout = getVoteMagnetLayout(values.length, 152, 100)
    expect(layout.columns).toBe(6)
    expect(layout.height).toBe(82)
    expect(layout.diameter).toBe(16)
  })

  it.each([
    [152, 100],
    [232, 360],
    [184.5, 24],
    [140, 8],
    [10, 200],
    [0.5, 0.25],
  ])('keeps all content inside a %s × %s image, including panoramas', (width, height) => {
    for (const count of [0, 1, 4, 5, 13, 99, 1000]) {
      const values = getVoteMagnetValues(count)
      const layout = getVoteMagnetLayout(values.length, width, height)
      expect(layout.inset).toBeGreaterThan(0)
      expect(layout.width + 2 * layout.inset).toBeLessThanOrEqual(width + 1e-8)
      expect(layout.height + 2 * layout.inset).toBeLessThanOrEqual(height + 1e-8)
      expect(layout.diameter).toBeGreaterThan(0)
      expect(layout.diameter).toBeLessThanOrEqual(16)
      expect(layout.gap / layout.diameter).toBeCloseTo(6 / 16)
      if (values.length > 0) {
        const rows = Math.ceil(values.length / layout.columns)
        expect(layout.height).toBeCloseTo(rows * layout.diameter + (rows - 1) * layout.gap)
      }
    }
  })

  it('reserves an image-only entry for zero votes without inventing magnets', () => {
    expect(getVoteMagnetValues(0)).toEqual([])
    const layout = getVoteMagnetLayout(0, 200, 150)
    expect(layout.width).toBe(32)
    expect(layout.height).toBe(16)
  })
})
