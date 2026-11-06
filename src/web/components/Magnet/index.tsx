import type { CSSProperties, Ref } from 'react'
import styles from './index.module.scss'

/** 一颗投票磁粒。`value` 5 只在后台统计里用（红色代表 5 票）；公开页一律是蓝色的 1 票。 */
export function Magnet({ value = 1, className, style, ref }: {
  value?: 1 | 5
  className?: string
  style?: CSSProperties
  ref?: Ref<HTMLSpanElement>
}) {
  return (
    <span
      ref={ref}
      className={[styles.magnet, value === 5 ? styles.five : styles.one, className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden='true'
    />
  )
}

/** 磁粒的空位 */
export function MagnetSlot({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      className={[styles.slot, className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden='true'
    />
  )
}
