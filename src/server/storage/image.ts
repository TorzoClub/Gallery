import sharp from 'sharp'
import { badRequest, isApiError } from '../common/error'
import {
  type ImageFormat,
  basenameWithoutExtension,
} from '../common/image-name'

sharp.cache({ memory: 50, files: 0, items: 100 })

type SharpImage = ReturnType<typeof sharp>
type SharpMetadata = Awaited<ReturnType<SharpImage['metadata']>>

export type ImageInfo = {
  format: ImageFormat
  width: number
  height: number
  bits_per_sample: number
  has_gain_map: boolean
  is_hdr: boolean
}

type ImageMetadataLike = {
  width?: number | undefined
  height?: number | undefined
  orientation?: number | undefined
  format?: string | undefined
}

function normalizeFormat(format: string | undefined): ImageFormat {
  switch (format) {
    case 'jpeg':
    case 'jpg':
      return 'jpg'
    case 'png':
      return 'png'
    case 'gif':
      return 'gif'
    case 'webp':
      return 'webp'
    case 'avif':
    case 'heif':
      return 'avif'
    default:
      throw badRequest(`不支持的图片格式: ${format ?? 'unknown'}`)
  }
}

export function normalizedSize(metadata: ImageMetadataLike): { width: number; height: number } {
  const { width, height, orientation } = metadata
  if (width === undefined || height === undefined) {
    throw badRequest('无法读取图片尺寸')
  }
  if ((orientation ?? 0) >= 5) {
    return { width: height, height: width }
  }
  return { width, height }
}

function bitsPerSample(metadata: SharpMetadata): number {
  return metadata.bitsPerSample ?? (metadata.depth === 'ushort' ? 16 : 8)
}

function hasGainMap(metadata: SharpMetadata): boolean {
  return metadata.gainMap !== undefined
}

function isHdr(metadata: SharpMetadata): boolean {
  return hasGainMap(metadata)
    || bitsPerSample(metadata) > 8
    || metadata.depth === 'ushort'
    || metadata.depth === 'float'
}

export async function readImageInfo(file_path: string): Promise<ImageInfo> {
  try {
    const metadata = await sharp(file_path).metadata()
    const { width, height } = normalizedSize(metadata)
    return {
      format: normalizeFormat(metadata.format),
      width,
      height,
      bits_per_sample: bitsPerSample(metadata),
      has_gain_map: hasGainMap(metadata),
      is_hdr: isHdr(metadata),
    }
  } catch (error) {
    if (isApiError(error)) {
      throw error
    }
    throw badRequest('无法解析图片文件')
  }
}

export function imageExtension(format: ImageFormat): string {
  return format
}

/** sharp / libheif 输出 AVIF 时每条边的上限，超过会报 “Processed image is too large for the HEIF format” */
export const AVIF_MAX_DIMENSION = 16384

/** 相片的缩略图和 optimized，短边无论如何不低于这个值（原图短边本来就更小时保持原尺寸，不放大） */
export const MIN_DERIVED_SHORT_EDGE = 256

export type ImageSize = { width: number; height: number }

function scaledSize(source: ImageSize, scale: number): ImageSize {
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
}

/** 缩放比例不能让短边低于 MIN_DERIVED_SHORT_EDGE；这条优先于 image_thumb_size / max_image_dimension */
function withShortEdgeFloor(source: ImageSize, scale: number): number {
  const short = Math.min(source.width, source.height)
  return Math.max(scale, Math.min(1, MIN_DERIVED_SHORT_EDGE / short))
}

/**
 * 相片缩略图尺寸：宽 = image_thumb_size，高等比；不放大；短边不低于 256。
 * source 是摆正之后（已应用 EXIF orientation）的尺寸，与 normalizedSize 一致。
 */
export function photoThumbSize(source: ImageSize, thumb_size: number): ImageSize {
  return scaledSize(source, withShortEdgeFloor(source, Math.min(1, thumb_size / source.width)))
}

