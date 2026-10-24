import sharp from 'sharp'

sharp.cache(false)

export async function generateThumb({
  source_image_path,
  thumb_image_path,
  thumb_size,
}: {
  source_image_path: string
  thumb_image_path: string
  thumb_size: number
}) {
  const sharp_p = sharp(source_image_path)

  await sharp_p
    .rotate()
    .flatten({ background: '#FFFFFF' })
    .resize(thumb_size, null, { withoutEnlargement: true })
    .avif({
      quality: 40,
      effort: 8,
    })
    .toFile(thumb_image_path)

  sharp_p.destroy()

  return thumb_image_path
}

export type ImageDimession = {
  orientation: number | undefined
  width: number | undefined
  height: number | undefined
}

// ref: https://sharp.pixelplumbing.com/api-input#metadata
export function sizeNormalize({ width, height, orientation }: sharp.Metadata): ImageDimession {
  return (orientation || 0) >= 5
    ? { orientation, width: height, height: width }
    : { orientation, width, height }
}

export async function getImageDimession(filePath: string) {
  const meta = await sharp(filePath).metadata()
  return sizeNormalize(meta)
}
