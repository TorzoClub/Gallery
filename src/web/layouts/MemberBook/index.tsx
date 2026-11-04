import React, { lazy, Suspense } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useClientPool } from '../../pool/store'
import { memberIdFromPath } from '../../routes'
import styles from './index.module.scss'

const PublicMemberNotebook = lazy(() => import('../../components/PublicMemberNotebook'))

/**
 * /member/<member_id>：单独的成员笔记本（CH. Member）。
 * 从公开页 PhotoCard 的头像 / 昵称换台进来，直接打开这位成员的成员页；成员页的“‹”换台回 /explore。
 * 只读，数据只来自 ClientPool。成员不存在就直接回 /explore。
 */
export default function MemberBookApp() {
  const location = useLocation()
  const navigate = useNavigate()
  const pool_state = useClientPool()
  const member_id = memberIdFromPath(location.pathname)

  if (member_id === null || pool_state.status === 'error') {
    return <Navigate to='/explore' replace />
  }
  if (pool_state.status === 'loading') {
    return <section className={styles.page} aria-label='成员' />
  }
  if (!pool_state.pool.members.some(m => String(m.id) === member_id)) {
    return <Navigate to='/explore' replace />
  }

  return (
    <section className={styles.page} aria-label='成员'>
      <div className={styles.book}>
        <Suspense fallback={null}>
          <PublicMemberNotebook
            // 换了成员就是另一本：重新从成员页开始
            key={member_id}
            pool={pool_state.pool}
            entryMemberId={member_id}
            onLeave={() => navigate('/explore', { replace: true })}
          />
        </Suspense>
      </div>
    </section>
  )
}
