import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { Magnet } from 'components/Magnet'
import { MAGNET_SIZE } from './FallingMagnet'

type Point = { x: number; y: number }

export type MagnetPickup = {
  key: string
  photo_id: number
  /** 卡片右下角磁粒的中心，视口坐标 */
  from: Point
  /** 磁粒要放回托盘（HUD）的哪一格的中心，视口坐标 */
  to: Point
}

/** 🤏 的字号，与贴纸胶带的 🤚 一致 */
const HAND_SIZE = 28
/**
 * 🤏 的指尖相对字形中心的位置：捏合处在字形的左上方。
 * 把这个点对准磁粒中心，看起来就是用拇指和食指捏着它。
 */
const PINCH_OFFSET = { x: -6, y: -8 }

/** 🤏 在磁粒旁边就近出现：右下方这么远的地方淡入，再凑过去 */
const APPROACH_FROM = { x: 16, y: 18 }
const APPEAR_MS = 140
const APPROACH_MS = 180
const PINCH_MS = 160
const HOLD_MS = 120
const RELEASE_MS = 100
const LEAVE_MS = 180

/** 飞一段的时长：按距离算，越远越久 */
function travelMs(distance: number): number {
  return Math.round(Math.min(560, Math.max(280, 220 + distance * 0.32)))
}

/**
 * 收回磁粒：🤏 在磁粒旁边就近出现，凑上去捏住，带着磁粒飞回托盘那一格，放下，然后离开。
 *
 *   出现   140ms  🤏 在磁粒右下方 16px / 18px 处淡入
 *   凑近   180ms  移到磁粒上（ease-out）
 *   捏住   160ms  🤏 收紧（缩到 0.86），磁粒被捏得略扁
 *   停一下 120ms
 *   带回   280–560ms（按距离）  🤏 和磁粒一起沿弧线飞回托盘那一格（磁粒放大到 1.12、影子拉远，像被提起来）
 *   放下   100ms  磁粒落进托盘（onArrive：此刻才真正收回这一票，托盘那一格换成磁粒），🤏 张开
 *   离开   180ms  🤏 上移 + 淡出
 *
 * `position: fixed`，不参与布局；磁粒从一开始就盖在卡片那颗磁粒上（卡片上那一格已经是空位），看不出接缝。
 */
