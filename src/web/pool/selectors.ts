import type {
  ClientGallery,
  ClientGalleryInEvent,
  ClientMember,
  ClientPool,
  ClientPhoto,
  ClientPhotoInEvent,
} from '@shared/client-pool'

const DAY = 24 * 60 * 60 * 1000

export function isGalleryInEvent(
  gallery: ClientGallery | ClientGalleryInEvent,
): gallery is ClientGalleryInEvent {
  return gallery.in_event
}

export function activeGallery(pool: ClientPool): ClientGalleryInEvent | null {
  return pool.galleries.find(isGalleryInEvent) ?? null
}

export function normalGalleries(pool: ClientPool): ClientGallery[] {
  return pool.galleries.filter((gallery): gallery is ClientGallery => !gallery.in_event)
}

export type MemberIndex = Map<number, ClientMember>

export function memberMap(pool: ClientPool): MemberIndex {
  return new Map(pool.members.map(member => [member.id, member]))
}

export function memberById(
  members: ReadonlyMap<number, ClientMember>,
  member_id: number | null,
): ClientMember | null {
  if (member_id === null) {
    return null
  }
  return members.get(member_id) ?? null
}

export function canSubmit(
  gallery: ClientGallery | ClientGalleryInEvent,
  now = Date.now(),
): boolean {
  return gallery.in_event
    && now < Date.parse(gallery.submission_expire)
}

export function canVote(
  gallery: ClientGallery | ClientGalleryInEvent,
  now = Date.now(),
): boolean {
  return gallery.in_event
    && now >= Date.parse(gallery.submission_expire)
    && now <= Date.parse(gallery.event_end)
}

export function daysUntil(date_string: string, now = Date.now()): number {
  return Math.ceil((Date.parse(date_string) - now) / DAY)
}

export function isPhotoInEvent(
  photo: ClientPhoto | ClientPhotoInEvent,
): photo is ClientPhotoInEvent {
  return photo.member_id === null
}
