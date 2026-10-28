import { mutate, query } from './dispatch'
import type { ClientMemberView, ClientPool } from '@shared/client-pool'

export function fetchClientPool(): Promise<ClientPool> {
  return query<ClientPool>('fetchClientPool')
}

export function fetchMemberView(qq_num: number): Promise<ClientMemberView> {
  return query<ClientMemberView>('fetchMemberView', { qq_num })
}

export function confirmMember(qq_num: number): Promise<boolean> {
  return query<{ value: boolean }>('confirmMember', { qq_num })
    .then(result => result.value)
}

export function vote(input: {
  gallery_id: number
  qq_num: number
  photo_ids: number[]
}): Promise<unknown> {
  return mutate('vote', input)
}

export function submitPhoto(input: {
  gallery_id: number
  qq_num: number
  desc: string
  temp_id: string
}): Promise<unknown> {
  return mutate('submitPhoto', input)
}

export function updateSubmission(input: {
  photo_id: number
  qq_num: number
  desc?: string
  temp_id?: string
}): Promise<unknown> {
  return mutate('updateSubmission', input)
}

export function cancelSubmission(input: {
  photo_id: number
  qq_num: number
}): Promise<unknown> {
  return mutate('cancelSubmission', input)
}
