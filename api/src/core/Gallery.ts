import { List } from 'immutable'
import { Photo, PhotoID } from './Photo'
import ID from './ID'
import { QQNumber } from './Member'

type VoteRecord = {
  photo_id: PhotoID
  member_qq_num: QQNumber
}

export type GalleryID = ID<number, 'GalleryID'>

export type Gallery = {
  id: GalleryID
  index: number
  name: string
  vote_limit: number
  event_start: Date
  submission_expire: Date
  event_end: Date
  photos: List<Photo>
  vote_records: List<VoteRecord>
}

export function galleryCanSubmission(gallery: Gallery, now: Date): boolean {
  return galleryInEvent(gallery, now) && (
    now <= gallery.submission_expire
  )
}

export function galleryInEvent(gallery: Gallery, now: Date): boolean {
  return (now >= gallery.event_start) && (now <= gallery.event_end)
}
