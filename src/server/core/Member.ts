import {
  type MemberID,
  type BrandedNumber,
  asMemberID,
} from '../common/ID'
import { badRequest } from '../common/error'
import { isSafeFilename, isSupportedImageFilename } from '../common/image-name'

export type QQNumber = BrandedNumber<'QQNumber'>

export type Member = {
  id: MemberID
  qq_num: QQNumber
  name: string
  avatar_src: string
  created_at: Date
  updated_at: Date
}

export const asQQNumber = (value: number): QQNumber => value as QQNumber
export { asMemberID }

export type MemberDraft = {
  id: MemberID
  qq_num: number
  name: string
  avatar_src: string
}

function checkDate(name: string, value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${name} 不是合法日期`)
  }
}

export function checkMember(member: Member): Member {
  if (!Number.isSafeInteger(member.id) || member.id <= 0) {
    throw badRequest('成员 id 必须是正整数')
  }
  if (!Number.isSafeInteger(member.qq_num) || member.qq_num <= 0) {
    throw badRequest('QQ 号必须是正整数')
  }

  const name = member.name.trim()
  if (name.length === 0) {
    throw badRequest('成员名称不能为空')
  }

  const avatar_src = member.avatar_src.trim()
  if (!isSafeFilename(avatar_src) || !isSupportedImageFilename(avatar_src)) {
    throw badRequest('avatar_src 不是合法的图片文件名')
  }

  checkDate('created_at', member.created_at)
  checkDate('updated_at', member.updated_at)

  return {
    ...member,
    name,
    avatar_src,
  }
}

export function createMember(draft: MemberDraft, now: Date): Member {
  return checkMember({
    id: draft.id,
    qq_num: asQQNumber(draft.qq_num),
    name: draft.name,
    avatar_src: draft.avatar_src,
    created_at: now,
    updated_at: now,
  })
}

export type MemberUpdate = {
  qq_num?: number
  name?: string
  avatar_src?: string
}

export function updateMember(member: Member, items: MemberUpdate, now: Date): Member {
  return checkMember({
    ...member,
    ...(items.qq_num === undefined ? {} : { qq_num: asQQNumber(items.qq_num) }),
    ...(items.name === undefined ? {} : { name: items.name }),
    ...(items.avatar_src === undefined ? {} : { avatar_src: items.avatar_src }),
    updated_at: now,
  })
}
