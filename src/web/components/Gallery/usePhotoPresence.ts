import { useEffect, useState } from 'react'
import { WATERFALL_SHIFT_MS } from 'components/Waterfall'

/*
 * 相片的出场 / 入场，由数据变化驱动（SSE 推来的、或任何别的途径改了列表都一样）：
 * 拿这一次的相片列表和上一次比，多出来的贴上来，少掉的撕下去。第一次拿到列表（以及 enabled 从关到开）只记下来，不播。
 *
 * 贴上来（与 index.scss 的 .photo-card-entering 一致）：
 *   某列往下挪 WATERFALL_SHIFT_MS → 停顿 300ms → 相片落下、压平 900ms → 贴纸胶带（含手抹）TAPE_DONE_MS
 * 撕下去（与 index.scss 的 .photo-card-leaving 一致）：
 *   0–180ms       纸胶带从左端撕起、消失
 *   180–562ms     停 382ms
 *   562–882ms     相片自身下移 24px、淡出
 *   882–1264ms    停 382ms（这一格空着，位置还占着）
 *   1264ms 起     从列表里拿掉，同一列下面的相片往上顶（top 过渡 WATERFALL_SHIFT_MS）
 */
const TAPE_STICK_MS = 380
const HAND_HOLD_MS = 382
const HAND_IN_MS = 220
const HAND_SWEEP_MS = 560
const HAND_OUT_MS = 220
/** 从开始贴胶带到放手 */
export const TAPE_DONE_MS = TAPE_STICK_MS + HAND_HOLD_MS + HAND_IN_MS + HAND_HOLD_MS + HAND_SWEEP_MS + HAND_HOLD_MS + HAND_OUT_MS

const ENTER_PAUSE_MS = 300
const ENTER_CARD_MS = 900
export const ENTER_TOTAL_MS = WATERFALL_SHIFT_MS + ENTER_PAUSE_MS + ENTER_CARD_MS + TAPE_DONE_MS

const LEAVE_TEAR_MS = 180
const LEAVE_HOLD_MS = 382
const LEAVE_OUT_MS = 320
const LEAVE_SETTLE_MS = 382
export const LEAVE_TOTAL_MS = LEAVE_TEAR_MS + LEAVE_HOLD_MS + LEAVE_OUT_MS + LEAVE_SETTLE_MS

type Identified = { id: number }

type Tracked<T extends Identified> = {
  enabled: boolean
  /** 上一次看到的真实列表（不含正在撕下去的） */
  base: readonly T[]
  entering: ReadonlySet<string>
  /** 正在撕下去的相片：留着最后一次的数据和它在列表里的位置，好在原地播完 */
  leaving: ReadonlyMap<string, { photo: T; index: number }>
}

const NO_IDS: ReadonlySet<string> = new Set()

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function diff<T extends Identified>(prev: Tracked<T>, photos: readonly T[]): Tracked<T> {
  const next_ids = new Set(photos.map(photo => String(photo.id)))
  const prev_ids = new Set(prev.base.map(photo => String(photo.id)))

  const entering = new Set<string>()
  for (const id of prev.entering) {
    if (next_ids.has(id)) {
      entering.add(id)
    }
  }
  for (const id of next_ids) {
    if (!prev_ids.has(id)) {
      entering.add(id)
    }
  }

  const leaving = new Map<string, { photo: T; index: number }>()
  for (const [id, item] of prev.leaving) {
    // 撕到一半又回来了：当它是新贴上来的
    if (!next_ids.has(id)) {
      leaving.set(id, item)
    }
  }
  prev.base.forEach((photo, index) => {
    const id = String(photo.id)
    if (!next_ids.has(id)) {
      leaving.set(id, { photo, index })
    }
  })

  return {
    enabled: prev.enabled,
    base: photos,
    // 内容没变就沿用原来的集合：投票等无关更新不会把计时器重启
    entering: sameKeys(entering, prev.entering) ? prev.entering : entering,
    leaving: sameKeys(new Set(leaving.keys()), new Set(prev.leaving.keys())) ? prev.leaving : leaving,
  }
}

function sameKeys(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const key of a) {
    if (!b.has(key)) {
      return false
    }
  }
  return true
}

/**
 * @param photos  当前真实的相片列表（顺序就是要展示的顺序）
 * @param enabled 列表是否正在显示。关着的时候不记差异；打开的那一刻只记下来，不把已有的相片当成新贴上来的
 * @returns list      要交给瀑布流的列表：真实列表 + 原位插回去的、正在撕下去的相片
 *          entering  正在贴上来的 id
 *          leaving   正在撕下去的 id
 *          shifting  瀑布流的 top 这段时间要带过渡（有相片贴上来或刚被拿掉）
 */
export function usePhotoPresence<T extends Identified>(photos: readonly T[], enabled = true) {
  const [tracked, setTracked] = useState<Tracked<T>>(() => ({
    enabled,
    base: photos,
    entering: NO_IDS,
    leaving: new Map(),
  }))
  const [settling, setSettling] = useState(false)

  // 在渲染里同步算出差异（而不是放进 effect）：新相片第一次交给瀑布流时就已经标成“贴上来”，才会插到最矮那列的顶部
  let current = tracked
  if (enabled !== tracked.enabled) {
    current = { enabled, base: photos, entering: NO_IDS, leaving: new Map() }
    setTracked(current)
  } else if (enabled && photos !== tracked.base) {
    current = prefersReducedMotion()
      ? { ...tracked, base: photos, entering: NO_IDS, leaving: new Map() }
      : diff(tracked, photos)
    setTracked(current)
  } else if (!enabled && photos !== tracked.base) {
    current = { ...tracked, base: photos }
    setTracked(current)
  }

  const { entering, leaving } = current

  useEffect(() => {
    if (entering.size === 0) {
      return
    }
    const handler = setTimeout(() => {
      setTracked(cur => (cur.entering === entering ? { ...cur, entering: NO_IDS } : cur))
    }, ENTER_TOTAL_MS + 120)
    return () => clearTimeout(handler)
  }, [entering])

  useEffect(() => {
    if (leaving.size === 0) {
      return
    }
    const handler = setTimeout(() => {
      setTracked(cur => (cur.leaving === leaving ? { ...cur, leaving: new Map() } : cur))
      setSettling(true)
    }, LEAVE_TOTAL_MS)
    return () => clearTimeout(handler)
  }, [leaving])

  useEffect(() => {
    if (!settling) {
      return
    }
    const handler = setTimeout(() => setSettling(false), WATERFALL_SHIFT_MS + 60)
    return () => clearTimeout(handler)
  }, [settling])

  let list: readonly T[] = current.base
  if (leaving.size > 0) {
    const merged = [...current.base]
    const ghosts = [...leaving.values()].sort((a, b) => a.index - b.index)
    for (const ghost of ghosts) {
      merged.splice(Math.min(ghost.index, merged.length), 0, ghost.photo)
    }
    list = merged
  }

  return {
    list,
    entering,
    leaving: leaving as ReadonlyMap<string, unknown>,
    shifting: entering.size > 0 || settling,
  }
}
