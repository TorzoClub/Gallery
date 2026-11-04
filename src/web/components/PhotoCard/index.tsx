import { useRef, type CSSProperties, type ReactNode } from 'react'
import './index.scss'

import { useQueueload } from 'utils/queue-load'
import { Magnet, MagnetSlot } from 'components/Magnet'
import LoadFailure from './LoadFailure'
import { photoCardBottomMin, photoCardCover, photoCardHasBottom } from './scatter'

export { getPhotoCardScatter, photoCardBottomMin, photoCardCover, photoCardFrame, photoIsSideways, type PhotoCardScatter } from './scatter'

export type PhotoCardPaperProps = {
  id?: string
  className?: string
  /** 卡片（含拍立得白边）的宽度 */
  width: number
  /** 白边宽度，photoCardFrame(width) */
  frame: number
  /** 下方有写字区时，底边的白边由写字区自己撑开 */
  has_bottom: boolean
  tilt?: { rotate: number; x: number }
  /** 纸胶带的 translateX 百分比和倾角（度）；false 表示不贴纸胶带 */
  tape?: { x: number; rotate: number } | false
  /** 纸胶带松动了：一端翘起，可以点；点下去就是撕下来 */
  tapeLoose?: TapeLoose
  /** 正在被复印：盖一层扫描光，见 Gallery 的 .photo-card-copying */
  copying?: boolean
  /** 正在贴纸胶带：放一只 🤚 抹胶带，动画时间由外层 class 决定，见 Gallery 的 .photo-card-hand */
  hand?: boolean
  style?: Partial<CSSProperties>
  children: ReactNode
}

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

/**
 * 拍立得的那张相纸：白边、阴影、倾斜和纸胶带。
 * PhotoCard 和投稿表单共用它，里面放 .cover-area 和 .bottom-area。
 */
export function PhotoCardPaper({ id, className, width, frame, has_bottom, tilt, tape, tapeLoose, copying = false, hand = false, style, children }: PhotoCardPaperProps) {
  const tape_style = tape === false ? undefined : {
    '--tape-x': `${tape?.x ?? -50}%`,
    '--tape-r': `${tape?.rotate ?? -3}deg`,
  } as CSSProperties
  return (
    <div
      id={id}
      className={['photo-card', className].filter(Boolean).join(' ')}
      style={{
        width: `${width}px`,
        padding: `${frame}px ${frame}px ${has_bottom ? 0 : frame}px`,
        transform: tilt === undefined ? undefined : `translateX(${tilt.x}px) rotate(${tilt.rotate}deg)`,
        ...(style ?? {}),
      } as CSSProperties}
    >
      {tape !== false && (tapeLoose === undefined
        ? <span className="photo-card-tape" aria-hidden style={tape_style} />
        : <LooseTape loose={tapeLoose} style={tape_style} />
      )}
      {children}
      {copying && <span className="photo-card-scan" aria-hidden />}
      {/* 和纸胶带同一个框（同样的位置、宽度、倾角），手在框里从左端扫到右端 */}
      {hand && tape !== false && (
        <span className="photo-card-hand" aria-hidden style={tape_style}>
          <span className="photo-card-hand-glyph" />
        </span>
      )}
    </div>
  )
}

function LooseTape({ loose, style }: { loose: TapeLoose; style: CSSProperties | undefined }) {
  return (
    <button
      type="button"
      className={loose.loose ? 'photo-card-tape is-button is-loose' : 'photo-card-tape is-button'}
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
    />
  )
}

type PhotoCardImage = {
  width: number
  height: number
  thumb: string
  src: string
}

export type CoverClickEvent = {
  /** 相片（不含白边）未旋转时的矩形，以及它在屏幕上的倾角；大图从这里飞出、转正 */
  from: {
    height: number
    width: number
    top: number
    left: number
    rotate: number
  },
  thumbBlobUrl: string
}

/** 登录成员自己的那一票。`interactive` 为 false 时只显示已经放上去的磁粒，不能点 */
export type PhotoCardVote = {
  selected: boolean
  interactive: boolean
  /** 磁粒正从天而降：这时先显示空位，等它落定再换成真正的那颗 */
  landing?: boolean
  /** 🤏 正把磁粒捏回托盘（PinchMagnet 盖在上面）：这里先换成空位，也先别点 */
  lifting?: boolean
  onToggle(): void
}

export type Props = {
  id: string | number
  /**
   * 是否在卡片上挂 `id="photo-{id}"`（相片加载优先级按它找元素）。
   * 同一张相片在页面上出现第二次（投稿预览、碎纸机、掉下去的那张）时传 false，避免重复 id。
   */
  anchor?: boolean

  /** 卡片（含拍立得白边）的宽度 */
  width: number
  /** 倾角（度）和相对列中线的横向位移（px），由 getPhotoCardScatter 给出 */
  tilt?: { rotate: number; x: number }
  /** 纸胶带的 translateX 百分比和倾角（度），由 getPhotoCardScatter 给出；不给就是居中、-3°；false 是不贴 */
  tape?: { x: number; rotate: number } | false
  tapeLoose?: TapeLoose
  copying?: boolean
  hand?: boolean

  style?: Partial<CSSProperties>

  hideMember: boolean

  name: string | null
  photo: PhotoCardImage
  avatar: PhotoCardImage | null
  desc: string

  vote?: PhotoCardVote

  coverOverlay?: ReactNode
  onClickCover?(clickInfo: CoverClickEvent): void
  renderAvatar?(avatar: ReactNode): ReactNode
  renderName?(name: ReactNode): ReactNode
}

