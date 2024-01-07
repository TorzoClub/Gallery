import { forwardRef, useState, useEffect, useRef, CSSProperties, useCallback, FunctionComponent, useMemo } from 'react'
import heartIMG from 'assets/heart.png'
import heartHighlightIMG from 'assets/heart-highlight.png'
import './index.scss'

import { global_cache, useQueueload } from 'utils/queue-load'
import useMeasure from 'hooks/useMeasure'

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
  vertial_gutter: number
  box_width: number

  style?: Partial<CSSProperties>

  hideMember: boolean
  show_vote_button: boolean

  vote_button_status: BackBottomProps['vote_button_status']
  handleClickVote: BackBottomProps['handleClickVote']

  name: string | null
  photo: PhotoBoxImage
  avatar: PhotoBoxImage | null
  desc: string

  onClickCover(clickInfo: CoverClickEvent): void
}
export const PhotoBoxDimension = forwardRef< DimensionUnknown, Props>((props, ref) => {
  const _setRef = useCallback((val: DimensionUnknown) => {
    if (typeof ref === 'function') {
      ref(val)
    } else if ((ref !== null) && (typeof ref === 'object')) {
      ref.current = val
    }
  }, [ref])

  const setRef = useCallback(({ width, height }: {
    width: number | null;
    height: number | null;
  }) => {
    if ((width !== null) && (height !== null)) {
      const dim = [ width, height ] as const
      _setRef(dim)
    } else {
      _setRef(null)
    }
  }, [_setRef])

  const [measure_ref] = useMeasure(({ width, height }) => {
    setRef({ width, height })
  })

  return <PhotoBox {...props} ref={measure_ref} />
})

const PhotoBox = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { type, vertial_gutter, box_width, photo, hideMember,
         avatar, desc, style, vote_button_status } = props

  const [thumb_loaded, thumb] = useQueueload(photo.thumb)
  const [avatar_loaded, avatarThumb] = useQueueload(avatar?.thumb)

  const coverFrameEl = useRef<HTMLDivElement>(null)

  const ratio = (photo.height / photo.width).toFixed(4)

  const height = `calc((${box_width}px) * ${ratio})`

  const coverFrameStyle = useMemo(() => ({
    height,
    background: thumb_loaded ? 'white' : ''
  }), [thumb_loaded, height])

  const show_desc = Boolean(desc.trim().length)
  const show_bottom_block = !hideMember || show_desc
  const none_bottom_block = !show_bottom_block

  return (
    <div
      ref={ref}
      id={`photo-${props.id}`}
      className={`image-box-wrapper ${(type === 'compact') && 'compact'} ${none_bottom_block ? 'none-bottom-block' : 'has-bottom-block'}`}
      style={{
        '--vertical-gutter': `${vertial_gutter}px`,
        width: `calc(${box_width}px)`,
        ...(style ?? {})
      } as React.CSSProperties}
    >
      <div className="image-box">
        <div
          className="cover-area"
          ref={coverFrameEl}
          style={coverFrameStyle}
          onClick={(e) => {
            e.preventDefault()
            if (coverFrameEl.current) {
              const {
                height, width, top, left
              } = coverFrameEl.current.getBoundingClientRect()

              props.onClickCover({
                from: {
                  height, width, top, left,
                },
                thumbBlobUrl: thumb
              })
            }
          }}
        >
          <img
            className="cover"
            alt="img"
            src={thumb}
            style={{ opacity: thumb_loaded ? 100 : 0 }}
          />

          {/* <div className="highlight"></div> */}
        </div>

        <div className="bottom-area">
          {
            show_bottom_block && (
              <div className="bottom-block">
                {hideMember || (
                  <div className="member-info">
                    <div className="avatar-wrapper">
                      <div className="avatar">
                        <div className="avatar-inner" style={{ transform: avatarThumb ? 'translateY(0px)' : 'translateY(-100%)', backgroundImage: `url(${avatarThumb})` }}></div>
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
            props.show_vote_button && <BackBottom vote_button_status={vote_button_status} handleClickVote={props.handleClickVote} />
          }
        </div>
      </div>
    </div>
  )
})
export default PhotoBox

type BackBottomProps = {
  handleClickVote(): void
  vote_button_status: 'selected' | 'un-selected' | 'cannot-select'
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
            className={`block ${cannot_select_animation_playing ? 'cannot-select' : 'highlight'}`}
            style={{
              opacity: (
                vote_button_is_highlight || cannot_select_animation_playing
              ) ? 1 : 0
            }}
            onClick={() => {
              if (vote_button_status === 'cannot-select') {
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
