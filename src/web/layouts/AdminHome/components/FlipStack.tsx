import React, { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import styles from './MemberNotebook.module.scss'

/**
 * forward：当前页绕上沿翻起，露出下面的新页
 * backward：新页从上方翻回来盖住当前页
 * none：直接换页（例如布局变化导致的重新分页）
 */
export type FlipDir = 'forward' | 'backward' | 'none'

/** 与 .flipAway 的 animation-duration 一致；animationend 没来时用它兜底 */
export const FLIP_MS = 440

type Leaving = {
  id: number
  key: string
  dir: 'forward' | 'backward'
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Props = {
  /** 页的身份。变化即翻页 */
  pageKey: string
  dir: FlipDir
  className?: string
  sheetClassName?: string
  /** 按页的身份渲染内容。翻走中的旧页也用它渲染，所以 key 里要带齐渲染所需的信息 */
  renderPage(key: string): ReactNode
}

/**
 * 翻页叠层：翻走的那一页在动画期间保持挂载（表单状态、已加载的相片都还在），动画结束后卸载。
 * 只有当前页可交互；翻走中的页 pointer-events: none 且 aria-hidden。
 */
export function FlipStack({ pageKey, dir, className, sheetClassName, renderPage }: Props) {
  const [shown_key, setShownKey] = useState(pageKey)
  const [leaving, setLeaving] = useState<Leaving | null>(null)

  // 在渲染期间同步派生：同一次提交里旧页就已经挪到“翻走”位置，React 按 key 保住它的实例（表单输入、已加载的相片都还在）
  if (shown_key !== pageKey) {
    setShownKey(pageKey)
    if (dir === 'none' || prefersReducedMotion()) {
      setLeaving(null)
    } else {
      setLeaving({ id: (leaving?.id ?? 0) + 1, key: shown_key, dir })
    }
  }

  useEffect(() => {
    if (leaving === null) {
      return
    }
    const id = leaving.id
    const timer = window.setTimeout(() => {
      setLeaving(current => (current?.id === id ? null : current))
    }, FLIP_MS + 120)
    return () => window.clearTimeout(timer)
  }, [leaving])

  const finish = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || leaving === null) {
      return
    }
    const id = leaving.id
    setLeaving(current => (current?.id === id ? null : current))
  }

  const leaving_sheet = leaving && (
    <div
      key={`sheet:${leaving.key}`}
      className={cn(styles.sheet, sheetClassName, leaving.dir === 'forward' ? styles.flipAway : styles.under)}
      aria-hidden
      inert
      onAnimationEnd={leaving.dir === 'forward' ? finish : undefined}
    >
      {renderPage(leaving.key)}
    </div>
  )

  return (
    <div className={cn(styles.flipStack, className)}>
      {leaving?.dir === 'backward' && leaving_sheet}
      <div
        key={`sheet:${pageKey}`}
        className={cn(styles.sheet, sheetClassName, leaving?.dir === 'backward' && styles.flipBack)}
        onAnimationEnd={leaving?.dir === 'backward' ? finish : undefined}
      >
        {renderPage(pageKey)}
      </div>
      {leaving?.dir === 'forward' && leaving_sheet}
    </div>
  )
}
