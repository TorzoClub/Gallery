// 相对路径、不依赖 media.ts / AdminConsole：服务端的 tsconfig 也会检查导入它的单测
import type { ClientMember, ClientPhotoBase, ClientPool } from '../../shared/client-pool'

/** 与名单簿的 Member / MemberSubmission 同构 */
export type BookMember = {
  id: number
  nickname: string
  qq: string
  avatarUrl?: string
  createdAt?: string
  photoCount?: number
  voteCount?: number
}

export type BookSubmission = {
  id: number
  thumbUrl: string
  /** optimized 全尺寸图，点开大图时用 */
  srcUrl: string
  /** HDR optimized；没有时为空 */
  srcHdrUrl?: string | null
  width: number
  height: number
  desc: string
  galleryName: string
}

export type BookUrls = {
  avatar(member: ClientMember): string
  thumb(photo: ClientPhotoBase): string
  optimized(photo: ClientPhotoBase): string
  optimizedHdr(photo: ClientPhotoBase): string
}

/**
 * 公开页的名单簿：只用 ClientPool 归集，不另开接口。
 *
 * ClientPool 是遮蔽过的，所以和后台的名单簿有三处不同：
 * - 没有 QQ 号（qq_num 恒为 null），qq 记空串，名单簿只读模式不显示它；
 * - 活动中相册的相片 member_id 是 null，认不出是谁投的，不计入任何人的投稿；
 * - 活动中相册没有 vote_records，投票数只算已结束的相册。
 */
export type MemberBook = {
  members: BookMember[]
  /** 某位成员过去的投稿，从新到旧 */
  submissions(member: { id: number | string }): BookSubmission[]
}

export function memberBookFromPool(pool: ClientPool, urls: BookUrls): MemberBook {
  const by_member = new Map<number, Array<BookSubmission & { created_at: string }>>()
  const votes = new Map<number, number>()

  for (const gallery of pool.galleries) {
    for (const photo of gallery.photos) {
      if (photo.member_id === null) continue
      const list = by_member.get(photo.member_id) ?? []
      list.push({
        id: photo.id,
        thumbUrl: urls.thumb(photo),
        srcUrl: urls.optimized(photo),
        srcHdrUrl: photo.has_hdr_optimized ? urls.optimizedHdr(photo) : null,
        width: photo.width,
        height: photo.height,
        desc: photo.desc,
        galleryName: gallery.name,
        created_at: photo.created_at,
      })
      by_member.set(photo.member_id, list)
    }
    if (!gallery.in_event) {
      for (const vote of gallery.vote_records) {
        votes.set(vote.member_id, (votes.get(vote.member_id) ?? 0) + 1)
      }
    }
  }

  const submissions = new Map<number, BookSubmission[]>()
  for (const [id, list] of by_member) {
    list.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
    submissions.set(id, list.map(({ created_at: _created_at, ...rest }) => rest))
  }

  const members: BookMember[] = pool.members.map(member => ({
    id: member.id,
    nickname: member.name,
    qq: '',
    avatarUrl: urls.avatar(member),
    createdAt: member.created_at,
    photoCount: submissions.get(member.id)?.length ?? 0,
    voteCount: votes.get(member.id) ?? 0,
  }))

  return {
    members,
    submissions: (member: { id: number | string }) => submissions.get(Number(member.id)) ?? [],
  }
}
