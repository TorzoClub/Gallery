import { adminMutate } from './client'
import type { Photo, PhotoPayload } from './types'

export function createPhoto(data: PhotoPayload & { temp_id: string }): Promise<Photo> {
  return adminMutate<Photo>('adminCreatePhoto', data)
}

export function updatePhoto(id: number, data: PhotoPayload): Promise<Photo> {
  return adminMutate<Photo>('adminUpdatePhoto', {
    gallery_id: data.gallery_id,
    photo_id: id,
    ...(data.member_id === undefined ? {} : { member_id: data.member_id }),
    ...(data.desc === undefined ? {} : { desc: data.desc }),
    ...(data.temp_id === undefined ? {} : { temp_id: data.temp_id }),
  })
}

export function removePhoto(id: number): Promise<Photo> {
  return adminMutate<Photo>('adminRemovePhoto', { photo_id: id })
}

export function sortPhotosByVoteCount(galleryId: number | string): Promise<unknown> {
  return adminMutate('adminSortPhotosByVoteCount', {
    gallery_id: Number(galleryId),
  })
}
