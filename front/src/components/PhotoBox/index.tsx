import { forwardRef, useState, useEffect, useRef, CSSProperties } from 'react'
import heartIMG from 'assets/heart.png'
import heartHighlightIMG from 'assets/heart-highlight.png'
import style from './index.scss'

import { useQueueload } from 'utils/queue-load'
import useMeasure from 'hooks/useMeasure'

function postDimesions(
  width: null | number,
  height: null | number,
  default_width: number,
  default_height: number,
) {
  return [
    width ?? default_width,
    height ?? default_height
  ] as const
}

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

  screen: 'normal' | 'mobile'
  gutter: CSSProperties['width']
  boxWidth: string

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
export type UsePhotoBox = ReturnType<typeof usePhotoBox>
export function usePhotoBox(p: Props) {
  const [ref, dimensions] = useMeasure()

  return [
    <PhotoBox {...p} ref={ref} />,
    postDimesions(
      dimensions.width, dimensions.height,
      p.photo.width, p.photo.height,
    ),
    p
  ] as const
}

const PhotoBox = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { screen, gutter, boxWidth, photo, hideMember, avatar, desc } = props

  const [loaded, setLoaded] = useState(false)

  const [,thumb] = useQueueload(photo.thumb)
  const [,avatarThumb] = useQueueload(avatar?.thumb)

  const coverFrameEl = useRef<HTMLDivElement>(null)

  const ratio = (photo.height / photo.width).toFixed(4)

  const isMobile = screen === 'mobile'

  let height: CSSProperties['height']
  if (isMobile) {
    height = `calc((${boxWidth} - ${gutter} / 2) * ${ratio})`
  } else {
    height = `calc((${boxWidth} - ${style['avatar-size']} / 2) * ${ratio})`
  }

  const coverFrameStyle = {
    height,
    background: loaded ? 'white' : ''
  }

  const show_desc = Boolean(desc.trim().length)
  const show_bottom_block = !hideMember || show_desc
  const none_bottom_block = !show_bottom_block

  return (
    <div
      ref={ref}
      id={`photo-${props.id}`}
      className={`image-box-wrapper ${screen} ${none_bottom_block ? 'none-bottom-block' : 'has-bottom-block'}`}
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
            style={{ opacity: loaded ? 100 : 0 }}
            onLoad={() => {
              setLoaded(true)
            }}
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
