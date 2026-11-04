import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './index.scss'

import Title from 'components/Title'
import Waterfall, { WATERFALL_SHIFT_MS, WaterfallLayout } from 'components/Waterfall'
import type { GalleryView, PhotoView } from 'pool/view'
import PhotoCard, { getPhotoCardScatter, type CoverClickEvent, type PhotoCardScatter } from 'components/PhotoCard'
import Submission, { _EVENT_ as SUBMISSION_EVENT } from 'components/Submission'
import useSafeState from 'hooks/useSafeState'
import { dateDiffInDays } from 'utils/date'
import TextPlaceholder from './TextPlaceholder'
import { FallingPhotoCard, type FallingCard } from './FallingPhotoCard'
import { pickSaveFile, writeSaveFile } from 'utils/save-file'

export type GalleryLayout = WaterfallLayout & {
  /** ≤ 900px 的紧凑布局：PhotoCard 散落得更小、更浅 */
  tight: boolean
}

function getViewportWidth() {
  const { innerWidth } = window
  return innerWidth
}

/** 宽屏列间距：给倾斜和横向位移留出余地（两列各占一半） */
const WIDE_GUTTER = 32
/** ≤ 900px 的列间距 */
const TIGHT_GUTTER = 20

const fixedLayout = ({
  column_count,
  gallery_width,
  column_gutter,
  tight,
}: Pick<GalleryLayout, 'column_count' | 'gallery_width' | 'column_gutter' | 'tight'>): GalleryLayout => ({
  tight,
  column_count,
  gallery_width,
  column_gutter,
  vertical_gutter: tight ? TIGHT_GUTTER : 27,
})

function computeColumnCountByBoxWidth(
  gallery_width: number,
  box_width: number,
  column_gutter: number,
  count = 0
) {
  const column_gutter_total = (count - 1) * column_gutter
  if (gallery_width < (box_width + column_gutter_total)) {
    return count
  } else {
    return computeColumnCountByBoxWidth(
      gallery_width - box_width,
      box_width,
      column_gutter,
      count + 1
    )
  }
}

function computeGalleryWidthWithAutoColumnCount(
  max_gallery_width: number,
  column_gutter: number,
  box_width: number,
) {
  const column_count = computeColumnCountByBoxWidth(
    max_gallery_width,
    box_width,
    column_gutter,
  )
  return {
    gallery_width: (box_width * column_count) + ((column_count - 1) * column_gutter),
    column_count
  } as const
}

const getLayoutConfigure = (): GalleryLayout => {
  const viewport_width = getViewportWidth()
  if (viewport_width > 1900) {
    const box_width = 232
    const column_gutter = 27
    const padding_horizontal = 54
    return fixedLayout({
      tight: false,
      column_gutter,
      ...computeGalleryWidthWithAutoColumnCount(
        viewport_width - (2 * padding_horizontal),
        column_gutter,
        box_width,
      ),
    })
  } else if (viewport_width > 1450) {
    return fixedLayout({ tight: false, gallery_width: 1200, column_count: 4, column_gutter: WIDE_GUTTER })
  } else if (viewport_width > 1150) {
    return fixedLayout({ tight: false, gallery_width: 900, column_count: 4, column_gutter: WIDE_GUTTER })
  } else if (viewport_width > 900) {
    return fixedLayout({ tight: false, gallery_width: 750, column_count: 3, column_gutter: WIDE_GUTTER })
  } else if (viewport_width > 640) {
    return fixedLayout({ tight: true, gallery_width: 640 - TIGHT_GUTTER * 2, column_count: 3, column_gutter: TIGHT_GUTTER })
  } else {
    return fixedLayout({
      tight: true,
      gallery_width: viewport_width - TIGHT_GUTTER * 2,
      column_count: 2,
      column_gutter: TIGHT_GUTTER,
    })
  }
}

export function getGalleryLayout(): GalleryLayout {
  return getLayoutConfigure()
}

export function galleryColumnWidth(layout: GalleryLayout): number {
  return (layout.gallery_width - layout.column_gutter * (layout.column_count - 1)) / layout.column_count
}