export function PinchMagnet({ pickup, onArrive, onDone }: {
  pickup: MagnetPickup
  onArrive(): void
  onDone(): void
}) {
  const hand = useRef<HTMLSpanElement>(null)
  const magnet = useRef<HTMLSpanElement>(null)
  const arrive = useRef(onArrive)
  const done = useRef(onDone)
  useLayoutEffect(() => {
    arrive.current = onArrive
    done.current = onDone
  })

  const { key, from, to } = pickup

  useLayoutEffect(() => {
    const hand_node = hand.current
    const magnet_node = magnet.current
    if (hand_node === null || magnet_node === null) {
      return
    }
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const travel = travelMs(distance)
    const fly_out_end = APPEAR_MS + APPROACH_MS
    const pinch_end = fly_out_end + PINCH_MS
    const hold_end = pinch_end + HOLD_MS
    const carry_end = hold_end + travel
    const release_end = carry_end + RELEASE_MS
    const total = release_end + LEAVE_MS
    const t = (ms: number) => ms / total

    // 带回去走一道弧线：中点比两端中较高的那个再高一截
    const lift = Math.min(70, 28 + distance * 0.1)
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift }
    const near = { x: from.x + APPROACH_FROM.x, y: from.y + APPROACH_FROM.y }

    // 🤏 的位置 = 它捏着的那一点 - 指尖偏移
    const at = (p: Point, dy = 0) => `translate3d(${p.x - PINCH_OFFSET.x}px, ${p.y - PINCH_OFFSET.y + dy}px, 0)`
    const hand_anim = hand_node.animate([
      { offset: 0, transform: `${at(near)} scale(1)`, opacity: 0, easing: 'ease-out' },
      { offset: t(APPEAR_MS), transform: `${at(near)} scale(1)`, opacity: 1, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' },
      { offset: t(fly_out_end), transform: `${at(from)} scale(1)`, opacity: 1, easing: 'ease-in' },
      { offset: t(pinch_end), transform: `${at(from)} scale(0.86)`, opacity: 1 },
      { offset: t(hold_end), transform: `${at(from)} scale(0.86)`, opacity: 1, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' },
      { offset: t(hold_end + travel / 2), transform: `${at(mid)} scale(0.86)`, opacity: 1, easing: 'cubic-bezier(0.4, 0, 0.7, 1)' },
      { offset: t(carry_end), transform: `${at(to)} scale(0.86)`, opacity: 1, easing: 'ease-out' },
      { offset: t(release_end), transform: `${at(to)} scale(1)`, opacity: 1, easing: 'ease-in' },
      { offset: 1, transform: `${at(to, -18)} scale(1)`, opacity: 0 },
    ], { duration: total, fill: 'forwards' })

    const center = (p: Point) => `translate3d(${p.x - MAGNET_SIZE / 2}px, ${p.y - MAGNET_SIZE / 2}px, 0)`
    const lifted = 'drop-shadow(3px 8px 5px rgb(20 30 40 / 0.3))'
    const resting = 'drop-shadow(0 0 0 rgb(20 30 40 / 0))'
    const magnet_anim = magnet_node.animate([
      { offset: 0, transform: `${center(from)} scale(1)`, filter: resting, opacity: 1 },
      { offset: t(fly_out_end), transform: `${center(from)} scale(1)`, filter: resting, opacity: 1 },
      { offset: t(pinch_end), transform: `${center(from)} scale(0.94, 0.9)`, filter: resting, opacity: 1 },
      { offset: t(hold_end), transform: `${center(from)} scale(1.12)`, filter: lifted, opacity: 1, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' },
      { offset: t(hold_end + travel / 2), transform: `${center(mid)} scale(1.12)`, filter: lifted, opacity: 1, easing: 'cubic-bezier(0.4, 0, 0.7, 1)' },
      { offset: t(carry_end), transform: `${center(to)} scale(1.12)`, filter: lifted, opacity: 1, easing: 'ease-in' },
      { offset: t(release_end), transform: `${center(to)} scale(1)`, filter: resting, opacity: 1 },
      { offset: 1, transform: `${center(to)} scale(1)`, filter: resting, opacity: 1 },
    ], { duration: total, fill: 'forwards' })

    const arrive_timer = setTimeout(() => {
      // 托盘那一格这一刻换成真正的磁粒；飞着的这颗随即藏掉，看不出接缝
      arrive.current()
      magnet_node.style.visibility = 'hidden'
    }, release_end)
    hand_anim.onfinish = () => done.current()
    return () => {
      clearTimeout(arrive_timer)
      hand_anim.cancel()
      magnet_anim.cancel()
      magnet_node.style.visibility = ''
    }
  }, [key, from, to])

  const layer: CSSProperties = {
    position: 'fixed',
    left: 0,
    top: 0,
    pointerEvents: 'none',
    willChange: 'transform, opacity',
  }

  return createPortal(
    <>
      <span
        ref={magnet}
        aria-hidden
        style={{
          ...layer,
          zIndex: 1000,
          width: `${MAGNET_SIZE}px`,
          height: `${MAGNET_SIZE}px`,
          '--magnet-size': `${MAGNET_SIZE}px`,
          transform: `translate3d(${from.x - MAGNET_SIZE / 2}px, ${from.y - MAGNET_SIZE / 2}px, 0)`,
        } as CSSProperties}
      >
        <Magnet />
      </span>
      <span
        ref={hand}
        aria-hidden
        style={{
          ...layer,
          zIndex: 1001,
          display: 'block',
          width: `${HAND_SIZE * 1.25}px`,
          height: `${HAND_SIZE * 1.25}px`,
          marginLeft: `${-HAND_SIZE * 0.625}px`,
          marginTop: `${-HAND_SIZE * 0.625}px`,
          fontSize: `${HAND_SIZE}px`,
          lineHeight: `${HAND_SIZE * 1.25}px`,
          textAlign: 'center',
          opacity: 0,
          filter: 'drop-shadow(1px 3px 2px rgb(0 0 0 / 0.25))',
        }}
      >
        🤏
      </span>
    </>,
    document.body,
  )
}
