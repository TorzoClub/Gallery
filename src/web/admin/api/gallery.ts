import { adminMutate } from './client'
import type { Gallery, GalleryPayload } from './types'

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
