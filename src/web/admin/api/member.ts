import { adminMutate } from './client'
import type { Member, MemberCreatePayload, MemberUpdatePayload } from './types'

export function createMember(data: MemberCreatePayload): Promise<Member> {
  return adminMutate<Member>('adminCreateMember', data)
}

export function updateMember(id: number, data: MemberUpdatePayload): Promise<Member> {
  return adminMutate<Member>('adminUpdateMember', {
    member_id: id,
    ...data,
  })
}

export function removeMember(id: number): Promise<Member> {
  return adminMutate<Member>('adminRemoveMember', { member_id: id })
}

export function setRetryVote(params: { id: number; gallery_id: number | string }): Promise<unknown> {
  return adminMutate('adminClearMemberGalleryVotes', {
    member_id: params.id,
    gallery_id: Number(params.gallery_id),
  })
}
