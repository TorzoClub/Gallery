import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClientPhotoBase, ClientPool } from '@shared/client-pool'
import { photoThumbUrl } from '../../pool/media'
import __torzo_logo_src from '../../assets/torzo-logo.png'
import styles from './index.module.css'

/*
 * Behind 页的品牌图：一叠散放在桌上的相片，一张张放上去。
 * 移植自旧站“网址迁移说明”页的 #photos-container-wrapper（原生 DOM 脚本），改写成 React。
 *
 * 两种观察角度，按 Behind 页的布局断点切换（BehindApp.css 的 800px）：
 *
 * 1. 俯视（≥ 800px，desk）：品牌和 System Reports 并排，跟 System Reports、名单簿一样从正上方往下看。
 *    - 没有 rotateX，只留平面内的 rotateZ
 *    - 入场：在最终位置的基础上先往上偏 30～60px、多转 -15°～+15°、透明，
 *      100ms 后回到 translateY(0) rotate(0)
 *    - 叠放顺序：后放的压在先放的上面（z-index = 第几张）
 *    - 相片长边 200px、偏移 ±20px、logo 176px，整叠落在 340×340 内，不伸进旁边的 System Reports
 *
 * 2. 斜看（< 800px，tilt，单列的移动端视图）：原版的样子。
 *    - 容器 perspective 1024px、preserve-3d；每层 rotateX(45deg) 躺倒，再 rotateZ
 *    - 入场：从 translateZ(200px) 透明处，100ms 后落到 translateZ(第 n 张 px)；
 *      叠放顺序由 translateZ 决定，同样是后放的在上面
 *    - 相片长边 256px、偏移 ±30px、logo 256px，尺寸照原版
 *
 * 两种角度共用：opacity 282ms、transform 882ms，都是 ease（原版时长）；
 * 每张相片的倾角、偏移方向和缩放只随机一次，切换角度时同一叠不重新洗牌，已落下的相片直接换成新角度、不播过渡。
 *
 * 编排：
 * - 第一张是 torzo-logo.png，摆正，垫在最底下；之后从 ClientPool 随机取 12 张相片缩略图，一张张叠上去
 * - 第一张落下 1s 后，桌面上的落影淡入（500ms）
 * - 开始前等 1s；之后每张至少间隔 3500～4000ms（图片加载比这慢就等加载完）
 * 和原版的不同：加载失败 / 超时的相片直接跳过，不显示失败卡片；点击相片不加彩蛋图。
 */

type View = 'desk' | 'tilt'

/** 与 BehindApp.css 的两栏断点一致：< 800px 是单列的移动端视图 */
const TILT_QUERY = '(max-width: 799px)'

const VIEW_CONFIG: Record<View, { photo_size: number; logo_size: number; offset_range: number }> = {
  desk: { photo_size: 200, logo_size: 176, offset_range: 20 },
  tilt: { photo_size: 256, logo_size: 256, offset_range: 30 },
}

const PHOTO_COUNT = 12
const ROTATE_RANGE = 30
const DESK_ENTER_Y_MIN = 30
const DESK_ENTER_Y_MAX = 60
const DESK_ENTER_ROTATE_RANGE = 15
const TILT_DROP_HEIGHT = 200
const START_DELAY_MS = 1000
const INTERVAL_MIN_MS = 3500
const INTERVAL_MAX_MS = 4000
const LAND_DELAY_MS = 100
const SHADOW_DELAY_MS = 1000
const LOAD_TIMEOUT_MS = 18_000

type StackItem = {
  key: string
  url: string
  width: number
  height: number
  straighten: boolean
}

type Layer = StackItem & {
  rotate_z: number
  /** 偏移的比例（-1～1），乘上当前角度的 offset_range 才是 px */
  offset_x: number
  offset_y: number
  scale: number
  /** 俯视入场起点：在最终位置上再往上偏多少 px（负数）、再多转多少度 */
  enter_y: number
  enter_rotate: number
  /** 加进来时的角度切换序号；和当前不同说明中途切过角度，直接摆好、不播过渡 */
  epoch: number
}

