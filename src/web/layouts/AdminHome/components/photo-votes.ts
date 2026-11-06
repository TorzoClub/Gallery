import type { MemberDTO, VoteDTO } from '../../../../shared/dto'

export type PhotoVoteRecord = {
  vote: VoteDTO
  member: MemberDTO | null
}

export const EMPTY_PHOTO_VOTES: readonly PhotoVoteRecord[] = []

export function indexPhotoVotes(
  gallery_id: number,
  votes: readonly VoteDTO[],
  members: readonly MemberDTO[],
): ReadonlyMap<number, readonly PhotoVoteRecord[]> {
  const member_map = new Map(members.map(member => [member.id, member]))
  const by_photo = new Map<number, PhotoVoteRecord[]>()
  for (const vote of votes) {
    if (vote.gallery_id !== gallery_id) {
      continue
    }
    const records = by_photo.get(vote.photo_id) ?? []
    records.push({ vote, member: member_map.get(vote.member_id) ?? null })
    by_photo.set(vote.photo_id, records)
  }
  for (const records of by_photo.values()) {
    records.sort((left, right) => (
      Date.parse(right.vote.created_at) - Date.parse(left.vote.created_at)
      || right.vote.id - left.vote.id
    ))
  }
  return by_photo
}

export type PhotoSortBy = 'created_at' | 'vote_count'
export type PhotoSortDirection = 'asc' | 'desc'

export function sortGalleryPhotos<T extends { id: number; created_at: string }>(
  photos: readonly T[],
  votes_by_photo: ReadonlyMap<number, readonly PhotoVoteRecord[]>,
  sort_by: PhotoSortBy,
  direction: PhotoSortDirection,
): T[] {
  const value = (photo: T) => sort_by === 'vote_count'
    ? votes_by_photo.get(photo.id)?.length ?? 0
    : Date.parse(photo.created_at) || 0
  const sign = direction === 'asc' ? 1 : -1
  return [...photos].sort((left, right) => (
    sign * (value(left) - value(right)) || left.id - right.id
  ))
}

export function getVoteMagnetValues(vote_count: number): (1 | 5)[] {
  return [
    ...Array.from({ length: vote_count % 5 }, () => 1 as const),
    ...Array.from({ length: Math.floor(vote_count / 5) }, () => 5 as const),
  ]
}

export function createMagnetOffset(random: () => number = Math.random) {
  return { x: 1 + random(), y: 2 + random() }
}

// Match PhotoCard's cover area (inside the polaroid frame). Only the image area is available,
// never the card's member/description block below it.
export function getVoteMagnetLayout(
  magnet_count: number,
  cover_width: number,
  cover_height: number,
) {
  const diameter = 16
  const gap = 6
  const inset = Math.min(8, cover_width / 4, cover_height / 4)
  const available_width = cover_width - inset * 2
  const available_height = cover_height - inset * 2
  const columns = Math.max(1, Math.min(
    magnet_count,
    Math.floor((available_width + gap) / (diameter + gap)),
  ))
  const rows = Math.max(1, Math.ceil(magnet_count / columns))
  const width = magnet_count === 0 ? 32 : columns * diameter + (columns - 1) * gap
  const height = rows * diameter + (rows - 1) * gap
  const scale = Math.min(1, available_width / width, available_height / height)

  return {
    columns,
    inset,
    diameter: diameter * scale,
    gap: gap * scale,
    width: width * scale,
    height: height * scale,
    font_size: 10 * scale,
  }
}
