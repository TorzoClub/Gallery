import { forwardRef, useState, useEffect, useRef, CSSProperties, useCallback, FunctionComponent, useMemo } from 'react'
import heartIMG from 'assets/heart.png'
import heartHighlightIMG from 'assets/heart-highlight.png'
import './index.scss'

import { global_cache, useQueueload } from 'utils/queue-load'
import useMeasure from 'hooks/useMeasure'
import { Photo } from 'api/photo'

export type DimensionUnknown = Dimension | null
export type Dimension = readonly [number, number]
export const postDimesions = (
  width: null | number,
  height: null | number,
  default_width: number,
  default_height: number,
): Dimension => [
  width ?? default_width,
  height ?? default_height
] as const

export type ImageInfo = {
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

  hideVoteButton: boolean
  hideMember: boolean
  voteIsHighlight: boolean

  name: string | null
  photo: ImageInfo
  avatar: ImageInfo | null
  desc: string

  handleClickVote(): void
  onClickCover(clickInfo: CoverClickEvent): void
}
export type PhotoGroupItem = {
  pb_node: JSX.Element
  dim: Dimension
  props: Props
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
  const { type, vertial_gutter, box_width, photo, hideMember, avatar, desc, style } = props

  const [thumb_loaded, thumb] = useQueueload(photo.thumb)
  const [avatar_loaded, avatarThumb] = useQueueload(avatar?.thumb)

  const coverFrameEl = useRef<HTMLDivElement>(null)

  const ratio = (photo.height / photo.width).toFixed(4)

  const height = `calc((${box_width}px) * ${ratio})`

  const coverFrameStyle = useMemo(() => ({
    height,
    background: avatar_loaded ? 'white' : ''
  }), [avatar_loaded, height])

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
        width: `calc(${box_width}px)`, ...(style ?? {})
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
            props.hideVoteButton || (
              <div className="back-bottom-wrapper">
                <div className="back-bottom">
                  <div className="block-wrapper" onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()

                    props.handleClickVote()
                  }}>
                    {
                      props.voteIsHighlight ?
                        <div className="block highlight">
                          <div className="heart" style={{ backgroundImage: `url(${heartHighlightIMG})` }} />
                        </div>
                        :
                        <div className="block">
                          <div className="heart" style={{ backgroundImage: `url(${heartIMG})` }} />
                        </div>
                    }
                  </div>
                </div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
})
export default PhotoBox
