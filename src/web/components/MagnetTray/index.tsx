import { createPortal } from 'react-dom'
import { Magnet, MagnetSlot } from 'components/Magnet'
import styles from './index.module.scss'

/** 超过这个票数就不再一颗颗画出来，改成“磁粒 × 剩余张数” */
const MAX_DRAWN = 10

/**
 * 屏幕底部居中的磁粒托盘：登录成员手里还没放出去的票。
 * - vote_limit > 0：一共 vote_limit 颗，放出去的位置留下虚线空位；票数太多时显示“磁粒 × 剩余”。
 * - vote_limit = 0（不限票数）：显示“磁粒 × ♾️”。
 * - full：刚刚想再放一颗但已经用完，托盘描红一下（瞬时，没有过渡）。
 */
export default function MagnetTray({ vote_limit, used, full }: {
  vote_limit: number
  used: number
  full: boolean
}) {
  const unlimited = vote_limit === 0
  const remaining = unlimited ? Infinity : Math.max(0, vote_limit - used)
  const label = unlimited ? '磁粒不限，每张相片可以放一颗' : `还剩 ${remaining} 颗磁粒，共 ${vote_limit} 颗`

  let content
  if (unlimited) {
    content = <><Magnet /><span className={styles.times}>×</span><span className={styles.count}>♾️</span></>
  } else if (vote_limit > MAX_DRAWN) {
    content = <><Magnet /><span className={styles.times}>×</span><span className={styles.count}>{remaining}</span></>
  } else {
    content = Array.from({ length: vote_limit }, (_, index) => (
      index < remaining ? <Magnet key={index} /> : <MagnetSlot key={index} />
    ))
  }

  return createPortal(
    <div className={styles.tray} data-full={full || undefined} role='status' aria-live='polite' aria-label={label} title={label}>
      {content}
    </div>,
    document.body,
  )
}
