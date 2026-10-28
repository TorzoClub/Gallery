export type InstanceConfig = Readonly<{
  schema_version: 1
  avatar_thumb_size: number
  image_thumb_size: number
  image_thumb_quality: number
  avif_source_quality: number
  image_processing_effort: number
  max_image_dimension: number
  max_upload_bytes: number
}>

export type InstanceConfigUpdate = Partial<Omit<InstanceConfig, 'schema_version'>>