function randomInt(range: number): number {
  return Math.floor(Math.random() * (range + 1))
}

function randomSign(): 1 | -1 {
  return Math.random() < 0.5 ? 1 : -1
}

function shuffle<T>(list: T[]): T[] {
  const result = [...list]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomInt(index)
    const swap = result[index]
    result[index] = result[other]
    result[other] = swap
  }
  return result
}

/** 长边缩到 long_side，短边按比例 */
function photoDimension(width: number, height: number, long_side: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: long_side, height: long_side }
  }
  return width >= height
    ? { width: long_side, height: long_side * height / width }
    : { width: long_side * width / height, height: long_side }
}

function toLayer(item: StackItem, epoch: number): Layer {
  const enter = {
    enter_y: -(DESK_ENTER_Y_MIN + Math.random() * (DESK_ENTER_Y_MAX - DESK_ENTER_Y_MIN)),
    enter_rotate: (Math.random() * 2 - 1) * DESK_ENTER_ROTATE_RANGE,
    epoch,
  }
  if (item.straighten) {
    return { ...item, ...enter, rotate_z: 0, offset_x: 0, offset_y: 0, scale: 1 }
  }
  return {
    ...item,
    ...enter,
    rotate_z: -randomSign() * randomInt(ROTATE_RANGE),
    offset_x: randomSign() * Math.random(),
    offset_y: randomSign() * Math.random(),
    scale: 1 + randomInt(10) / 100,
  }
}

function stackItems(pool: ClientPool | null): StackItem[] {
  const logo: StackItem = {
    key: 'logo',
    url: __torzo_logo_src,
    width: 1,
    height: 1,
    straighten: true,
  }
  if (pool === null) {
    return [logo]
  }
  const photos: ClientPhotoBase[] = pool.galleries.flatMap((gallery): ClientPhotoBase[] => gallery.photos)
  return [
    logo,
    ...shuffle(photos).slice(0, PHOTO_COUNT).map(photo => ({
      key: `photo-${photo.id}`,
      url: photoThumbUrl(pool, photo),
      width: photo.width,
      height: photo.height,
      straighten: false,
    })),
  ]
}

