import * as z from 'zod'
import { apiError } from '../common/error'
import type { InstanceConfig, InstanceConfigUpdate } from '../../shared/config'

export type { InstanceConfig, InstanceConfigUpdate }

const InstanceConfigDataSchema = z.object({
  avatar_thumb_size: z.number().int().min(16).max(2048).default(128),
  image_thumb_size: z.number().int().min(32).max(4096).default(640),
  image_thumb_quality: z.number().int().min(1).max(100).default(40),
  avif_source_quality: z.number().int().min(1).max(100).default(75),
  image_processing_effort: z.number().int().min(0).max(9).default(8),
  max_image_dimension: z.number().int().min(256).max(16384).default(3840),
  max_upload_bytes: z
    .number()
    .int()
    .min(1024)
    .max(1024 * 1024 * 1024)
    .default(16 * 1024 * 1024),
})

export const InstanceConfigFileSchema = InstanceConfigDataSchema.extend({
  schema_version: z.literal(1).default(1),
})

export const InstanceConfigUpdateSchema = InstanceConfigDataSchema.partial().strict()

export const DEFAULT_INSTANCE_CONFIG: InstanceConfig = Object.freeze({
  ...InstanceConfigFileSchema.parse({})
})

export function parseInstanceConfig(input: unknown): InstanceConfig {
  const parsed = InstanceConfigFileSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`instance 配置校验失败:\n${z.prettifyError(parsed.error)}`)
  }
  return Object.freeze(parsed.data)
}

export function mergeInstanceConfig(
  current: InstanceConfig,
  update: InstanceConfigUpdate,
): InstanceConfig {
  return parseInstanceConfig({
    ...current,
    ...update,
    schema_version: current.schema_version,
  })
}

export function assertInstanceConfigWithinHardLimit(
  config: InstanceConfig,
  hard_limit_bytes: number,
): void {
  if (config.max_upload_bytes > hard_limit_bytes) {
    throw apiError(
      400,
      'BAD_REQUEST',
      `max_upload_bytes(${config.max_upload_bytes}) 不能超过 HTTP_BODY_HARD_LIMIT_BYTES(${hard_limit_bytes})`,
    )
  }
}
