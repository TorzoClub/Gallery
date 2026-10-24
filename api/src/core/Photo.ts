import ID from '../common/ID'
import { QQNumber } from './Member'

export type Format = 'jpg' | 'png' | 'gif' | 'webp' | 'avif'

export type PhotoID = ID<number, 'PhotoID'>

export type Photo = {
  id: PhotoID
  index: number
  desc: string
  format: Format
  width: number
  height: number
  member_qq_num: QQNumber
}
