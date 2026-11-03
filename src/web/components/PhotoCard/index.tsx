import { useRef, type CSSProperties, type ReactNode } from 'react'
import './index.scss'

import { useQueueload } from 'utils/queue-load'
import { Magnet, MagnetSlot } from 'components/Magnet'
import LoadFailure from './LoadFailure'
import { photoCardBottomMin, photoCardCover, photoCardHasBottom } from './scatter'

export { getPhotoCardScatter, photoCardBottomMin, photoCardCover, photoCardFrame, type PhotoCardScatter } from './scatter'

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
  style?: Partial<CSSProperties>
  children: ReactNode
}

/**
 * 拍立得的那张相纸：白边、阴影、倾斜和纸胶带。
 * PhotoCard 和投稿表单共用它，里面放 .cover-area 和 .bottom-area。
 */
export function PhotoCardPaper({ id, className, width, frame, has_bottom, tilt, tape, style, children }: PhotoCardPaperProps) {
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
      {tape !== false && <span className="photo-card-tape" aria-hidden style={tape_style} />}
      {children}
    </div>
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
  onToggle(): void
}

export type Props = {
  id: string | number

  /** 卡片（含拍立得白边）的宽度 */
  width: number
  /** 倾角（度）和相对列中线的横向位移（px），由 getPhotoCardScatter 给出 */
  tilt?: { rotate: number; x: number }
  /** 纸胶带的 translateX 百分比和倾角（度），由 getPhotoCardScatter 给出；不给就是居中、-3° */
  tape?: { x: number; rotate: number }

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
  const { width, tilt, tape, photo, hideMember, avatar, desc, style, vote } = props

  const [thumb_status, thumb, retryLoadPhotoThumb] = useQueueload(photo.thumb)
  const [avatar_status, avatarThumb] = useQueueload(avatar?.thumb)

  const coverFrameEl = useRef<HTMLDivElement>(null)

  const { frame, cover_height } = photoCardCover(width, photo)
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
      id={`photo-${props.id}`}
      width={width}
      frame={frame}
      has_bottom={has_bottom}
      tilt={tilt}
      tape={tape}
      style={style}
    >
      <div
        className="cover-area"
        ref={coverFrameEl}
        style={{ height: `${cover_height}px` }}
        onClick={(e) => {
          e.preventDefault()
          if (thumb_status === 'FAILURE' || coverFrameEl.current === null) {
            return
          }
          const el = coverFrameEl.current
          // 卡片是斜的：getBoundingClientRect 是外接框。中心点不随旋转改变，宽高取未变换的布局尺寸
          const rect = el.getBoundingClientRect()
          const w = el.offsetWidth
          const h = el.offsetHeight
          props.onClickCover?.({
            from: {
              width: w,
              height: h,
              left: rect.left + rect.width / 2 - w / 2,
              top: rect.top + rect.height / 2 - h / 2,
              rotate,
            },
            thumbBlobUrl: thumb,
          })
        }}
      >
        <img
          className="cover"
          alt={[props.name, desc.trim()].filter(Boolean).join('：')}
          src={thumb || undefined}
          style={{ opacity: thumb_status === 'LOADED' ? 1 : 0 }}
        />
        {thumb_status === 'FAILURE' && <LoadFailure onClick={retryLoadPhotoThumb} />}
        {props.coverOverlay}
        {vote !== undefined && <OwnVote vote={vote} />}
      </div>

      {has_bottom && <div className="bottom-area" style={{ minHeight: `${photoCardBottomMin(width)}px` }}>
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
    </PhotoCardPaper>
  )
}
export default PhotoCard

/** 相片右上角的那一颗：放上去就是磁粒，拿走了（且还能投）就是一个空位 */
function OwnVote({ vote }: { vote: PhotoCardVote }) {
  if (!vote.interactive) {
    return vote.selected
      ? <span className="photo-card-vote is-static"><Magnet /></span>
      : null
  }
  return (
    <button
      type="button"
      className="photo-card-vote"
      aria-pressed={vote.selected}
      aria-label={vote.selected ? '收回磁粒' : '放一颗磁粒（投一票）'}
      title={vote.selected ? '收回磁粒' : '放一颗磁粒'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        vote.onToggle()
      }}
    >
      {vote.selected ? <Magnet /> : <MagnetSlot />}
    </button>
  )
}