/** 相片 optimized 尺寸：长边 ≤ max_image_dimension；不放大；短边不低于 256（这条优先，此时长边可以超过 max_image_dimension） */
export function photoOptimizedSize(source: ImageSize, max_dimension: number): ImageSize {
  const long = Math.max(source.width, source.height)
  return scaledSize(source, withShortEdgeFloor(source, Math.min(1, max_dimension / long)))
}

/** 头像缩略图尺寸：宽 = avatar_thumb_size，高等比；不放大。头像不参与短边下限 */
export function avatarThumbSize(source: ImageSize, size: number): ImageSize {
  return scaledSize(source, Math.min(1, size / source.width))
}

/** 生成的图任何一边超过 AVIF 上限就拒绝：报给用户，而不是让 sharp 在半路报 HEIF 错误 */
export function assertAvifSize(source: ImageSize, target: ImageSize, label: string): void {
  if (target.width > AVIF_MAX_DIMENSION || target.height > AVIF_MAX_DIMENSION) {
    throw badRequest(
      `图片太长了（${source.width}×${source.height}）：按当前设置生成的${label}会是 ${target.width}×${target.height}，`
      + `超过每边 ${AVIF_MAX_DIMENSION}px 的上限。请裁短后再上传`,
    )
  }
}

/**
 * 上传时的检查：这张图不论拿去当相片还是头像，按当前配置生成的每一张图都不能超过 AVIF 上限。
 * 上传接口不知道图片的用途，所以三种都检查。
 */
export function assertDerivableImage(source: ImageSize, config: {
  image_thumb_size: number
  max_image_dimension: number
  avatar_thumb_size: number
}): void {
  assertAvifSize(source, photoThumbSize(source, config.image_thumb_size), '缩略图')
  assertAvifSize(source, photoOptimizedSize(source, config.max_image_dimension), '大图')
  assertAvifSize(source, avatarThumbSize(source, config.avatar_thumb_size), '头像缩略图')
}

async function writeResizedAvif(options: {
  input_path: string
  output_path: string
  size: (source: ImageSize) => ImageSize
  label: string
  quality: number
  effort: number
}): Promise<void> {
  const source = normalizedSize(await sharp(options.input_path).metadata())
  const target = options.size(source)
  // 配置可能在上传之后改过（重新生成图片时），这里再查一次
  assertAvifSize(source, target, options.label)
  await sharp(options.input_path)
    .rotate()
    .toColourspace('srgb')
    .flatten({ background: '#FFFFFF' })
    .resize({ width: target.width, height: target.height, fit: 'fill' })
    .avif({
      quality: options.quality,
      effort: options.effort,
      bitdepth: 8,
    })
    .toFile(options.output_path)
}

/** 相片的 optimized 全尺寸图，见 photoOptimizedSize */
export async function writeOptimizedImage(options: {
  input_path: string
  output_path: string
  max_dimension: number
  quality: number
  effort: number
}): Promise<void> {
  await writeResizedAvif({ ...options, label: '大图', size: source => photoOptimizedSize(source, options.max_dimension) })
}

/** 相片缩略图，见 photoThumbSize */
export async function writePhotoThumbImage(options: {
  input_path: string
  output_path: string
  size: number
  quality: number
  effort: number
}): Promise<void> {
  await writeResizedAvif({ ...options, label: '缩略图', size: source => photoThumbSize(source, options.size) })
}

/** 头像缩略图，见 avatarThumbSize */
export async function writeAvatarThumbImage(options: {
  input_path: string
  output_path: string
  size: number
  quality: number
  effort: number
}): Promise<void> {
  await writeResizedAvif({ ...options, label: '头像缩略图', size: source => avatarThumbSize(source, options.size) })
}

export function thumbNameOf(source_filename: string): string {
  return `${basenameWithoutExtension(source_filename)}.avif`
}
