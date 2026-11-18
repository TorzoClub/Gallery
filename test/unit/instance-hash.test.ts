import { describe, expect, it } from 'vitest'
import { DEFAULT_INSTANCE_CONFIG } from '../../src/server/config'
import {
  calcInstanceHash,
  IMAGE_DERIVATION_POLICY,
} from '../../src/server/instance/instance-hash'
import {
  AVIF_MAX_DIMENSION,
  MIN_DERIVED_SHORT_EDGE,
} from '../../src/server/storage/image'

describe('instance hash', () => {
  it('is stable for the same config and derivation policy', () => {
    const hash = calcInstanceHash(DEFAULT_INSTANCE_CONFIG)
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
    expect(calcInstanceHash(DEFAULT_INSTANCE_CONFIG)).toBe(hash)
  })

  it('includes the instance config', () => {
    const changed = {
      ...DEFAULT_INSTANCE_CONFIG,
      image_thumb_size: DEFAULT_INSTANCE_CONFIG.image_thumb_size + 1,
    }
    expect(calcInstanceHash(changed)).not.toBe(calcInstanceHash(DEFAULT_INSTANCE_CONFIG))
  })

  it('uses the current image derivation constants by default', () => {
    expect(IMAGE_DERIVATION_POLICY).toEqual({
      avif_max_dimension: AVIF_MAX_DIMENSION,
      min_derived_short_edge: MIN_DERIVED_SHORT_EDGE,
    })
  })

  it('includes AVIF_MAX_DIMENSION', () => {
    const changed = {
      ...IMAGE_DERIVATION_POLICY,
      avif_max_dimension: IMAGE_DERIVATION_POLICY.avif_max_dimension + 1,
    }
    expect(calcInstanceHash(DEFAULT_INSTANCE_CONFIG, changed))
      .not.toBe(calcInstanceHash(DEFAULT_INSTANCE_CONFIG))
  })

  it('includes MIN_DERIVED_SHORT_EDGE', () => {
    const changed = {
      ...IMAGE_DERIVATION_POLICY,
      min_derived_short_edge: IMAGE_DERIVATION_POLICY.min_derived_short_edge + 1,
    }
    expect(calcInstanceHash(DEFAULT_INSTANCE_CONFIG, changed))
      .not.toBe(calcInstanceHash(DEFAULT_INSTANCE_CONFIG))
  })
})