/** 瀑布流的一格：上下留白容纳纸胶带、倾斜多出来的高度和纵向错落；卡片在格子里居中，再由自身 transform 偏移、倾斜 */
export function PhotoCardCell({ scatter, photoId, children }: { scatter: PhotoCardScatter; photoId?: number; children: React.ReactNode }) {
  return (
    <div
      className="photo-card-cell"
      data-photo-id={photoId}
      style={{
        display: 'flex',
        justifyContent: 'center',
        paddingTop: `${scatter.pad_top}px`,
        paddingBottom: `${scatter.pad_bottom}px`,
      }}
    >
      {children}
    </div>
  )
}

export function scatterFor(layout: GalleryLayout, photo: {
  id: number
  width: number
  height: number
  desc: string
  member: unknown
}): PhotoCardScatter {
  return getPhotoCardScatter({
    id: photo.id,
    column_width: galleryColumnWidth(layout),
    column_gutter: layout.column_gutter,
    photo,
    desc_length: photo.desc.trim().length,
    has_member: Boolean(photo.member),
    tight: layout.tight,
  })
}

/*
 * 贴纸胶带（新投稿、复印后贴回、取消保存后贴回都一样，与 index.scss 的 $enter-tape / $hand-* 一致）：
 *   0–380ms       纸胶带从上方落下、贴平
 *   380–762ms     贴好后停 382ms
 *   762–982ms     🤚 出现在胶带左端：上移、淡入
 *   982–1364ms    手按着停 382ms
 *   1364–1924ms   手从左端划到右端，把胶带抹平
 *   1924–2306ms   手按着停 382ms
 *   2306–2526ms   放手：下移、淡出
 */
const TAPE_STICK_MS = 380
const HAND_HOLD_MS = 382
/** 胶带贴好、再停 382ms，手才出现 */
const HAND_AT_MS = TAPE_STICK_MS + HAND_HOLD_MS
const HAND_IN_MS = 220
const HAND_SWEEP_MS = 560
const HAND_OUT_MS = 220
/** 从开始贴胶带到放手 */
const TAPE_DONE_MS = HAND_AT_MS + HAND_IN_MS + HAND_HOLD_MS + HAND_SWEEP_MS + HAND_HOLD_MS + HAND_OUT_MS

/**
 * 新投稿贴上瀑布流的时间线（与 index.scss 的 .photo-card-entering 一致）：
 * 某列往下挪 WATERFALL_SHIFT_MS → 停顿 300ms → 相片落下、压平 900ms → 贴纸胶带（含手抹）TAPE_DONE_MS
 */
const ENTER_PAUSE_MS = 300
const ENTER_CARD_MS = 900
const ENTER_TOTAL_MS = WATERFALL_SHIFT_MS + ENTER_PAUSE_MS + ENTER_CARD_MS + TAPE_DONE_MS

const NO_ENTERING: ReadonlySet<string> = new Set()

/** 刚投稿成功的相片：在它出现在 gallery.photos 里时播放入场，播完后清掉 */
function useEnteringPhotos(): ReadonlySet<string> {
  const [entering, setEntering] = useState<ReadonlySet<string>>(NO_ENTERING)

  useEffect(() => SUBMISSION_EVENT.created.receive((photo) => {
    setEntering(new Set([String(photo.id)]))
  }), [])

  useEffect(() => {
    if (entering.size === 0) {
      return
    }
    const handler = setTimeout(() => setEntering(NO_ENTERING), ENTER_TOTAL_MS + 120)
    return () => clearTimeout(handler)
  }, [entering])

  return entering
}

const NO_FALLEN: ReadonlySet<number> = new Set()

