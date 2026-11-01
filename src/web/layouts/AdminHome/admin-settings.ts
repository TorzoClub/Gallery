import type { InstanceConfig } from '@shared/config'
import type { InstanceConfigUpdate } from '../../admin/api/config'
import type { AdminSettings } from './components/AdminConsole'

export function settingsFromInstanceConfig(config: InstanceConfig): AdminSettings {
  return {
    avatarThumbSize: config.avatar_thumb_size,
    photoThumbSize: config.image_thumb_size,
    maxImageSize: config.max_image_dimension,
    maxUploadMB: Math.max(1, Math.round(config.max_upload_bytes / (1024 * 1024))),
    thumbQuality: config.image_thumb_quality,
    avifQuality: config.avif_source_quality,
    avifEffort: config.image_processing_effort,
  }
}

export function instanceConfigFromSettings(settings: AdminSettings): InstanceConfigUpdate {
  return {
    avatar_thumb_size: settings.avatarThumbSize,
    image_thumb_size: settings.photoThumbSize,
    max_image_dimension: settings.maxImageSize,
    max_upload_bytes: Math.round(settings.maxUploadMB * 1024 * 1024),
    image_thumb_quality: settings.thumbQuality,
    avif_source_quality: settings.avifQuality,
    image_processing_effort: settings.avifEffort,
  }
}
