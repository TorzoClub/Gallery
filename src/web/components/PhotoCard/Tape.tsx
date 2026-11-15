import type { CSSProperties, ReactNode } from 'react'
import './Tape.scss'

import { HDR_TAPE_MATRIX, hdrTapeWords } from './hdr'
import { PHOTO_CARD_TAPE_HEIGHT, photoCardTapeWidth } from './scatter'

/**
 * 能撕的纸胶带（点下去就是撕，同时弹出系统的“存储为”对话框）：
 * - idle：贴着，可以点；
 * - tearing：正在撕起（动画由外层 class 驱动）；
 * - asking：撕开了，在等系统对话框的结果（点“存储”继续、点“取消”胶带贴回去）。
 * loose：松动的那一截（吸引锚），一端翘起。
 */
export type TapeLoose = {
  state: 'idle' | 'tearing' | 'asking'
  loose: boolean
  onPull(): void
}

type PhotoCardTapeProps = {
  /** 卡片宽度；用来推导胶带内容区宽度和 HDR 字位置 */
  width: number
  /** 纸胶带的 translateX 百分比和倾角（度）；false 表示不贴纸胶带 */
  tape?: { x: number; rotate: number } | false
  /** 有 HDR optimized 且屏幕支持 HDR：纸胶带换成淡蓝的 HDR 斜向字样 */
  hdr?: boolean
  /** 纸胶带松动了：一端翘起，可以点；点下去就是撕下来 */
  loose?: TapeLoose
  /** 正在贴纸胶带：放一只 🤚 抹胶带，动画时间由外层 class 决定，见 Gallery 的 .photo-card-hand */
  hand?: boolean
}

/**
 * 胶带上的 HDR 纹样：按胶带尺寸算好每个字的位置，只渲染和胶带相交的字。
 * 每个字绝对定位、各自旋转；完全在胶带外的不进 DOM。
 */
function HdrTapeLabel({ width, height }: { width: number; height: number }) {
  const words = hdrTapeWords(width, height)
  const hdr_style = {
    '--hdr-word-w': `${HDR_TAPE_MATRIX.word_width}px`,
    '--hdr-word-h': `${HDR_TAPE_MATRIX.word_height}px`,
    '--hdr-rotate': `${HDR_TAPE_MATRIX.rotate}deg`,
  } as CSSProperties
  return (
    <span className="photo-card-tape-hdr" aria-hidden style={hdr_style}>
      {words.map(word => (
        <span
          key={word.key}
          className="photo-card-tape-hdr-word"
          style={{
            left: `${word.x - HDR_TAPE_MATRIX.word_width / 2}px`,
            top: `${word.y - HDR_TAPE_MATRIX.word_height / 2}px`,
          }}
        >
          HDR
        </span>
      ))}
    </span>
  )
}

function LooseTape({ loose, hdr, hdrLabel, style }: { loose: TapeLoose; hdr: boolean; hdrLabel: ReactNode; style: CSSProperties }) {
  const class_name = [
    'photo-card-tape',
    'is-button',
    loose.loose ? 'is-loose' : '',
    hdr ? 'is-hdr' : '',
  ].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={class_name}
      style={style}
      disabled={loose.state !== 'idle'}
      aria-label="撕下纸胶带（保存原图）"
      title="撕下来，保存原图"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (loose.state === 'idle') {
          loose.onPull()
        }
      }}
    >
      {hdrLabel}
    </button>
  )
}

/**
 * PhotoCard 顶边的那截纸胶带：普通胶带、松动可撕按钮、HDR 字样和 🤚 抹胶带都在这里。
 * 样式和它配套放在 Tape.scss；PhotoCardPaper 只负责相纸外壳。
 */
export default function PhotoCardTape({ width, tape, hdr = false, loose, hand = false }: PhotoCardTapeProps) {
  if (tape === false) {
    return null
  }

  const tape_style = {
    '--tape-x': `${tape?.x ?? -50}%`,
    '--tape-r': `${tape?.rotate ?? -3}deg`,
  } as CSSProperties
  const tape_class = hdr ? 'photo-card-tape is-hdr' : 'photo-card-tape'
  // 胶带内容区宽度由卡片宽度决定；HdrTapeLabel 用同一个值算每个字的位置
  const hdr_label = hdr
    ? <HdrTapeLabel width={photoCardTapeWidth(width)} height={PHOTO_CARD_TAPE_HEIGHT} />
    : null

  return (
    <>
      {loose === undefined
        ? (
          <span className={tape_class} aria-hidden style={tape_style}>
            {hdr_label}
          </span>
        )
        : <LooseTape loose={loose} hdr={hdr} hdrLabel={hdr_label} style={tape_style} />
      }
      {hand && (
        <span className="photo-card-hand" aria-hidden style={tape_style}>
          <span className="photo-card-hand-glyph" />
        </span>
      )}
    </>
  )
}
