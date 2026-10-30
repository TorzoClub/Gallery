import { useState, useEffect, useRef, CSSProperties, useMemo, type MouseEvent, type ReactNode } from 'react'
import heartIMG from 'assets/heart.png'
import heartHighlightIMG from 'assets/heart-highlight.png'
import './index.scss'

import { useQueueload } from 'utils/queue-load'
import useMeasure from 'hooks/useMeasure'
import LoadFailure from './LoadFailure'

export type DimensionUnknown = Dimension | null
export type Dimension = readonly [number, number]
export const postDimesions = (
  width: null | number,
  height: null | number,
  default_width: number,
  default_height: number,
): Dimension => [
  width ?? default_width,
  height ?? default_height,
] as const

type PhotoBoxImage = {
  width: number
  height: number
  thumb: string
  src: string
}

export type CoverClickEvent = {
  from: {
    height: number
    width: number
    top: number
    left: number
  },
  thumbBlobUrl: string
}

export type Props = {
  id: string | number

  type: 'normal' | 'compact'
  box_width: number

  style?: Partial<CSSProperties>

  hideMember: boolean
  show_vote_button?: boolean

  vote_button_status?: BackBottomProps['vote_button_status']
  handleClickVote?: BackBottomProps['handleClickVote']

  name: string | null
  photo: PhotoBoxImage
  avatar: PhotoBoxImage | null
  desc: string

  onClickCover?(clickInfo: CoverClickEvent): void
  onClickAvatar?(event: MouseEvent<HTMLDivElement>): void
  bottomActions?: ReactNode
  coverOverlay?: ReactNode
}

const PhotoBox = (props: Props) => {
  const { type, box_width, photo, hideMember,
         avatar, desc, style, vote_button_status } = props

  const [thumb_status, thumb, retryLoadPhotoThumb] = useQueueload(photo.thumb)
  const [avatar_status, avatarThumb, retryLoadAvatar] = useQueueload(avatar?.thumb)

  const coverFrameEl = useRef<HTMLDivElement>(null)

  const ratio = (photo.height / photo.width).toFixed(4)

  const cover_frame_height = `calc((${box_width}px) * ${ratio})`

  const show_desc = Boolean(desc.trim().length)
  const show_bottom_block = !hideMember || show_desc
  const none_bottom_block = !show_bottom_block

  return (
    <div
      id={`photo-${props.id}`}
      className={`image-box-wrapper ${(type === 'compact') && 'compact'} ${none_bottom_block ? 'none-bottom-block' : 'has-bottom-block'}`}
      style={{
        width: `calc(${box_width}px)`,
        ...(style ?? {})
      } as React.CSSProperties}
    >
      <div className="image-box">
        <div
          className="cover-area"
          ref={coverFrameEl}
          style={{ height: cover_frame_height }}
          onClick={(e) => {
            e.preventDefault()
            if (thumb_status !== 'FAILURE') {
              if (coverFrameEl.current) {
                const {
                  height, width, top, left
                } = coverFrameEl.current.getBoundingClientRect()

                props.onClickCover?.({
                  from: {
                    height, width, top, left,
                  },
                  thumbBlobUrl: thumb
                })
              }
            }
          }}
        >
          <img
            className="cover"
            alt="img"
            src={thumb || undefined}
            style={{ opacity: thumb_status === 'LOADED' ? 100 : 0 }}
          />
          { thumb_status === 'FAILURE' && <LoadFailure onClick={retryLoadPhotoThumb} /> }
          {props.coverOverlay}

          {/* <div className="highlight"></div> */}
        </div>

        <div className="bottom-area">
          {
            show_bottom_block && (
              <div className="bottom-block">
                {hideMember || (
                  <div className="member-info">
                    <div
                      className={`avatar-wrapper ${props.onClickAvatar !== undefined ? 'avatar-wrapper--clickable' : ''}`}
                      role={props.onClickAvatar !== undefined ? 'button' : undefined}
                      tabIndex={props.onClickAvatar !== undefined ? 0 : undefined}
                      onClick={props.onClickAvatar}
                      onKeyDown={(event) => {
                        if (props.onClickAvatar !== undefined && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault()
                          event.currentTarget.click()
                        }
                      }}
                    >
                      <div className="avatar">
                        <div className="avatar-inner" style={{ transform: avatar_status === 'LOADED' ? 'translateY(0px)' : 'translateY(-100%)', backgroundImage: `url(${avatarThumb})` }}></div>
                      </div>
                    </div>

                    <div className="member-name">
                      <div className="avatar-float"></div>
                      <span className="name-label">{props.name}</span>
                    </div>
                  </div>
                )}
                {show_desc && (
                  <pre className="desc-block">
                    {desc}
                  </pre>
                )}
              </div>
            )
          }
          {
            props.bottomActions !== undefined && (
              <div className="bottom-block bottom-block--admin-actions">
                {props.bottomActions}
              </div>
            )
          }

          {
            props.show_vote_button && vote_button_status !== undefined && props.handleClickVote !== undefined && (
              <BackBottom vote_button_status={vote_button_status} handleClickVote={props.handleClickVote} />
            )
          }
        </div>
      </div>
    </div>
  )
}
export default PhotoBox

type BackBottomProps = {
  handleClickVote(): void
  vote_button_status: 'selected' | 'un-selected' | 'cannot-add'
}
function BackBottom({
   handleClickVote,
   vote_button_status,
}: BackBottomProps) {
  const [cannot_select_animation_playing, setSelectAnimation] = useState(false)
  useEffect(() => {
    if (cannot_select_animation_playing) {
      const h = setTimeout(() => {
        setSelectAnimation(false)
      }, 1500)
      return () => clearTimeout(h)
    }
  }, [cannot_select_animation_playing])

  const vote_button_is_highlight = vote_button_status === 'selected'

  return useMemo(() => (
    <div className="back-bottom-wrapper">
      <div className="back-bottom">
        <div className="block-wrapper" onClick={e => {
          e.preventDefault()
          e.stopPropagation()

          handleClickVote()
        }}>
          <div
            className='block'
            onClick={() => {
              setSelectAnimation(true)
            }}
          >
            <div className="heart" style={{ backgroundImage: `url(${heartIMG})` }} />
          </div>
          <div
            className={`block ${cannot_select_animation_playing ? 'cannot-add' : 'highlight'}`}
            style={{
              opacity: (
                vote_button_is_highlight || cannot_select_animation_playing
              ) ? 1 : 0
            }}
            onClick={() => {
              if (vote_button_status === 'cannot-add') {
                setSelectAnimation(true)
              }
            }}
          >
            <div className="heart" style={{ backgroundImage: `url(${heartHighlightIMG})` }} />
          </div>
        </div>
      </div>
    </div>
  ), [cannot_select_animation_playing, handleClickVote, vote_button_is_highlight, vote_button_status])
}
