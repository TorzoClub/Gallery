import { type MemberID, type PhotoID } from '../common/ID'
import { badRequest } from '../common/error'
import {
  type ImageFormat,
  formatFromFilename,
  isSafeFilename,
} from '../common/image-name'

export type Format = ImageFormat

export type Photo = {
  id: PhotoID
  index: number
  desc: string
  src: string
  format: Format
  width: number
  height: number
  member_id: MemberID
  created_at: Date
  updated_at: Date
}

export type PhotoDraft = {
  id: PhotoID
  index: number
  desc: string
  src: string
  width: number
  height: number
  member_id: MemberID
}

function checkDate(name: string, value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${name} 不是合法日期`)
  }
}

export function checkPhoto(photo: Photo): Photo {
  if (!Number.isSafeInteger(photo.id) || photo.id <= 0) {
    throw badRequest('相片 id 必须是正整数')
  }
  if (!Number.isSafeInteger(photo.index) || photo.index < 0) {
    throw badRequest('相片 index 必须是非负整数')
  }
  if (!isSafeFilename(photo.src)) {
    throw badRequest('相片 src 不是合法的文件名')
  }

  const format = formatFromFilename(photo.src)
  if (format === null) {
    throw badRequest('相片 src 的格式不受支持')
  }
  if (format !== photo.format) {
    throw badRequest('相片 format 与 src 扩展名不一致')
  }

  if (!Number.isSafeInteger(photo.width) || photo.width <= 0) {
    throw badRequest('相片 width 必须是正整数')
  }
  if (!Number.isSafeInteger(photo.height) || photo.height <= 0) {
    throw badRequest('相片 height 必须是正整数')
  }
  if (!Number.isSafeInteger(photo.member_id) || photo.member_id <= 0) {
    throw badRequest('相片 member_id 必须是正整数')
  }

  checkDate('created_at', photo.created_at)
  checkDate('updated_at', photo.updated_at)

  return photo
}

export function createPhoto(draft: PhotoDraft, now: Date): Photo {
  const format = formatFromFilename(draft.src)
  if (format === null) {
    throw badRequest('相片 src 的格式不受支持')
  }

  return checkPhoto({
    id: draft.id,
    index: draft.index,
    desc: draft.desc,
    src: draft.src,
    format,
    width: draft.width,
    height: draft.height,
    member_id: draft.member_id,
    created_at: now,
    updated_at: now,
  })
}
