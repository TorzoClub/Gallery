import ID from '../common/ID'
export type QQNumber = ID<number, 'QQNumber'>

export type Member = {
  qq_num: QQNumber
  name: string
  avatar_src: string
}

function checkMember(member: Member): Member {
  const legal_qq_num = member.qq_num > 0
  if (!legal_qq_num) {
    throw new Error(`Invalid member(qq_num=${member.qq_num}): qq_num must be positive.`)
  }

  const member_name = member.name.trim()
  const legal_name = member_name.length > 0
  if (!legal_name) {
    throw new Error(`Invalid member(qq_num=${member.qq_num}): name must be non-empty.`)
  }

  const member_avatar_src = member.avatar_src.trim()
  const legal_avatar_src = member_avatar_src.length > 0
  if (!legal_avatar_src) {
    throw new Error(`Invalid member(qq_num=${member.qq_num}): avatar_src must be non-empty.`)
  }

  return member
}

export function updateMember(member: Member, items: Omit<Partial<Member>, 'qq_num'>): Member {
  const updated_member = { ...member, ...items }
  return checkMember(updated_member)
}