const PhotoCard = (props: Props) => {
  const { width, tilt, tape, tapeLoose, photo, hideMember, avatar, desc, style, vote, anchor = true } = props

  const [thumb_status, thumb, retryLoadPhotoThumb] = useQueueload(photo.thumb)
  const [avatar_status, avatarThumb] = useQueueload(avatar?.thumb)

  const coverFrameEl = useRef<HTMLDivElement>(null)

  const { frame, cover_width, cover_height, sideways } = photoCardCover(width, photo)
  const rotate = tilt?.rotate ?? 0

  const show_desc = Boolean(desc.trim().length)
  // 活动中的公开相片不带作者（hideMember），没有描述时就没有写字区，下方只留一道白边
  const show_member = !hideMember
  const has_bottom = photoCardHasBottom(show_member, show_desc ? 1 : 0)

  const avatar_node = (
    <div className="avatar">
      <div className="avatar-inner" style={{ transform: avatar_status === 'LOADED' ? 'translateY(0px)' : 'translateY(-100%)', backgroundImage: `url(${avatarThumb})` }}></div>
    </div>
  )
  const name_node = (
    <div className="member-name">
      <span className="name-label">{props.name}</span>
    </div>
  )

  return (
    <PhotoCardPaper
      id={anchor ? `photo-${props.id}` : undefined}
      width={width}
      frame={frame}
      has_bottom={has_bottom}
      tilt={tilt}
      tape={tape}
      tapeLoose={tapeLoose}
      copying={props.copying}
      hand={props.hand}
      style={style}
    >
      <div
        className="cover-area"
        ref={coverFrameEl}
        style={{ height: `${cover_height}px`, cursor: props.onClickCover === undefined ? 'default' : undefined }}
        onClick={(e) => {
          e.preventDefault()
          if (thumb_status === 'FAILURE' || coverFrameEl.current === null) {
            return
          }
          const el = coverFrameEl.current
          // 卡片是斜的：getBoundingClientRect 是外接框。中心点不随旋转改变，宽高取未变换的布局尺寸
          const rect = el.getBoundingClientRect()
          // 横长图竖着贴：起点是那张躺着的原图（宽高对调、多转 90°），放大时一边转回横向一边放大，退出时倒回去
          const w = sideways ? el.offsetHeight : el.offsetWidth
          const h = sideways ? el.offsetWidth : el.offsetHeight
          props.onClickCover?.({
            from: {
              width: w,
              height: h,
              left: rect.left + rect.width / 2 - w / 2,
              top: rect.top + rect.height / 2 - h / 2,
              rotate: rotate + (sideways ? 90 : 0),
            },
            thumbBlobUrl: thumb,
          })
        }}
      >
        <img
          className={sideways ? 'cover cover-sideways' : 'cover'}
          alt={[props.name, desc.trim()].filter(Boolean).join('：')}
          src={thumb || undefined}
          style={sideways
            // 横长图：<img> 按原图方向排（宽高对调），转 90° 后正好填满竖着的 .cover-area
            ? { opacity: thumb_status === 'LOADED' ? 1 : 0, width: `${cover_height}px`, height: `${cover_width}px` }
            : { opacity: thumb_status === 'LOADED' ? 1 : 0 }}
        />
        {thumb_status === 'FAILURE' && <LoadFailure onClick={retryLoadPhotoThumb} />}
        {props.coverOverlay}
      </div>

      {has_bottom && <div className={vote === undefined ? 'bottom-area' : 'bottom-area has-vote'} style={{ minHeight: `${photoCardBottomMin(width)}px` }}>
        {show_member && (
          <div className="member-info">
            <div className="avatar-wrapper">
              {props.renderAvatar === undefined ? avatar_node : props.renderAvatar(avatar_node)}
            </div>
            {props.renderName === undefined ? name_node : props.renderName(name_node)}
          </div>
        )}
        {show_desc && <pre className="desc-block">{desc}</pre>}
      </div>}

      {/* 登录成员自己的那一票：吸在整张卡片的右下角（不在 cover-area 里，32px 的磁粒放不进相片角落，也会被 overflow 裁掉） */}
      {vote !== undefined && <OwnVote vote={vote} />}
    </PhotoCardPaper>
  )
}
export default PhotoCard

/** 相片右下角的那一颗：放上去就是磁粒，拿走了（且还能投）就是一个空位 */
function OwnVote({ vote }: { vote: PhotoCardVote }) {
  // 磁粒还在半空（position: fixed 的 FallingMagnet 盖在上面）：这里先留着空位，落定后再换成磁粒
  // 磁粒正被 🤏 捏回托盘：飞着的那颗盖在这里，这里同样先留空位
  const placed = vote.selected && vote.landing !== true && vote.lifting !== true
  if (!vote.interactive) {
    return placed
      ? <span className="photo-card-vote is-static"><Magnet /></span>
      : null
  }
  return (
    <button
      type="button"
      className="photo-card-vote"
      // 磁粒还在半空：先占着位子，但先别点，等它落定
      disabled={vote.landing === true || vote.lifting === true}
      aria-pressed={vote.selected}
      aria-label={vote.selected ? '收回磁粒' : '放一颗磁粒（投一票）'}
      title={vote.selected ? '收回磁粒' : '放一颗磁粒'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        vote.onToggle()
      }}
    >
      {placed ? <Magnet /> : <MagnetSlot />}
    </button>
  )
}
