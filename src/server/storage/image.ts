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

export async function writeOptimizedImage(options: {
  input_path: string
  output_path: string
  max_dimension: number
  quality: number
  effort: number
}): Promise<void> {
  await sharp(options.input_path)
    .rotate()
    .toColourspace('srgb')
    .flatten({ background: '#FFFFFF' })
    .resize({
      width: options.max_dimension,
      height: options.max_dimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .avif({
      quality: options.quality,
      effort: options.effort,
      bitdepth: 8,
    })
    .toFile(options.output_path)
}

export async function writeThumbImage(options: {
  input_path: string
  output_path: string
  size: number
  quality: number
  effort: number
}): Promise<void> {
  await sharp(options.input_path)
    .rotate()
    .toColourspace('srgb')
    .flatten({ background: '#FFFFFF' })
    .resize({
      width: options.size,
      withoutEnlargement: true,
    })
    .avif({
      quality: options.quality,
      effort: options.effort,
      bitdepth: 8,
    })
    .toFile(options.output_path)
}

export function thumbNameOf(source_filename: string): string {
  return `${basenameWithoutExtension(source_filename)}.avif`
}
