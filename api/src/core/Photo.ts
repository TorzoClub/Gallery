import ID from './ID'

export type Format = 'jpg' | 'png' | 'gif' | 'webp' | 'avif'

export type PhotoID = ID<number, 'PhotoID'>

export type Photo = {
  id: PhotoID
  desc: string
  format: Format
  width: number
  height: number
}
