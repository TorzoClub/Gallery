import { CSSProperties, Fragment, FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Memo, MemoGetter, MemoSetter, Signal, nextTick } from 'new-vait'
import { Gallery, Photo } from 'api/photo'

import './index.scss'
import PhotoBoxStyle from '../PhotoBox/index.scss'

import { PhotoStreamLayout } from 'components/Gallery'
import { CoverClickEvent, Dimension, DimensionUnknown, PhotoBoxDimension, PhotoGroupItem, postDimesions } from 'components/PhotoBox'

import useSafeState from 'hooks/useSafeState'

type PosMap = {
  [K: number]: {
    top: string
    left: string
    zIndex: number
  }
}

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
  photoStreamLayout: PhotoStreamLayout

  photos: Photo[]
  onClickVote(photo_id: Photo['id']): void
  onClickCover(clickInfo: CoverClickEvent, photo: Photo['id']): void

  selectedIdList: number[]
}

function calcTotalWidth(
  column_count: number,
  column_gutter: number,
  gallery_width: number,
) {
  const gutter_total_len = column_gutter * (column_count - 1)
  const box_width = (gallery_width - gutter_total_len) / column_gutter
  const total_width = box_width + gutter_total_len
  return [ total_width, box_width, gutter_total_len ]
}

export default (props: Props) => {
  const {
    hideVoteButton,
    photoStreamLayout,
    photos,
    selectedIdList
  } = props
  const {
    screen,
    column_count,
    column_gutter = '0px',
    gallery_width: total_width,
  } = photoStreamLayout
  const isMobile = screen === 'mobile'

  let photo_stream_width: CSSProperties['width']
  if (isMobile) {
    if (column_count > 2) {
      photo_stream_width = `${total_width} + ${column_gutter} * ${column_count - 1}`
    } else {
      photo_stream_width = `${total_width} - (${column_gutter} * 2)`
    }
  } else {
    photo_stream_width = `${total_width} + ${column_gutter} * ${column_count - 1}`
  }

  let box_width: string
  if (isMobile) {
    if (column_count > 2) {
      box_width = `(${total_width} / ${column_count})`
    } else {
      box_width = `(((${photo_stream_width}) / ${column_count}) - (${column_gutter} / ${column_count}))`
    }
  } else {
    box_width = `(${total_width} / ${column_count})`
  }

  const { refFn, photo_stream_height, pos_map } = useRefreshLayout({
    photos, box_width, photoStreamLayout
  })

  return (
    <div className="photo-stream-wrap" style={{
      width: `calc(${photo_stream_width})`,
      margin: 'auto',
    }}>
      {(photos.length === 0) ? (
        <Empty horizontalOffset={0} />
      ) : (
        <div
          className={`photo-stream ${screen}`}
          style={{
            width: '100%',
            height: `${photo_stream_height}px`
          }}
        >
          {
            <>
              {photos.map(photo => {
                return (
                  <PhotoBoxDimension
                    key={`${photo.id}`}
                    style={{
                      top: pos_map[photo.id] && `calc(${pos_map[photo.id].top})`,
                      left: pos_map[photo.id] && `calc(${pos_map[photo.id].left})`,
                      zIndex: pos_map[photo.id] && `calc(${pos_map[photo.id].zIndex})`,
                      opacity: pos_map[photo.id] ? 1 : 0,
                      // transition: pos_map[photo.id] && 'left 382ms, top 382ms'
                    }}
                    ref={(dim) => {
                      refFn(dim, String(photo.id), { width: photo.width, height: photo.height, })
                    }}
                    {...{
                      id: photo.id,
                      // photoStreamLayout,
                      screen,
                      column_gutter,
                      boxWidth: box_width,
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
          }
        </div>
      )}
    </div>
  )
}

function useRefreshLayout({
  photos,
  box_width,
  photoStreamLayout: {
    column_count,
    column_gutter,
  }
}: {
  photoStreamLayout: PhotoStreamLayout
  box_width: string
  photos: Photo[]
}) {
  const [ refFn, dim_map_changed_signal, getDimMap ] = useDimensionMap()

  const getPhotoStreamColumns = useCallback(() => {
    const dim_map = getDimMap()

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
  }, [column_count, getDimMap, photos])

  const [pos_map, refreshPosMap] = useSafeState<PosMap>({})
  const calcPosMap = useCallback(() => {
    const init_pos: PosMap = {}
    return getPhotoStreamColumns().reduce((pos_info, column, x) => {
      const left = `(${box_width} * ${x} + ${column_gutter} * ${x})`
      return column.reduce((pos_info, heightInfo, y) => {
        const h = computeColumnHeight(column.slice(0, y))
        const top = `${h}px`
        return {
          ...pos_info,
          [heightInfo.id]: { top, left, zIndex: h }
        }
      }, pos_info)
    }, init_pos)
  }, [box_width, getPhotoStreamColumns, column_gutter])

  const [ photo_stream_height, setPhotoStreamHeight ] = useSafeState(0)
  const computePhotoStreamHeight = useCallback(() => {
    const height_list = getPhotoStreamColumns().map(col => {
      return computeColumnHeight(col)
    })
    return Math.max(...height_list)
  }, [getPhotoStreamColumns])

  const refreshLayout = useCallback(() => {
    const dim_map = getDimMap()
    refreshPosMap(calcPosMap())
    setPhotoStreamHeight(computePhotoStreamHeight())
  }, [calcPosMap, computePhotoStreamHeight, getDimMap, refreshPosMap, setPhotoStreamHeight])

  useEffect(() => {
    dim_map_changed_signal.receive(refreshLayout)
    return () => dim_map_changed_signal.cancelReceive(refreshLayout)
  }, [dim_map_changed_signal, refreshLayout])

  useEffect(refreshLayout, [refreshLayout])

  return {
    refFn,
    photo_stream_height, pos_map
  } as const
}

function useDimensionMap() {
  const dim_map_changed_signal = useMemo(() => Signal(), [])
  const dim_map_ref = useRef(
    Memo<Record<string, Dimension>>({})
  )
  const getDimMap = useCallback(() => {
    const [ getDimMap ] = dim_map_ref.current
    return getDimMap()
  }, [])
  const setDimMap = useCallback<MemoSetter<Record<string, Dimension>>>((...args) => {
    const [ ,setDimMap ] = dim_map_ref.current
    return setDimMap(...args)
  }, [])

  const refFn = useCallback((dim: DimensionUnknown, id: string, photo: { width: number, height: number }) => {
    const dim_map = getDimMap()
    if (dim !== null) {
      const [ new_w, new_h ] = dim
      if (dim_map[id]) {
        const [ old_w, old_h ] = dim_map[id]
        if ((old_w !== new_w) || (old_h !== new_h)) {
          setDimMap({
            ...dim_map,
            [String(id)]: postDimesions(
              dim[0], dim[1],
              photo.width, photo.height
            )
          })
          dim_map_changed_signal.trigger()
        }
      } else {
        setDimMap({
          ...dim_map,
          [id]: postDimesions(
            dim[0], dim[1],
            photo.width, photo.height
          )
        })
        dim_map_changed_signal.trigger()
      }
    } else {
      const new_dim_map = { ...dim_map }
      delete new_dim_map[String(id)]
      setDimMap(new_dim_map)
    }
  }, [dim_map_changed_signal, getDimMap, setDimMap])

  return [ refFn, dim_map_changed_signal, getDimMap ] as const
}
