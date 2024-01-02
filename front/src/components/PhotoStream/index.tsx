import { CSSProperties, Fragment, FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './index.scss'

import PhotoBox, { CoverClickEvent, Dimension, DimensionUnknown, PhotoBoxDimension, PhotoGroupItem, postDimesions } from 'components/PhotoBox'
import { globalQueueLoad } from 'utils/queue-load'
import { Gallery, Photo } from 'api/photo'
import { PhotoStreamState } from 'components/Gallery'

import PhotoBoxStyle from '../PhotoBox/index.scss'
import { findListByProperty, updateListItem } from 'utils/common'
import useMeasure from 'hooks/useMeasure'

const SAME_HEIGHT = 272

type ColumnsHeightList = number[]

const whichMinimum = (columns: ColumnsHeightList) =>
  columns.indexOf(Math.min(...columns))

const computeColumnHeight = (list: DimessionInfo[]) =>
  list
    .map(({ height, width }) => height)
    .reduce((a, b) => a + b, 0)

type DimessionInfo = {
  id: number
  height: number
  width: number
}

const Empty: FunctionComponent<{
  horizontalOffset: CSSProperties['width']
}> = ({ horizontalOffset }) => (
  <div style={{
    textAlign: 'center',
    width: '100%',
    color: 'rgba(0, 0, 0, 0.4)',
    padding: '30px 0',
    paddingLeft: horizontalOffset,
  }}>暂无投稿作品</div>
)

export type Props = {
  hideVoteButton: boolean
  gallery: Gallery
  screen: PhotoStreamState['screen']
  gutter: PhotoStreamState['column_gutter']
  column_count: PhotoStreamState['column_count']
  total_width: PhotoStreamState['gallery_width']

  photos: Photo[]
  onClickVote(photo_id: Photo['id']): void
  onClickCover(clickInfo: CoverClickEvent, photo: Photo['id']): void

  selectedIdList: number[]
}

export default (props: Props) => {
  const {
    hideVoteButton,
    gallery,
    screen,
    column_count,
    photos,
    total_width,
    gutter = '0px',
    selectedIdList
  } = props
  const isMobile = screen === 'mobile'

  let photoStreamListWidth: CSSProperties['width']
  if (isMobile) {
    photoStreamListWidth = `${total_width} - (${gutter} * 2)`
  } else {
    photoStreamListWidth = `${total_width} + ${gutter} * ${column_count - 1}`
  }

  let boxWidth: string
  if (isMobile) {
    boxWidth = `(((${photoStreamListWidth}) / ${column_count}) - (${gutter} / ${column_count}))`
  } else {
    boxWidth = `(${total_width} / ${column_count})`
  }

  const HorizontalOffset: CSSProperties['width'] = useMemo(() => {
    if (screen === 'normal') {
      return `calc(${PhotoBoxStyle['avatar-size']} / 2)`
    } else {
      return '0px'
    }
  }, [screen])

  const dim_map_ref = useRef<Record<string, Dimension>>({})
  const [dim_latest, refreshDim] = useState(0)
  // Object.assign(window, { refreshDim })
  const refFn = useCallback((dim: DimensionUnknown, id: string, photo: { width: number, height: number }) => {
    const dim_map = dim_map_ref.current
    // console.log('refFn', dim)
    if (dim !== null) {
      const [ new_w, new_h ] = dim
      if (dim_map[String(id)]) {
        const [ old_w, old_h ] = dim_map[String(id)]
        if ((old_w !== new_w) || (old_h !== new_h)) {
          Object.assign(dim_map, {
            ...dim_map,
            [String(id)]: postDimesions(
              dim[0], dim[1],
              photo.width, photo.height
            )
          })
          refreshDim(Object.keys(dim_map).reduce((val, key) => {
            const new_val = dim_map[key]
            if (new_val) {
              const [ width, height ] = new_val
              return val + (width + height)
            } else {
              return val
            }
          }, 0))
          // dim_map({})
          // console.log('dim ref change', old_w, old_h, ...dim)
          // refreshDimMap(old => ({
          //   ...old,
          //   [String(props.id)]: postDimesions(
          //     dim[0], dim[1],
          //     props.photo.width, props.photo.height
          //   )
          // }))
        }
      } else {
        Object.assign(dim_map, {
          ...dim_map,
          [String(id)]: postDimesions(
            dim[0], dim[1],
            photo.width, photo.height
          )
        })
        refreshDim(Object.keys(dim_map).reduce((val, key) => {
          const new_val = dim_map[key]
          if (new_val) {
            const [ width, height ] = new_val
            return val + (width + height)
          } else {
            return val
          }
        }, 0))
        // refreshDimMap(old => ({
        //   ...old,
        //   [String(props.id)]: postDimesions(
        //     dim[0], dim[1],
        //     props.photo.width, props.photo.height
        //   )
        // }))
      }
    } else {
      // refreshDimMap(old => {
      //   const new_dim_map = { ...old }
      //   delete new_dim_map[String(props.id)]
      //   return new_dim_map
      // })
    }
  }, [])

  const photo_stream_columns = useMemo(() => {
    const dim_map = dim_map_ref.current
    console.log('dim_map', { ...dim_map })

    const init_columns: DimessionInfo[][] = Array.from(Array(column_count)).map(() => [])
    return photos.reduce((columns, photo) => {
      const height_list = columns.map(col => {
        return computeColumnHeight(col)
      })

      const min_height_index = whichMinimum(height_list)

      return columns.map((col, idx) => {
        if (idx === min_height_index) {
          const dim = dim_map[photo.id]
          if (dim) {
            const [ width, height ] = dim
            return [...col, { id: photo.id, width, height }]
          } else {
            return col
          }
        } else {
          return col
        }
      })
    }, init_columns)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dim_latest, column_count, photos])

  type PosMap = {
    [K: number]: {
      top: string
      left: string
      zIndex: number
    }
  }
  const pos_map: PosMap = useMemo(() => {
    console.log('photo_stream_columns', photo_stream_columns)

    const init_pos: PosMap = {}
    return photo_stream_columns.reduce((pos_info, column, x) => {
      const left = `(${boxWidth} * ${x} + ${gutter} * ${x})`
      return column.reduce((pos_info, heightInfo, y) => {
        const h = computeColumnHeight(column.slice(0, y))
        const top = `${h}px`
        return {
          ...pos_info,
          [heightInfo.id]: { top, left, zIndex: h }
        }
      }, pos_info)
    }, init_pos)
  }, [boxWidth, gutter, photo_stream_columns])

  const photo_stream_height = useMemo(() => {
    const height_list = photo_stream_columns.map(col => {
      return computeColumnHeight(col)
    })
    return Math.max(...height_list)
  }, [photo_stream_columns])

  return (
    <div
      className={`photo-stream ${screen}`}
      style={{
        width: `calc(${photoStreamListWidth})`,
        height: `${photo_stream_height}px`,
        paddingRight: HorizontalOffset,
      }}
    >
      {
        (photos.length === 0) ? (
          <Empty horizontalOffset={HorizontalOffset} />
        ) : (
          <>
            {photos.map(photo => {
              return (
                <PhotoBoxDimension
                  key={`${photo.id}`}
                  style={{
                    top: pos_map[photo.id] && `calc(${pos_map[photo.id].top})`,
                    left: pos_map[photo.id] && `calc(${pos_map[photo.id].left})`,
                    zIndex: pos_map[photo.id] && `calc(${pos_map[photo.id].zIndex})`,
                    // transition: pos_map[photo.id] && 'left 382ms, top 382ms'
                  }}
                  ref={(dim) => {
                    refFn(dim, String(photo.id), { width: photo.width, height: photo.height, })
                  }}
                  {...{
                    id: photo.id,
                    screen,
                    gutter,
                    boxWidth,
                    hideVoteButton,
                    hideMember: !photo.member,
                    voteIsHighlight: selectedIdList && (selectedIdList.indexOf(photo.id) !== -1),
                    name: photo.member ? photo.member.name : null,
                    desc: photo.desc,
                    photo: {
                      width: photo.width,
                      height: photo.height,
                      src: photo.src_url,
                      thumb: photo.thumb_url,
                    },
                    avatar: photo.member ? {
                      width: 0,
                      height: 0,
                      thumb: photo.member.avatar_thumb_url,
                      src: photo.member.avatar_thumb_url,
                    } : null,
                    handleClickVote: () => {
                      props.onClickVote(photo.id)
                    },
                    onClickCover: (fromInfo) => {
                      props.onClickCover(fromInfo, photo.id)
                    },
                  }}
                />
              )
            })}
          </>
        )
      }
    </div>
  )
}
