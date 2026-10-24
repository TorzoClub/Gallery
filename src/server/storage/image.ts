import sharp from 'sharp'
import { badRequest, isApiError } from '../common/error'
import {
  type ImageFormat,
  basenameWithoutExtension,
} from '../common/image-name'

sharp.cache({ memory: 50, files: 0, items: 100 })

export type ImageInfo = {
  format: ImageFormat
  width: number
  height: number
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

export async function readImageInfo(file_path: string): Promise<ImageInfo> {
  try {
    const metadata = await sharp(file_path).metadata()
    const { width, height } = normalizedSize(metadata)
    return {
      format: normalizeFormat(metadata.format),
      width,
      height,
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

export async function writeSourceImage(options: {
  input_path: string
  output_path: string
  max_dimension: number
}): Promise<ImageInfo> {
  const metadata = await sharp(options.input_path).metadata()
  const format = normalizeFormat(metadata.format)
  const { width, height } = normalizedSize(metadata)
  const ratio = Math.min(1, options.max_dimension / Math.max(width, height))
  const output_width = Math.max(1, Math.round(width * ratio))
  const output_height = Math.max(1, Math.round(height * ratio))

  await sharp(options.input_path)
    .rotate()
    .flatten({ background: '#FFFFFF' })
    .resize({
      width: options.max_dimension,
      height: options.max_dimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toFile(options.output_path)

  return {
    format,
    width: output_width,
    height: output_height,
  }
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
    .flatten({ background: '#FFFFFF' })
    .resize({
      width: options.size,
      withoutEnlargement: true,
    })
    .avif({
      quality: options.quality,
      effort: options.effort,
    })
    .toFile(options.output_path)
}

export function thumbNameOf(source_filename: string): string {
  return `${basenameWithoutExtension(source_filename)}.avif`
}
