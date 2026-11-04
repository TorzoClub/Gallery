import React, { useMemo } from 'react'
import type { ClientPool } from '@shared/client-pool'
import { MemberNotebook } from '../../layouts/AdminHome/components/MemberNotebook'
import { memberBookFromPool } from '../../pool/member-book'
import { memberAvatarUrl, photoThumbUrl } from '../../pool/media'

/**
 * 公开页的名单簿：后台 MemberNotebook 的只读模式，数据只来自 ClientPool。
 * 这个模块整体懒加载（它会带上后台的 MemberForm 等代码），不进公开页首屏的包。
 */
export default function PublicMemberNotebook({ pool, entryMemberId, onLeave }: {
  pool: ClientPool
  /** 传了就是单独的成员笔记本：直接打开这位成员的成员页，“‹”调用 onLeave */
  entryMemberId?: string
  onLeave?(): void
}) {
  const book = useMemo(() => memberBookFromPool(pool, {
    avatar: member => memberAvatarUrl(pool, member),
    thumb: photo => photoThumbUrl(pool, photo),
  }), [pool])
  return (
    <MemberNotebook
      members={book.members}
      memberSubmissions={book.submissions}
      readOnly
      maxLayout="M"
      defaultSort={{ key: 'photos', direction: 'desc' }}
      entryMemberId={entryMemberId}
      onLeave={onLeave}
    />
  )
}
