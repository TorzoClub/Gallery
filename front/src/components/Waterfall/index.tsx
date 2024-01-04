import { FunctionComponent, memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { Memo, MemoGetter, MemoSetter, Signal, nextTick } from 'new-vait'
import { Photo } from 'api/photo'

import './index.scss'

import { Props as PhotoBoxProps, CoverClickEvent, Dimension, DimensionUnknown, PhotoBoxDimension, postDimesions } from 'components/PhotoBox'

import useSafeState from 'hooks/useSafeState'

type Pos = {
  top: string
  left: string
  zIndex: number
}

type PosMap = Record<number, Pos>

const Empty: FunctionComponent = memo(() => (
  <div style={{
    textAlign: 'center',
    paddingTop: '30px',
    width: '100%',
    color: 'rgba(0, 0, 0, 0.4)',
  }}>暂无投稿作品</div>
))

export type WaterfallLayoutConfigure = {
  box_type: PhotoBoxProps['type']
  vertial_gutter: PhotoBoxProps['vertial_gutter']
  column_count: number
  gallery_width: number
  column_gutter: number
}

export type Props = {
  hideVoteButton: boolean
  layout_configure: WaterfallLayoutConfigure

  photos: Photo[]
  onClickVote(photo_id: Photo['id']): void
  onClickCover(clickInfo: CoverClickEvent, photo: Photo['id']): void

  selectedIdList: number[]
}

function calcTotalBoxWidth({
  column_count,
  column_gutter,
  gallery_width,
}: WaterfallLayoutConfigure) {
  const gutter_total_len = column_gutter * (column_count - 1)
  const box_width = (gallery_width - gutter_total_len) / column_count
  return [ box_width, gutter_total_len ] as const
}

export default (props: Props) => {
  const {
    hideVoteButton,
    layout_configure,
    photos,
    selectedIdList
  } = props
  const { box_type, vertial_gutter, gallery_width } = layout_configure
  const [ box_width ] = calcTotalBoxWidth(layout_configure)

  const { refFn, waterfall_height, pos_map } = useLayout({
    photos, box_width, layout_configure
  })

  const posStyle = useCallback((id: Photo['id']) => {
    const pos: Pos | undefined = pos_map[id]
    if (pos) {
      return {
        top: `calc(${pos.top})`,
        left: `calc(${pos.left})`,
        zIndex: `calc(${pos.zIndex})`,
        opacity: 1,
        // transition: pos_map[photo.id] && 'left 382ms, top 382ms'
      }
    } else {
      return { opacity: 0 }
    }
  }, [pos_map])

  return (
    <div className="waterfall-wrap" style={{
      width: `${gallery_width}px`,
      margin: 'auto',
      minHeight: '150px',
    }}>
      {(photos.length === 0) ? (
        <Empty />
      ) : (
        <div
          className="waterfall"
          style={{
            width: '100%',
            height: `${waterfall_height}px`
          }}
        >
          {
            photos.map(photo => (
              <PhotoBoxDimension
                key={String(photo.id)}
                style={posStyle(photo.id)}
                ref={dim => refFn(dim, String(photo.id), photo)}
                handleClickVote={() => props.onClickVote(photo.id)}
                onClickCover={(click_info) => props.onClickCover(click_info, photo.id)}
                {...{
                  id: photo.id,
                  type: box_type,
                  vertial_gutter,
                  box_width,
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
                }}
              />
            ))
          }
        </div>
      )}
    </div>
  )
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

function useLayout({
  photos,
  box_width,
  layout_configure: {
    column_count,
    column_gutter,
  }
}: {
  layout_configure: WaterfallLayoutConfigure
  box_width: number
  photos: Photo[]
}) {
  const [ refFn, dim_map_changed_signal, getDimMap ] = useDimensionMap()

  const getWaterfallColumns = useCallback(() => {
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
    return getWaterfallColumns().reduce((pos_info, column, x) => {
      const left = `(${box_width}px * ${x} + ${column_gutter}px * ${x})`
      return column.reduce((pos_info, heightInfo, y) => {
        const h = computeColumnHeight(column.slice(0, y))
        const top = `${h}px`
        return {
          ...pos_info,
          [heightInfo.id]: { top, left, zIndex: h }
        }
      }, pos_info)
    }, init_pos)
  }, [box_width, getWaterfallColumns, column_gutter])

  const [ waterfall_height, refreshWaterfallHeight ] = useSafeState(0)
  const computeWaterfallHeight = useCallback(() => {
    const height_list = getWaterfallColumns().map(col => {
      return computeColumnHeight(col)
    })
    return Math.max(...height_list)
  }, [getWaterfallColumns])

  const refreshLayout = useCallback(() => {
    const dim_map = getDimMap()
    refreshPosMap(calcPosMap())
    refreshWaterfallHeight(computeWaterfallHeight())
  }, [calcPosMap, computeWaterfallHeight, getDimMap, refreshPosMap, refreshWaterfallHeight])

  useEffect(() => {
    dim_map_changed_signal.receive(refreshLayout)
    return () => dim_map_changed_signal.cancelReceive(refreshLayout)
  }, [dim_map_changed_signal, refreshLayout])

  useEffect(refreshLayout, [refreshLayout])

  return {
    refFn,
    waterfall_height, pos_map
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
