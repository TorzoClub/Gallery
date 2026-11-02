import type {
  ClientGallery,
  ClientGalleryInEvent,
  ClientGalleryNode,
  ClientGalleryPhotos,
  ClientMember,
  ClientPhoto,
  ClientPhotoInEvent,
  ClientPool,
  ClientVote,
} from '../../shared/client-pool'
import type { AdminGalleryDTO, AdminPoolDTO, MemberDTO, PhotoDTO, VoteDTO } from '../../shared/dto'

type Timestamped = { id: number; updated_at: string }
type AnyClientPhoto = ClientPhoto | ClientPhotoInEvent

function isNewer(incoming: Timestamped, current: Timestamped): boolean {
  const incoming_time = Date.parse(incoming.updated_at)
  const current_time = Date.parse(current.updated_at)
  if (Number.isNaN(incoming_time) || Number.isNaN(current_time)) {
    return incoming.updated_at > current.updated_at
  }
  return incoming_time > current_time
}

function mergeById<T extends Timestamped>(current: readonly T[], incoming: readonly T[]): T[] {
  const current_by_id = new Map(current.map(item => [item.id, item]))
  return incoming.map(item => {
    const previous = current_by_id.get(item.id)
    return previous !== undefined && !isNewer(item, previous) ? previous : item
  })
}

function sameRefs<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index])
}

function mergePhotoItems(
  current: readonly AnyClientPhoto[],
  incoming: readonly AnyClientPhoto[],
): AnyClientPhoto[] {
  const current_by_id = new Map(current.map(photo => [photo.id, photo]))
  return incoming.map(photo => {
    const previous = current_by_id.get(photo.id)
    return previous !== undefined && !isNewer(photo, previous) ? previous : photo
  })
}

function mergeGallery(
  current: ClientGalleryNode,
  incoming: ClientGalleryNode,
): ClientGalleryNode {
  if (!isNewer(incoming, current) && current.updated_at !== incoming.updated_at) {
    return current
  }
  const photos = mergePhotoItems(current.photos, incoming.photos)

  if (incoming.in_event) {
    if (
      current.in_event
      && current.updated_at === incoming.updated_at
      && sameRefs(current.photos, photos)
    ) {
      return current
    }
    return { ...incoming, photos: photos as ClientPhotoInEvent[] }
  }

  const vote_records = current.in_event
    ? incoming.vote_records
    : mergeById(current.vote_records, incoming.vote_records)

  if (
    !current.in_event
    && current.updated_at === incoming.updated_at
    && sameRefs(current.photos, photos)
    && sameRefs(current.vote_records, vote_records)
  ) {
    return current
  }

  return { ...incoming, photos: photos as ClientPhoto[], vote_records }
}

export function mergeClientPool(current: ClientPool | null, incoming: ClientPool): ClientPool {
  if (current === null) {
    return incoming
  }

  const current_galleries = new Map(current.galleries.map(gallery => [gallery.id, gallery]))
  const galleries = incoming.galleries.map(gallery => {
    const previous = current_galleries.get(gallery.id)
    return previous === undefined ? gallery : mergeGallery(previous, gallery)
  })
  const members = mergeById(current.members, incoming.members)
  if (
    current.schema_version === incoming.schema_version
    && current.next_id === incoming.next_id
    && current.instance_hash === incoming.instance_hash
    && current.app_startup_time === incoming.app_startup_time
    && current.submissions === incoming.submissions
    && current.votes === incoming.votes
    && current.build_date === incoming.build_date
    && current.git_hash === incoming.git_hash
    && sameRefs(current.galleries, galleries)
    && sameRefs(current.members, members)
  ) {
    return current
  }

  return {
    ...incoming,
    galleries,
    members,
  }
}

export function mergeGalleryPhotos(
  current: ClientPool,
  incoming: readonly ClientGalleryPhotos[],
): ClientPool {
  const incoming_by_gallery = new Map(incoming.map(item => [item.id, item]))
  let changed = false
  const galleries = current.galleries.map(gallery => {
    const update = incoming_by_gallery.get(gallery.id)
    if (update === undefined) {
      return gallery
    }

    const photos = mergePhotoItems(gallery.photos, update.photos)
    if (gallery.in_event === update.in_event && sameRefs(gallery.photos, photos)) {
      return gallery
    }

    changed = true
    if (update.in_event) {
      const { vote_records: _discarded, ...without_votes } = gallery as ClientGallery
      return {
        ...without_votes,
        in_event: true,
        photos,
      } as ClientGalleryInEvent
    }
    return {
      ...gallery,
      in_event: false,
      photos,
      vote_records: gallery.in_event ? [] : gallery.vote_records,
    } as ClientGallery
  })

  return changed ? { ...current, galleries } : current
}

export function mergePublicMembers(
  current: ClientPool,
  incoming: readonly ClientMember[],
): ClientPool {
  const members = mergeById(current.members, incoming)
  return sameRefs(current.members, members) ? current : { ...current, members }
}

function mergeAdminGallery(
  current: AdminGalleryDTO,
  incoming: AdminGalleryDTO,
): AdminGalleryDTO {
  if (!isNewer(incoming, current) && current.updated_at !== incoming.updated_at) {
    return current
  }
  const photos = mergeById(current.photos as readonly Timestamped[], incoming.photos as readonly Timestamped[]) as PhotoDTO[]
  const vote_records = mergeById(current.vote_records as readonly Timestamped[], incoming.vote_records as readonly Timestamped[]) as VoteDTO[]

  if (
    current.updated_at === incoming.updated_at
    && sameRefs(current.photos, photos)
    && sameRefs(current.vote_records, vote_records)
  ) {
    return current
  }
  return { ...incoming, photos, vote_records }
}

export function mergeAdminPool(current: AdminPoolDTO | null, incoming: AdminPoolDTO): AdminPoolDTO {
  if (current === null) {
    return incoming
  }

  const current_galleries = new Map(current.galleries.map(gallery => [gallery.id, gallery]))
  const galleries = incoming.galleries.map(gallery => {
    const previous = current_galleries.get(gallery.id)
    return previous === undefined ? gallery : mergeAdminGallery(previous, gallery)
  })
  const members = mergeById(
    current.members as readonly Timestamped[],
    incoming.members as readonly Timestamped[],
  ) as MemberDTO[]

  if (
    current.schema_version === incoming.schema_version
    && current.next_id === incoming.next_id
    && current.instance_hash === incoming.instance_hash
    && current.app_startup_time === incoming.app_startup_time
    && current.build_date === incoming.build_date
    && current.git_hash === incoming.git_hash
    && current.instance_config === incoming.instance_config
    && sameRefs(current.galleries, galleries)
    && sameRefs(current.members, members)
  ) {
    return current
  }

  return {
    ...incoming,
    galleries,
    members,
  }
}
