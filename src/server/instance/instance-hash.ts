import type { InstanceConfig } from '../../shared/config'
import { crc32Hex } from '../common/crc32'
import {
  AVIF_MAX_DIMENSION,
  MIN_DERIVED_SHORT_EDGE,
} from '../storage/image'

export type ImageDerivationPolicy = Readonly<{
  avif_max_dimension: number
  min_derived_short_edge: number
}>

export const IMAGE_DERIVATION_POLICY: ImageDerivationPolicy = Object.freeze({
  avif_max_dimension: AVIF_MAX_DIMENSION,
  min_derived_short_edge: MIN_DERIVED_SHORT_EDGE,
})

export function calcInstanceHash(
  config: InstanceConfig,
  image_derivation: ImageDerivationPolicy = IMAGE_DERIVATION_POLICY,
): string {
  return crc32Hex(Buffer.from(JSON.stringify({
    instance_config: config,
    image_derivation,
  })))
}
