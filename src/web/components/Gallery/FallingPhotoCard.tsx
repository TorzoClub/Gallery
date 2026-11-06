import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import PhotoCard, { type Props as PhotoCardProps } from 'components/PhotoCard'

/** 撕下纸胶带那一刻，卡片在屏幕上的位置：未变换的布局尺寸 + 外接框中心 + 倾角 */
export type FallingFrom = {
  /** 未旋转的卡片宽高 */
  width: number
  height: number
  /** 卡片中心在视口里的坐标 */
  center_x: number
  center_y: number
  rotate: number
}

export type FallingCard = {
  key: string
  from: FallingFrom
  /**
   * 复印出来的那张：先从原件上“揭”下来（朝屏幕抬起、错开一点、比原件亮一点），再掉下去。
   * 原件留在墙上，所以这一揭就是“多出来一张”。
   */
  peel?: boolean
  card: Omit<PhotoCardProps, 'width' | 'tilt' | 'tape' | 'tapeLoose' | 'anchor' | 'onClickCover'>
}

/**
 * 下落：干净利落地直直掉下去，不摆、不翻。
 * 一段 ease-in（像重力，越掉越快），顺着撕下时的倾角再多转 6°，掉出视口底边。
 */
function fallKeyframes(from: FallingFrom, distance: number): Keyframe[] {
  const r = from.rotate
  const s = r >= 0 ? 1 : -1
  return [
    { offset: 0, easing: 'cubic-bezier(0.55, 0, 0.85, 0.35)', transform: `perspective(800px) translate3d(0, 0, 0) rotate(${r}deg)` },
    { offset: 1, transform: `perspective(800px) translate3d(0, ${Math.round(distance)}px, 0) rotate(${r + s * 6}deg)` },
  ]
}

/** 复印件从原件上揭起来的时长（Gallery 时间线里的 380–640ms） */
export const PEEL_MS = 260

/** 揭起来之后停在原件前面的样子：朝屏幕抬 30px，往右下错开一点，刚印出来的纸更亮 */
const PEEL_LIFT = { x: 3, y: 4, z: 30 }

/** 把“揭起来”拼在下落前面：下落的每一帧都叠上揭起后的位移，并按总时长重排 offset */
function peelKeyframes(from: FallingFrom, fall: Keyframe[], fall_ms: number): Keyframe[] {
  const total = PEEL_MS + fall_ms
  const peel_end = PEEL_MS / total
  const r = from.rotate
  const lifted = (rest: string) => `perspective(800px) translate3d(${PEEL_LIFT.x}px, ${PEEL_LIFT.y}px, ${PEEL_LIFT.z}px) ${rest}`
  return [
    { offset: 0, easing: 'cubic-bezier(0.3, 0.6, 0.3, 1)', transform: `perspective(800px) translate3d(0, 0, 0) rotate(${r}deg)`, filter: 'brightness(1.12)' },
    ...fall.map(frame => ({
      ...frame,
      offset: peel_end + (frame.offset ?? 0) * (1 - peel_end),
      transform: lifted(String(frame.transform).replace('perspective(800px) ', '')),
      filter: 'brightness(1)',
    })),
  ]
}

/** 下落时长：固定 1000ms，不随距离变化 */
export const FALL_MS = 1000

export function FallingPhotoCard({ falling, onDone }: { falling: FallingCard; onDone(): void }) {
  const el = useRef<HTMLDivElement>(null)
  const done = useRef(onDone)
  useLayoutEffect(() => {
    done.current = onDone
  })

  const { from } = falling

  useLayoutEffect(() => {
    const node = el.current
    if (node === null) {
      return
    }
    // 卡片转过之后最高的那个角也要掉出视口底边
    const reach = Math.hypot(from.width, from.height) / 2
    const distance = Math.max(0, window.innerHeight - from.center_y) + reach + 24
    const fall_ms = FALL_MS
    const fall = fallKeyframes(from, distance)
    const animation = falling.peel === true
      ? node.animate(peelKeyframes(from, fall, fall_ms), { duration: PEEL_MS + fall_ms, fill: 'forwards' })
      : node.animate(fall, { duration: fall_ms, fill: 'forwards' })
    animation.onfinish = () => done.current()
    return () => animation.cancel()
  }, [falling.peel, from])

  return createPortal(
    <div
      ref={el}
      className="photo-card-falling"
      aria-hidden
      style={{
        left: `${from.center_x - from.width / 2}px`,
        top: `${from.center_y - from.height / 2}px`,
        width: `${from.width}px`,
        transform: `rotate(${from.rotate}deg)`,
      }}
    >
      <PhotoCard {...falling.card} width={from.width} anchor={false} tape={false} />
    </div>,
    document.body,
  )
}
