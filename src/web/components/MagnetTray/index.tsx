import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Magnet, MagnetSlot } from 'components/Magnet'
import styles from './index.module.scss'

/** 托盘里的磁粒与相片上的一样大（与 index.module.scss 一致） */
const SIZE = 32
const GAP = 10
const PADDING_X = 14
/** 托盘两侧离屏幕边缘至少留多少 */
const SCREEN_MARGIN = 15
/** 再宽的屏幕也最多画这么多颗，超过就改成“磁粒 × 剩余” */
const MAX_DRAWN = 10

/** 这块屏幕一排能画下几颗：手机上 32px 的磁粒画不下 10 颗 */
function fitCount(viewport_width: number): number {
  const room = viewport_width - SCREEN_MARGIN * 2 - PADDING_X * 2 + GAP
  return Math.max(1, Math.min(MAX_DRAWN, Math.floor(room / (SIZE + GAP))))
}

function useFitCount(): number {
  const [fit, setFit] = useState(() => (typeof window === 'undefined' ? MAX_DRAWN : fitCount(window.innerWidth)))
  useEffect(() => {
    const update = () => setFit(fitCount(window.innerWidth))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return fit
}

/**
 * 托盘的三种样子，Gallery 据此决定放磁粒时磁粒从哪来（见 Gallery 的 magnetSource）：
 * - drawn：一颗颗画出来，第 N 颗带 data-tray-slot="N"，磁粒从刚空出来的那一格飞过去
 * - count：“磁粒 × 剩余”，那一颗带 data-tray-magnet，磁粒从它那里飞过去
 * - unlimited：“磁粒 × ♾️”，放磁粒时从天而降；🤏 收回时放回那一颗（data-tray-magnet）
 */
export type MagnetTrayMode = 'drawn' | 'count' | 'unlimited'

/**
 * 屏幕底部居中的磁粒托盘（HUD）：登录成员手里还没放出去的票。
 * - vote_limit > 0：一共 vote_limit 颗，放出去的位置留下虚线空位；一排画不下时显示“磁粒 × 剩余”。
 * - vote_limit = 0（不限票数）：显示“磁粒 × ♾️”。
 * - full：刚刚想再放一颗但已经用完，托盘描红一下（瞬时，没有过渡）。
 */
export default function MagnetTray({ vote_limit, used, full }: {
  vote_limit: number
  used: number
  full: boolean
}) {
  const fit = useFitCount()
  const unlimited = vote_limit === 0
  const remaining = unlimited ? Infinity : Math.max(0, vote_limit - used)
  const label = unlimited ? '磁粒不限，每张相片可以放一颗' : `还剩 ${remaining} 颗磁粒，共 ${vote_limit} 颗`
  const mode: MagnetTrayMode = unlimited ? 'unlimited' : (vote_limit > fit ? 'count' : 'drawn')

  let content
  if (mode === 'unlimited') {
    content = <><span data-tray-magnet=''><Magnet /></span><span className={styles.times}>×</span><span className={styles.count}>♾️</span></>
  } else if (mode === 'count') {
    content = <><span data-tray-magnet=''><Magnet /></span><span className={styles.times}>×</span><span className={styles.count}>{remaining}</span></>
  } else {
    content = Array.from({ length: vote_limit }, (_, index) => (
      <span key={index} data-tray-slot={index}>
        {index < remaining ? <Magnet /> : <MagnetSlot />}
      </span>
    ))
  }

  return createPortal(
    <div
      className={styles.tray}
      data-magnet-tray={mode}
      data-full={full || undefined}
      role='status'
      aria-live='polite'
      aria-label={label}
      title={label}
    >
      {content}
    </div>,
    document.body,
  )
}
