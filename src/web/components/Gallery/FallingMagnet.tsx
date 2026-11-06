import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { Magnet } from 'components/Magnet'

type Point = { x: number; y: number }

export type MagnetDrop = {
  key: string
  photo_id: number
  /** 落点：卡片右下角磁粒位的中心，视口坐标 */
  to: Point
  /**
   * 起点：托盘（HUD）里那颗磁粒的中心，视口坐标。
   * 有起点就从托盘飞过去；没有（不限票数的“磁粒 × ♾️”、找不到托盘）就从天而降。
   */
  from?: Point
}

/** 磁粒直径（与 PhotoCard 的 .photo-card-vote、MagnetTray 的 --magnet-size 一致） */
export const MAGNET_SIZE = 32

/** 从天而降：从磁粒位正上方多高处落下、用多久 */
const DROP_FROM = 88
const DROP_MS = 300
/** 从天而降时磕到纸面的那一刻（占整段的比例），也是“ta～”该响的时候 */
const DROP_IMPACT_AT = 0.78

/** 从托盘飞过去：时长按距离算，越远越久 */
function flightDuration(distance: number): number {
  return Math.round(Math.min(720, Math.max(380, 300 + distance * 0.4)))
}
/** 落到纸面后压扁、回圆、淡出的那一下 */
const SETTLE_MS = 120

/**
 * 一颗在空中的磁粒：`position: fixed` 盖在最上面，不参与任何布局。
 * 落定后自己淡出，下面磁粒位已经换成真正的那颗，看不出接缝。
 *
 * 从天而降（不限票数）：
 *   0–70%   一边加速一边落下，同时从略小长到原大
 *   70–85%  磕在纸上：横向摊开一点、竖向压扁（此刻“ta～”）
 *   85–100% 回到正圆，同时淡出
 *
 * 从托盘飞过去：
 *   横向一段 ease-in-out；竖向先往上抛到高出起点和终点的顶点（ease-out），再落到磁粒位（ease-in），
 *   两者叠起来是一道抛物线。飞行途中放大到 1.18 倍、影子拉远，像被拿起来；
 *   到达那一刻“ta～”，然后 120ms 压扁、回圆、淡出。
 */
export function FallingMagnet({ drop, onImpact, onLand }: {
  drop: MagnetDrop
  onImpact(): void
  onLand(): void
}) {
  const outer = useRef<HTMLSpanElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  const body = useRef<HTMLSpanElement>(null)
  const impact = useRef(onImpact)
  const land = useRef(onLand)
  useLayoutEffect(() => {
    impact.current = onImpact
    land.current = onLand
  })

  const { key, to, from } = drop

  useLayoutEffect(() => {
    const x_node = outer.current
    const y_node = inner.current
    const body_node = body.current
    if (x_node === null || y_node === null || body_node === null) {
      return
    }

    if (from === undefined) {
      const animation = body_node.animate([
        { offset: 0, transform: `translate3d(0, ${-DROP_FROM}px, 0) scale(0.86)`, opacity: 0, easing: 'cubic-bezier(0.45, 0, 0.9, 0.6)' },
        { offset: 0.12, opacity: 1, transform: `translate3d(0, ${-DROP_FROM * 0.93}px, 0) scale(0.94)`, easing: 'cubic-bezier(0.5, 0, 0.95, 0.55)' },
        { offset: 0.7, opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)', easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' },
        { offset: 0.85, opacity: 1, transform: 'translate3d(0, 0, 0) scale(1.1, 0.86)' },
        { offset: 1, opacity: 0, transform: 'translate3d(0, 0, 0) scale(1)' },
      ], { duration: DROP_MS, fill: 'forwards' })
      animation.onfinish = () => land.current()
      const timer = setTimeout(() => impact.current(), DROP_MS * DROP_IMPACT_AT)
      return () => {
        clearTimeout(timer)
        animation.cancel()
      }
    }

    // 元素摆在落点；起点用反向位移表示
    const dx = from.x - to.x
    const dy = from.y - to.y
    const distance = Math.hypot(dx, dy)
    const flight = flightDuration(distance)
    // 抛物线顶点：比起点和终点中较高的那个再高一截
    const lift = Math.min(90, 36 + distance * 0.12)
    const apex = Math.min(dy, 0) - lift
    // 顶点出现的时刻：往上走的路程占全程竖向路程的比例
    const up = dy - apex
    const down = -apex
    const apex_at = up / (up + down)
    const total = flight + SETTLE_MS
    const t = (ms: number) => ms / total

    const x_anim = x_node.animate([
      { offset: 0, transform: `translate3d(${dx}px, 0, 0)`, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
      { offset: t(flight), transform: 'translate3d(0, 0, 0)' },
      { offset: 1, transform: 'translate3d(0, 0, 0)' },
    ], { duration: total, fill: 'forwards' })
    const y_anim = y_node.animate([
      { offset: 0, transform: `translate3d(0, ${dy}px, 0)`, easing: 'cubic-bezier(0.2, 0.6, 0.45, 1)' },
      { offset: t(flight * apex_at), transform: `translate3d(0, ${apex}px, 0)`, easing: 'cubic-bezier(0.55, 0, 0.8, 0.4)' },
      { offset: t(flight), transform: 'translate3d(0, 0, 0)' },
      { offset: 1, transform: 'translate3d(0, 0, 0)' },
    ], { duration: total, fill: 'forwards' })
    const lifted = 'drop-shadow(3px 8px 5px rgb(20 30 40 / 0.3))'
    const resting = 'drop-shadow(0 0 0 rgb(20 30 40 / 0))'
    const body_anim = body_node.animate([
      { offset: 0, transform: 'scale(1)', filter: resting, opacity: 1, easing: 'ease-out' },
      { offset: t(flight * 0.35), transform: 'scale(1.18)', filter: lifted, opacity: 1, easing: 'ease-in' },
      { offset: t(flight), transform: 'scale(1)', filter: resting, opacity: 1, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' },
      { offset: t(flight + SETTLE_MS * 0.4), transform: 'scale(1.1, 0.86)', filter: resting, opacity: 1 },
      { offset: 1, transform: 'scale(1)', filter: resting, opacity: 0 },
    ], { duration: total, fill: 'forwards' })
    body_anim.onfinish = () => land.current()
    const timer = setTimeout(() => impact.current(), flight)
    return () => {
      clearTimeout(timer)
      x_anim.cancel()
      y_anim.cancel()
      body_anim.cancel()
    }
  }, [key, to, from])

  return createPortal(
    <span
      ref={outer}
      aria-hidden
      style={{
        position: 'fixed',
        left: `${to.x - MAGNET_SIZE / 2}px`,
        top: `${to.y - MAGNET_SIZE / 2}px`,
        zIndex: 1000,
        width: `${MAGNET_SIZE}px`,
        height: `${MAGNET_SIZE}px`,
        pointerEvents: 'none',
        willChange: 'transform',
        '--magnet-size': `${MAGNET_SIZE}px`,
      } as CSSProperties}
    >
      <span ref={inner} style={{ display: 'block', willChange: 'transform' }}>
        <span ref={body} style={{ display: 'block', willChange: 'transform, opacity, filter' }}>
          <Magnet />
        </span>
      </span>
    </span>,
    document.body,
  )
}
