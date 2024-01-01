import { forwardRef, useState, useEffect, useRef, CSSProperties, useCallback, FunctionComponent, useMemo } from 'react'
import heartIMG from 'assets/heart.png'
import heartHighlightIMG from 'assets/heart-highlight.png'
import style from './index.scss'

import { global_cache, useQueueload } from 'utils/queue-load'
import useMeasure from 'hooks/useMeasure'
import { Photo } from 'api/photo'

type DimensionUnknown = Dimension | null
type Dimension = readonly [number, number]
const postDimesions = (
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
export type PhotoGroupItem = {
  pb_node: JSX.Element
  dim: Dimension
  props: Props
}
export const usePhotoBoxGroup = (props_list: Props[]): PhotoGroupItem[] => {
  const [dim_map, refreshDimMap] = useState<Record<string, Dimension>>({})

  const dim_list = props_list.map(props => {
    const dim = dim_map[String(props.id)]
    if (dim === undefined) {
      return [props.photo.width, props.photo.height] as const
    } else {
      return dim
    }
  })

  const refFn = useCallback((dim: DimensionUnknown, props: Props) => {
    if (dim !== null) {
      const [ new_w, new_h ] = dim
      if (dim_map[String(props.id)]) {
        const [ old_w, old_h ] = dim_map[String(props.id)]
        if ((old_w !== new_w) || (old_h !== new_h)) {
          refreshDimMap(old => ({
            ...old,
            [String(props.id)]: postDimesions(
              dim[0], dim[1],
              props.photo.width, props.photo.height
            )
          }))
        }
      } else {
        refreshDimMap(old => ({
          ...old,
          [String(props.id)]: postDimesions(
            dim[0], dim[1],
            props.photo.width, props.photo.height
          )
        }))
      }
    } else {
      refreshDimMap(old => {
        const new_dim_map = { ...old }
        delete new_dim_map[String(props.id)]
        return new_dim_map
      })
    }
  }, [dim_map])

  const pb_list = props_list.map(props => (
    <PhotoBoxHeight
      {...props}
      ref={dim => refFn(dim, props)}
    />
  ))

  return pb_list.map((pb_node, idx) => {
    return { pb_node, dim: dim_list[idx], props: props_list[idx] }
  })
}

const PhotoBoxHeight = forwardRef< DimensionUnknown, Props>((props, ref) => {
  const [measure_ref, dimensions] = useMeasure()

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

  useEffect(() => {
    setRef(dimensions)
  }, [dimensions, setRef])

  return <PhotoBox {...props} ref={measure_ref} />
})

const PhotoBox = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { screen, gutter, boxWidth, photo, hideMember, avatar, desc } = props

  const [thumb_loaded, thumb] = useQueueload(photo.thumb)
  const [avatar_loaded, avatarThumb] = useQueueload(avatar?.thumb)

  const coverFrameEl = useRef<HTMLDivElement>(null)

  const ratio = (photo.height / photo.width).toFixed(4)

  const isMobile = screen === 'mobile'

  let height: CSSProperties['height']
  if (isMobile) {
    height = `calc((${boxWidth} - ${gutter} / 2) * ${ratio})`
  } else {
    height = `calc((${boxWidth} - ${style['avatar-size']} / 2) * ${ratio})`
  }

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