/** 加载成功 true；失败 / 超时 false */
function loadImage(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const image = new Image()
    const done = (ok: boolean) => {
      window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      image.onabort = null
      resolve(ok)
    }
    const timer = window.setTimeout(() => {
      image.src = ''
      done(false)
    }, LOAD_TIMEOUT_MS)
    image.onload = () => done(true)
    image.onerror = () => done(false)
    image.onabort = () => done(false)
    image.src = url
  })
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function useStackView(): View {
  const [view, setView] = useState<View>(() => (
    typeof window !== 'undefined' && window.matchMedia(TILT_QUERY).matches ? 'tilt' : 'desk'
  ))
  useEffect(() => {
    const mq = window.matchMedia(TILT_QUERY)
    const update = () => setView(mq.matches ? 'tilt' : 'desk')
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return view
}

function layerTransform(layer: Layer, view: View, depth: number, landed: boolean): string {
  const range = VIEW_CONFIG[view].offset_range
  const offset = `translate(${(layer.offset_x * range).toFixed(1)}px, ${(layer.offset_y * range).toFixed(1)}px) scale(${layer.scale})`
  if (view === 'tilt') {
    // 原版：躺倒 45°，从 200px 高处落到第 depth 层
    const z = landed ? depth : TILT_DROP_HEIGHT
    return `rotateX(45deg) rotateZ(${layer.rotate_z}deg) translateZ(${z}px) ${offset}`
  }
  // 俯视：入场偏移放在最前面（屏幕坐标系：往上偏、绕中心多转），落定后归零；函数列表前后一致，过渡逐项插值
  const enter_y = landed ? 0 : layer.enter_y
  const enter_rotate = landed ? 0 : layer.enter_rotate
  return `translateY(${enter_y.toFixed(1)}px) rotate(${enter_rotate.toFixed(1)}deg) rotateZ(${layer.rotate_z}deg) ${offset}`
}

function StackLayer({ layer, view, depth, instant }: { layer: Layer; view: View; depth: number; instant: boolean }) {
  const [landed, setLanded] = useState(instant)
  useEffect(() => {
    if (landed) {
      return
    }
    const timer = window.setTimeout(() => setLanded(true), LAND_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [landed])

  const config = VIEW_CONFIG[view]
  const size = layer.straighten
    ? { width: config.logo_size, height: config.logo_size }
    : photoDimension(layer.width, layer.height, config.photo_size)
  return (
    <div
      className={styles.layer}
      data-instant={instant || undefined}
      style={{
        opacity: landed ? 1 : 0,
        transform: layerTransform(layer, view, depth, landed),
        // 俯视靠 z-index 分上下；斜看在 preserve-3d 里由 translateZ 决定
        zIndex: view === 'desk' ? depth : undefined,
      }}
    >
      <div className={styles.photo} style={{ width: size.width, height: size.height }}>
        <img src={layer.url} alt='' draggable={false} />
      </div>
    </div>
  )
}

export default function BehindPhotoStack({ pool, play }: {
  pool: ClientPool | null
  /** 为 true 时才开始一张张落下（Behind 页真正显示后）；变回 false 停止，已落下的留着 */
  play: boolean
}) {
  const view = useStackView()
  const [layers, setLayers] = useState<Layer[]>([])
  // 已经落下（或已跳过）的相片；play 从 false 回到 true 时从下一张接着落
  const done_keys = useRef(new Set<string>())
  const [shadow, setShadow] = useState(false)
  const [instant] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))

  // 角度每切一次 +1。层上记着自己加进来时的序号，对不上就直接摆好；
  // 容器也以它为 key 重新挂载，免得已落下的相片在两种 transform 之间播一段过渡
  const [epoch, setEpoch] = useState(0)
  const epoch_ref = useRef(0)
  const last_view = useRef(view)
  // layout effect：在浏览器算样式之前就换掉容器，新角度的 transform 不会先在旧节点上起过渡
  useLayoutEffect(() => {
    if (last_view.current !== view) {
      last_view.current = view
      epoch_ref.current += 1
      setEpoch(epoch_ref.current)
    }
  }, [view])

  // pool 第一次就绪时定下这一叠的内容；之后 pool 刷新也不重新洗牌，免得已落下的相片对不上
  const [items, setItems] = useState<StackItem[] | null>(null)
  useEffect(() => {
    if (items === null && pool !== null) {
      setItems(stackItems(pool))
    }
  }, [items, pool])

  useEffect(() => {
    if (!play || items === null) {
      return
    }
    let cancelled = false
    void (async () => {
      if (!instant) {
        await wait(START_DELAY_MS)
      }
      for (const item of items) {
        if (cancelled) {
          return
        }
        if (done_keys.current.has(item.key)) {
          continue
        }
        const interval = instant ? Promise.resolve() : wait(INTERVAL_MIN_MS + randomInt(INTERVAL_MAX_MS - INTERVAL_MIN_MS))
        const loaded = loadImage(item.url).then(ok => {
          if (cancelled) {
            return
          }
          done_keys.current.add(item.key)
          if (ok) {
            setLayers(current => [...current, toLayer(item, epoch_ref.current)])
          }
        })
        await Promise.all([interval, loaded])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [play, items, instant])

  const has_layer = layers.length > 0
  useEffect(() => {
    if (!has_layer || shadow) {
      return
    }
    const timer = window.setTimeout(() => setShadow(true), instant ? 0 : SHADOW_DELAY_MS + LAND_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [has_layer, shadow, instant])

  return (
    <div className={styles.wrapper} data-view={view} role='img' aria-label='Torzo Gallery'>
      <div key={epoch} className={styles.container}>
        <div className={styles.shadow} data-instant={instant || undefined} style={{ opacity: shadow ? 1 : 0 }} />
        {/* 后放的压在先放的上面：logo 第一张，垫在最底下 */}
        {layers.map((layer, index) => (
          <StackLayer
            key={layer.key}
            layer={layer}
            view={view}
            depth={index + 1}
            instant={instant || layer.epoch !== epoch}
          />
        ))}
      </div>
    </div>
  )
}
