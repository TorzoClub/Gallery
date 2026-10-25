export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'] as const

export type ImageFormat = 'jpg' | 'png' | 'gif' | 'webp' | 'avif'

export function extensionOf(filename: string): string {
  const index = filename.lastIndexOf('.')
  return index < 0 ? '' : filename.slice(index + 1).toLowerCase()
}

export function basenameWithoutExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  return index < 0 ? filename : filename.slice(0, index)
}

export function formatFromFilename(filename: string): ImageFormat | null {
  const ext = extensionOf(filename)
  if (ext === 'jpeg') {
    return 'jpg'
  }
  if (ext === 'jpg' || ext === 'png' || ext === 'gif' || ext === 'webp' || ext === 'avif') {
    return ext
  }
  return null
}

export function isSupportedImageFilename(filename: string): boolean {
  return formatFromFilename(filename) !== null
}

export function isSafeFilename(filename: string): boolean {
  if (filename.length === 0 || filename.length > 255) {
    return false
  }
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return false
  }
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename)
}

export function photoVariantFilename(
  source_filename: string,
  variant: 'sdr' | 'hdr',
): string {
  return `${basenameWithoutExtension(source_filename)}-${variant}.avif`
}

export function legacyPhotoVariantFilename(
  source_filename: string,
  variant: 'sdr' | 'hdr',
): string {
  return `${basenameWithoutExtension(source_filename)}-${variant}.${extensionOf(source_filename)}`
}

export function legacyUnversionedPhotoFilenames(source_filename: string): string[] {
  const base = basenameWithoutExtension(source_filename)
  const source_ext = extensionOf(source_filename)
  return [...new Set([`${base}.avif`, `${base}.${source_ext}`])]
}

export function avatarThumbFilename(source_filename: string): string {
  return source_filename
}

export function mimeTypeOf(filename: string): string {
  switch (extensionOf(filename)) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'avif':
      return 'image/avif'
    default:
      return 'application/octet-stream'
  }
}