/*
 * 撕纸胶带的时间线（与 index.scss 的 $tear-* / $copy-* 一致）。每一截纸胶带都能撕，松动的那截只是吸引注意。
 *
 * 撕开（点胶带，同一次点击里弹出系统的“存储为”对话框）：
 *   0–200ms       相片上放着自己的磁粒时，先把磁粒取下来、悬在原处上方（没有磁粒就跳过这一段）
 *   +0–180ms      纸胶带从粘着的左端被撕起、消失
 *   然后          停在撕开的样子，等对话框的结果
 *
 * 点“存储”（Chrome / Edge 等能拿到结果；Safari / Firefox 拿不到，点胶带时直接下载，撕开后直接走这一段）：
 *   没有磁粒      原件 1000ms 直直掉下去，原来的格子空着
 *   有磁粒        复印一张掉下去，原件和这一票都留着：
 *                   0–380ms      扫描光从上到下扫过卡片
 *                   380–640ms    复印件从原件上揭起来（FallingPhotoCard 的 peel），随后 1000ms 直直掉下去
 *                   720ms 起     贴纸胶带（含手抹，TAPE_DONE_MS）
 *                   放手后       磁粒放回去 220ms
 *
 * 点“取消”：
 *   0ms 起        纸胶带重新贴好（含手抹，TAPE_DONE_MS），贴牢，不再是松动的样子
 *   放手后        有磁粒就把磁粒放回去 220ms
 */
const TEAR_LIFT_MS = 200
const TEAR_MS = 180
const COPY_SPAWN_MS = 380
const COPY_TAPE_AT_MS = 720
const MAGNET_DROP_MS = 220
const COPY_TOTAL_MS = COPY_TAPE_AT_MS + TAPE_DONE_MS + MAGNET_DROP_MS

type TapePhase = 'tearing' | 'asking' | 'copying' | 'resticking'
type TapeState = { phase: TapePhase; with_magnet: boolean }

const NO_TAPES: ReadonlyMap<number, TapeState> = new Map()

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** 瀑布流最上面一排（各列的第一张）：格子的上沿都在同一高度 */
function pickTopRowPhoto(root: HTMLElement | null, excluded: ReadonlySet<string>): number | null {
  if (root === null) {
    return null
  }
  const cells = Array.from(root.querySelectorAll<HTMLElement>('.photo-card-cell[data-photo-id]'))
    .map(el => ({ id: el.dataset.photoId ?? '', top: el.getBoundingClientRect().top }))
    .filter(cell => cell.id !== '' && !excluded.has(cell.id))
  if (cells.length === 0) {
    return null
  }
  const top = Math.min(...cells.map(cell => cell.top))
  const row = cells.filter(cell => cell.top - top < 1)
  return Number(row[Math.floor(Math.random() * row.length)].id)
}

