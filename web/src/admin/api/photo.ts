import { request } from './client'
import type { Photo, PhotoPayload } from './types'

export function listPhotos(galleryId: number | string): Promise<Photo[]> {
  return request<Photo[]>({
    url: `admin/gallery/${galleryId}/photo`,
    method: 'GET',
  })
}

export function getPhoto(id: number | string): Promise<Photo> {
  return request<Photo>({
    url: `admin/photo/${id}`,
    method: 'GET',
  })
}

export function createPhoto(data: Required<PhotoPayload>): Promise<Photo> {
  return request<Photo>({
    url: 'admin/photo',
    method: 'POST',
    data,
  })
}

export function updatePhoto(id: number, data: Omit<PhotoPayload, 'src'> & { src?: string }): Promise<Photo> {
  return request<Photo>({
    url: `admin/photo/${id}`,
    method: 'PATCH',
    data,
  })
}

export function removePhoto(id: number): Promise<unknown> {
  return request<unknown>({
    url: `admin/photo/${id}`,
    method: 'DELETE',
  })
}

export function sortPhotosByVoteCount(galleryId: number | string): Promise<unknown> {
  return request<unknown>({
    url: `admin/gallery/${galleryId}/photo/sortByVoteCount`,
    method: 'PUT',
    timeout: 0,
  })
}
