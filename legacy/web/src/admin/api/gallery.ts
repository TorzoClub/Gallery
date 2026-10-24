import { request } from './client'
import type { Gallery, GalleryPayload, MemberVote } from './types'

export function listGalleries(): Promise<Gallery[]> {
  return request<Gallery[]>({
    url: 'admin/gallery',
    method: 'GET',
  })
}

export function getGallery(id: number | string): Promise<Gallery> {
  return request<Gallery>({
    url: `admin/gallery/${id}`,
    method: 'GET',
  })
}

export function createGallery(data: GalleryPayload): Promise<Gallery> {
  return request<Gallery>({
    url: 'admin/gallery',
    method: 'POST',
    data,
  })
}

export function updateGallery(id: number, data: Omit<GalleryPayload, 'index'>): Promise<Gallery> {
  return request<Gallery>({
    url: `admin/gallery/${id}`,
    method: 'PATCH',
    data,
  })
}

export function removeGallery(id: number): Promise<unknown> {
  return request<unknown>({
    url: `admin/gallery/${id}`,
    method: 'DELETE',
  })
}

export function getMemberVoteList(galleryId: number | string): Promise<MemberVote[]> {
  return request<MemberVote[]>({
    url: `admin/gallery/${galleryId}/member_vote`,
    method: 'GET',
  })
}