/** 浏览器拿不到系统对话框结果时，点胶带的一瞬间直接下载原图。跨域时 download 属性不生效，改为新标签页打开，免得把当前页面导走 */
function downloadSource(photo: Pick<PhotoView, 'src' | 'src_url'>) {
  const a = document.createElement('a')
  a.href = photo.src_url
  a.download = photo.src
  if (new URL(photo.src_url, window.location.href).origin !== window.location.origin) {
    a.target = '_blank'
    a.rel = 'noopener'
  }
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export type Props = {
  /**
   * 吸引锚：瀑布流第一次排好的那一刻，最上面一排随机一张的纸胶带就是松开的（不计时）。
   * 每一截纸胶带本来就都能撕（撕下保存原图），松动只是提示“这里能点”。一页只给最上面那个 Gallery 开。
   */
  loose_tape?: boolean
  /** 显示登录成员自己放在相片上的磁粒 */
  show_vote_button: boolean
  /** 还能放 / 收回磁粒（投票期、已确认 QQ、尚未提交） */
  vote_interactive?: boolean
  gallery: GalleryView
  selected_id_list: number[]
  onClickVote?: (photo_id: number) => void
  onClickCover: (clickInfo: CoverClickEvent, photo_id: number) => void
  onWatterfallRefreshed(): void
}
export default ({
  loose_tape = false,
  show_vote_button,
  vote_interactive = false,
  gallery,
  selected_id_list,
  onClickVote,
  onClickCover,
  onWatterfallRefreshed,
}: Props) => {
  const layout = useWaterfallLayout()
  const entering_ids = useEnteringPhotos()
  const root = useRef<HTMLDivElement>(null)
  const { tapes, loose_id, fallen, falling, pull, landed, loosen } = useTape(root, loose_tape, gallery.photos.length > 0, entering_ids)

  const title_node = useTitleNode(gallery)

  const handleRefreshed = useCallback(() => {
    loosen()
    onWatterfallRefreshed()
  }, [loosen, onWatterfallRefreshed])

  const waterfall_layout_node = useMemo(() => {
    const day_diff = dateDiffInDays(new Date(gallery.event_start), new Date)
    const items = gallery.photos.map(photo => {
      const scatter = scatterFor(layout, photo)
      const selected = selected_id_list.includes(photo.id)
      const card: FallingCard['card'] = {
        id: photo.id,
        hideMember: !photo.member,
        name: photo.member ? photo.member.name : null,
        desc: photo.desc,
        photo: {
          width: photo.width,
          height: photo.height,
          src: photo.src_url,
          thumb: photo.thumb,
        },
        avatar: photo.member ? {
          width: 0,
          height: 0,
          thumb: photo.member.avatar_thumb_url,
          src: photo.member.avatar_thumb_url,
        } : null,
      }
      const is_fallen = fallen.has(photo.id)
      const busy = tapes.get(photo.id)
      const is_entering = entering_ids.has(String(photo.id))
      const with_magnet = show_vote_button && selected
      const cell_class = is_entering
        ? 'photo-card-entering'
        : busy !== undefined
          ? [`photo-card-${busy.phase}`, busy.with_magnet ? 'with-magnet' : ''].filter(Boolean).join(' ')
          : undefined
      // 贴胶带的时候胶带是普通的一截（在播贴上去的动画），贴好了才又能撕
      const pullable = !is_entering && (busy === undefined || busy.phase === 'tearing' || busy.phase === 'asking')
      return {
        id: String(photo.id),
        node: (
          <PhotoCardCell scatter={scatter} photoId={photo.id}>
            {/* 入场动画放在这层：卡片自身的 transform 是倾斜，从一开始就是斜的。掉下去的相片只隐藏，格子留着 */}
            <div
              className={cell_class}
              style={is_fallen ? { visibility: 'hidden' } : undefined}
            >
            <PhotoCard
              {...card}
              width={scatter.card_width}
              tilt={{ rotate: scatter.rotate, x: scatter.offset_x }}
              tape={{ x: scatter.tape_x, rotate: scatter.tape_rotate }}
              tapeLoose={pullable ? {
                state: busy === undefined ? 'idle' : busy.phase as 'tearing' | 'asking',
                loose: loose_id === photo.id,
                // 磁粒先取下来，掉下去的复印件上没有磁粒
                onPull: () => pull(photo, card, scatter.rotate, with_magnet),
              } : undefined}
              copying={busy?.phase === 'copying'}
              hand={is_entering || busy?.phase === 'copying' || busy?.phase === 'resticking'}
              onClickCover={(click_info) => onClickCover(click_info, photo.id)}
              vote={show_vote_button ? {
                selected,
                // 撕胶带的整个过程里磁粒悬在半空 / 卡片在忙，不能点
                interactive: vote_interactive && busy === undefined,
                onToggle: () => onClickVote?.(photo.id),
              } : undefined}
            />
            </div>
          </PhotoCardCell>
        ),
      }
    })
    const waterfall = () => (
      <Waterfall
        layout={layout}
        items={items}
        enteringIds={entering_ids}
        onWatterfallRefreshed={handleRefreshed}
      />
    )

    if (gallery.in_event) {
      if (gallery.can_submission && (gallery.photos.length === 0)) {
        return <TextPlaceholder>提交你的投稿</TextPlaceholder>
      } else {
        return waterfall()
      }
    } else {
      if (gallery.photos.length === 0) {
        if ((day_diff < 30) && day_diff > 0) {
          return (
            <TextPlaceholder>
              活动将于 { day_diff } 天后开始<br />
            </TextPlaceholder>
          )
        } else {
          return <TextPlaceholder>暂无相片</TextPlaceholder>
        }
      } else {
        return waterfall()
      }
    }
  }, [entering_ids, fallen, loose_id, pull, tapes, gallery.can_submission, gallery.event_start, gallery.in_event, gallery.photos, layout, onClickCover, onClickVote, handleRefreshed, selected_id_list, show_vote_button, vote_interactive])

  return (
    <div className="gallery" ref={root}>
      { title_node }
      { waterfall_layout_node }
      {falling.map(item => (
        <FallingPhotoCard key={item.key} falling={item} onDone={() => landed(item.key)} />
      ))}
    </div>
  )
}

/**
 * 纸胶带：每一截都能点。点下去胶带撕开，同时弹出系统的“存储为”对话框，动画停在撕开的样子等结果（时间线见上面的常量）。
 * - 存储：相片上没有自己的磁粒：原件掉下去，格子不收起，空位就这么空着；
 *   放着自己的磁粒：原件不走，复印一张掉下去，胶带贴回、磁粒放回，这一票原样留着。
 * - 取消：胶带重新贴好。
 * 浏览器没有 showSaveFilePicker（Safari / Firefox）时拿不到对话框的结果：点胶带就直接下载，当作“存储”。
 * 吸引锚（loose_enabled）：瀑布流第一次排好时就挑定最上面一排随机一张，胶带直接是松的（只挑一次）；撕过之后贴回来就是贴牢的。
 * 掉下去的卡片掉出视口后移除。
 */
function useTape(
  root: React.RefObject<HTMLDivElement | null>,
  loose_enabled: boolean,
  has_photos: boolean,
  entering_ids: ReadonlySet<string>,
) {
  const [tapes, setTapes] = useState<ReadonlyMap<number, TapeState>>(NO_TAPES)
  const [loose_id, setLooseId] = useState<number | null>(null)
  const [fallen, setFallen] = useState<ReadonlySet<number>>(NO_FALLEN)
  const [falling, setFalling] = useState<FallingCard[]>([])
  const loosened = useRef(false)
  const entering = useRef(entering_ids)
  /** 系统对话框同一时间只能开一个：开着的时候别的胶带先不理 */
  const picker_open = useRef(false)
  const busy_ids = useRef(new Set<number>())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    entering.current = entering_ids
  }, [entering_ids])

  const later = useCallback((ms: number, fn: () => void) => {
    if (ms <= 0) {
      fn()
    } else {
      timers.current.push(setTimeout(fn, ms))
    }
  }, [])

  /** 只在还处于某个阶段时才往下走，免得过期的定时器把后来的状态改掉 */
  const advance = useCallback((id: number, from: TapePhase, to: TapePhase | null) => {
    if (to === null) {
      busy_ids.current.delete(id)
    }
    setTapes((cur) => {
      const state = cur.get(id)
      if (state === undefined || state.phase !== from) {
        return cur
      }
      const next = new Map(cur)
      if (to === null) {
        next.delete(id)
      } else {
        next.set(id, { ...state, phase: to })
      }
      return next
    })
  }, [])

  /** 瀑布流每次排好都会调一次；第一次挑到了就不再挑。排布要等量过高度才有位置，所以不能在挂载时就挑 */
  const loosen = useCallback(() => {
    if (!loose_enabled || !has_photos || loosened.current) {
      return
    }
    const id = pickTopRowPhoto(root.current, entering.current)
    if (id !== null) {
      loosened.current = true
      setLooseId(id)
    }
  }, [loose_enabled, has_photos, root])

  const spawn = useCallback((photo: PhotoView, card: FallingCard['card'], rotate: number, peel: boolean) => {
    const el = root.current?.querySelector<HTMLElement>(`.photo-card-cell[data-photo-id="${photo.id}"] .photo-card`)
    if (el === null || el === undefined) {
      return
    }
    // 卡片是斜的：外接框的中心就是卡片中心，宽高取未变换的布局尺寸
    const rect = el.getBoundingClientRect()
    setFalling(list => [...list, {
      key: `${photo.id}-${Date.now()}`,
      peel,
      from: {
        width: el.offsetWidth,
        height: el.offsetHeight,
        center_x: rect.left + rect.width / 2,
        center_y: rect.top + rect.height / 2,
        rotate,
      },
      card,
    }])
  }, [root])

  /** 对话框点了“存储”（或浏览器不支持、已经直接下载）：动画继续 */
  const proceed = useCallback((photo: PhotoView, card: FallingCard['card'], rotate: number, with_magnet: boolean) => {
    const reduce = prefersReducedMotion()
    setLooseId(id => (id === photo.id ? null : id))
    if (with_magnet) {
      if (reduce) {
        advance(photo.id, 'asking', null)
        return
      }
      advance(photo.id, 'asking', 'copying')
      later(COPY_SPAWN_MS, () => spawn(photo, card, rotate, true))
      later(COPY_TOTAL_MS, () => advance(photo.id, 'copying', null))
      return
    }
    advance(photo.id, 'asking', null)
    setFallen(prev => new Set(prev).add(photo.id))
    if (!reduce) {
      spawn(photo, card, rotate, false)
    }
  }, [advance, later, spawn])

  /** 对话框点了“取消”：胶带贴回去 */
  const restick = useCallback((id: number, with_magnet: boolean) => {
    // 贴回来的是贴牢的胶带，不再松动
    setLooseId(cur => (cur === id ? null : cur))
    advance(id, 'asking', 'resticking')
    const total = prefersReducedMotion() ? 0 : TAPE_DONE_MS + (with_magnet ? MAGNET_DROP_MS : 0)
    later(total, () => advance(id, 'resticking', null))
  }, [advance, later])

  const pull = useCallback((photo: PhotoView, card: FallingCard['card'], rotate: number, with_magnet: boolean) => {
    if (picker_open.current || busy_ids.current.has(photo.id)) {
      return
    }
    // 系统对话框必须在这一次点击里弹出；不支持就在这一次点击里直接下载
    const picking = pickSaveFile(photo.src)
    if (picking === null) {
      downloadSource(photo)
    } else {
      picker_open.current = true
    }

    busy_ids.current.add(photo.id)
    setTapes(cur => new Map(cur).set(photo.id, { phase: 'tearing', with_magnet }))
    const tear_ms = prefersReducedMotion() ? 0 : (with_magnet ? TEAR_LIFT_MS : 0) + TEAR_MS
    const torn = new Promise<void>(resolve => later(tear_ms, () => {
      advance(photo.id, 'tearing', 'asking')
      resolve()
    }))

    void (async () => {
      const pick = picking === null ? { kind: 'unsupported' as const } : await picking
      picker_open.current = false
      // 对话框可能比撕胶带先关掉：等胶带撕完再往下走
      await torn
      if (pick.kind === 'canceled') {
        restick(photo.id, with_magnet)
        return
      }
      if (pick.kind === 'unsupported' && picking !== null) {
        // 有 showSaveFilePicker 但弹不出来（例如被安全策略拦下）：退回直接下载
        downloadSource(photo)
      }
      proceed(photo, card, rotate, with_magnet)
      if (pick.kind === 'saved' && !(await writeSaveFile(pick.handle, photo.src_url))) {
        // 选好了位置却拿不到原图（跨域没开 CORS 等）：退回新标签页打开
        window.open(photo.src_url, '_blank', 'noopener')
      }
    })()
  }, [advance, later, proceed, restick])

  const landed = useCallback((key: string) => {
    setFalling(list => list.filter(item => item.key !== key))
  }, [])

  return { tapes, loose_id, fallen, falling, pull, landed, loosen }
}

function useWaterfallLayout() {
  const [layout, refreshLayout] = useSafeState(getLayoutConfigure())

  useEffect(() => {
    let latest_width: number | undefined
    updateState()

    function updateState() {
      const viewport_width = getViewportWidth()
      if (latest_width !== viewport_width) {
        latest_width = viewport_width
        refreshLayout(getLayoutConfigure())
      }
    }
    window.addEventListener('resize', updateState)
    return () => window.removeEventListener('resize', updateState)
  }, [refreshLayout])

  return layout
}

function useTitleNode(gallery: GalleryView) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (gallery.can_submission) {
      if (!open) {
        const h = setTimeout(() => {
          setOpen(true)
        }, 1000)
        return () => clearTimeout(h)
      }
    }
  }, [gallery.can_submission, open])

  const title_node = useMemo(() => (
    <div onClick={() => {}} style={{ marginBottom: '20px' }}>
      <Title title={gallery.name} open={open} keepTransition={true}>
        <Submission gallery={gallery} />
      </Title>
    </div>
  ), [gallery, open])

  return title_node
}
