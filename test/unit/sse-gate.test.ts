import { describe, expect, it } from 'vitest'
import { createPublicPoolSseGate } from '../../src/web/pool/sse-gate'

function photosEvent(count: number) {
  return {
    galleries: [{
      id: 1,
      in_event: false as const,
      photos: Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        index,
        desc: '',
        src: '',
        format: 'jpg',
        width: 1,
        height: 1,
        has_hdr_optimized: false,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        member_id: 1,
      })),
    }],
  }
}

function membersEvent(count: number) {
  return {
    members: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      qq_num: null,
      name: '',
      avatar_src: '',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })),
  }
}

describe('public SSE gate', () => {
  it('buffers updates while blocked and releases the latest snapshots', () => {
    const gate = createPublicPoolSseGate()
    const release = gate.begin()

    expect(gate.buffer({ type: 'photos', update: photosEvent(1) })).toBe(true)
    expect(gate.buffer({ type: 'photos', update: photosEvent(2) })).toBe(true)
    expect(gate.buffer({ type: 'members', update: membersEvent(3) })).toBe(true)

    const pending = release()
    expect(pending?.photos?.galleries[0]?.photos).toHaveLength(2)
    expect(pending?.members?.members).toHaveLength(3)
  })

  it('does not release until the last nested block is released', () => {
    const gate = createPublicPoolSseGate()
    const release_outer = gate.begin()
    const release_inner = gate.begin()

    gate.buffer({ type: 'photos', update: photosEvent(1) })
    expect(release_inner()).toBeNull()
    const pending = release_outer()
    expect(pending?.photos?.galleries[0]?.photos).toHaveLength(1)
  })

  it('is idempotent and lets updates through after release', () => {
    const gate = createPublicPoolSseGate()
    const release = gate.begin()
    gate.buffer({ type: 'photos', update: photosEvent(1) })

    expect(release()).not.toBeNull()
    expect(release()).toBeNull()
    expect(gate.buffer({ type: 'photos', update: photosEvent(2) })).toBe(false)
  })
})
