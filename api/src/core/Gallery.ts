import { Map, List } from 'immutable'
import { Photo, PhotoID } from './Photo'
import ID from '../common/ID'
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
  photos: Map<PhotoID, Photo>
  vote_records: List<VoteRecord>
}

function checkGallery(gallery: Gallery): Gallery {
  const { event_start, submission_expire, event_end } = gallery
  const legal_date = (event_start < submission_expire) && (submission_expire < event_end)
  if (!legal_date) {
    throw new Error(`Invalid gallery(id=${gallery.id}): event_start < submission_expire < event_end is not satisfied.`)
  }

  const legal_vote_limit = gallery.vote_limit >= 0
  if (!legal_vote_limit) {
    throw new Error(`Invalid gallery(id=${gallery.id}): vote_limit must be non-negative.`)
  }

  return gallery
}

function updateGallery(gallery: Gallery, items: Partial<Gallery>): Gallery {
  const updated_gallery = { ...gallery, ...items }
  return checkGallery(updated_gallery)
}

function inEventPeriod(now: Date, gallery: Gallery): boolean {
  return (now >= gallery.event_start) && (now <= gallery.event_end)
}

function inSubmittingPeriod(now: Date, gallery: Gallery): boolean {
  return inEventPeriod(now, gallery) && (
    now <= gallery.submission_expire
  )
}

function inVotingPeriod(now: Date, gallery: Gallery): boolean {
  return inEventPeriod(now, gallery) && (
    now > gallery.submission_expire
  )
}

function hasVoted(gallery: Gallery, photo_id: PhotoID, member_qq_num: QQNumber): boolean {
  return gallery.vote_records.some(
    (record) => record.photo_id === photo_id && record.member_qq_num === member_qq_num
  )
}

function hasSubmission(gallery: Gallery, photo_id: PhotoID, member_qq_num: QQNumber): boolean {
  return gallery.photos.some(
    (photo) => photo.id === photo_id && photo.member_qq_num === member_qq_num
  )
}

export function voteCountByMember(gallery: Gallery, member_qq_num: QQNumber): number {
  return gallery.vote_records.filter(
    (record) => record.member_qq_num === member_qq_num
  ).size
}

function reachVoteLimit(gallery: Gallery, member_qq_num: QQNumber): boolean {
  if (gallery.vote_limit === 0) {
    return false
  } else {
    return voteCountByMember(gallery, member_qq_num) >= gallery.vote_limit
  }
}

export function gallerySubmitVoteRecord(now: Date, gallery: Gallery, photo_id: PhotoID, member_qq_num: QQNumber): Gallery {
  if (!inVotingPeriod(now, gallery)) {
    throw new Error(`Voting is not allowed for gallery(id=${gallery.id}) at this time.`)
  } else if (hasVoted(gallery, photo_id, member_qq_num)) {
    throw new Error(`Member(qq=${member_qq_num}) has already voted for photo ${photo_id}.`)
  } else if (reachVoteLimit(gallery, member_qq_num)) {
    throw new Error(`Member(qq=${member_qq_num}) has reached the vote limit of ${gallery.vote_limit}.`)
  } else {
    return updateGallery(gallery, {
      vote_records: gallery.vote_records.push({
        photo_id: photo_id,
        member_qq_num: member_qq_num
      })
    })
  }
}

export function gallerySetSubmission(
  gallery: Gallery,
  now: Date,
  member_qq_num: QQNumber,
  photo: Photo,
): Gallery {
  if (!inSubmittingPeriod(now, gallery)) {
    throw new Error(`Submission is not allowed for gallery(id=${gallery.id}) at this time.`)
  } else if (hasSubmission(gallery, photo.id, member_qq_num)) {
    throw new Error(`Member(qq=${member_qq_num}) has already submitted photo ${photo.id}.`)
  } else {
    return updateGallery(gallery, {
      photos: gallery.photos.set(photo.id, photo),
    })
  }
}

export function galleryCancelSubmission(
  gallery: Gallery,
  now: Date,
  member_qq_num: QQNumber,
  photo: Photo,
): Gallery {
  if (!inSubmittingPeriod(now, gallery)) {
    throw new Error(`Submission is not allowed for gallery(id=${gallery.id}) at this time.`)
  } else if (!hasSubmission(gallery, photo.id, member_qq_num)) {
    throw new Error(`成员(qq=${member_qq_num})将要提交的相片(${photo.id})不存在.`)
  } else {
    return updateGallery(gallery, {
      photos: gallery.photos.delete(photo.id),
    })
  }
}
