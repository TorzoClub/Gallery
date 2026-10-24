import { request } from './client'
import type { Member, MemberPayload } from './types'

export function listMembers(): Promise<Member[]> {
  return request<Member[]>({
    url: 'admin/member',
    method: 'GET',
  })
}

export function getMember(id: number | string): Promise<Member> {
  return request<Member>({
    url: `admin/member/${id}`,
    method: 'GET',
  })
}

export function createMember(data: MemberPayload): Promise<Member> {
  return request<Member>({
    url: 'admin/member',
    method: 'POST',
    data,
  })
}

export function updateMember(id: number, data: MemberPayload): Promise<Member> {
  return request<Member>({
    url: `admin/member/${id}`,
    method: 'PATCH',
    data,
  })
}

export function removeMember(id: number): Promise<unknown> {
  return request<unknown>({
    url: `admin/member/${id}`,
    method: 'DELETE',
  })
}

export function setRetryVote(params: { id: number; gallery_id: number | string }): Promise<unknown> {
  return request<unknown>({
    url: `admin/member/${params.id}/gallery/${params.gallery_id}/vote`,
    method: 'DELETE',
  })
}
