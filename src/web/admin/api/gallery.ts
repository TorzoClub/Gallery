import { adminMutate, adminQuery } from './client'
import type { Gallery, GalleryPayload, MemberVote } from './types'

export function listGalleries(): Promise<Gallery[]> {
  return adminQuery<Gallery[]>('adminListGalleries')
}

export function getGallery(id: number | string): Promise<Gallery> {
  return adminQuery<Gallery>('adminGetGallery', { gallery_id: Number(id) })
}

export function createGallery(data: GalleryPayload): Promise<Gallery> {
  return adminMutate<Gallery>('adminCreateGallery', data)
}

export function updateGallery(id: number, data: Omit<GalleryPayload, 'index'>): Promise<Gallery> {
  return adminMutate<Gallery>('adminUpdateGallery', {
    gallery_id: id,
    ...data,
  })
}

export function removeGallery(id: number): Promise<Gallery> {
  return adminMutate<Gallery>('adminRemoveGallery', { gallery_id: id })
}

export function getMemberVoteList(galleryId: number | string): Promise<MemberVote[]> {
  return adminQuery<MemberVote[]>('adminListMemberVotes', {
    gallery_id: Number(galleryId),
  })
}
