export type InstanceConfig = Readonly<{
  schema_version: 1
  avatar_thumb_size: number
  image_thumb_size: number
  image_thumb_quality: number
  image_thumb_effort: number
  max_image_dimension: number
  max_upload_bytes: number
}>

export type InstanceConfigUpdate = Partial<Omit<InstanceConfig, 'schema_version'>>
