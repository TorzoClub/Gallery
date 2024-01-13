import { FunctionComponent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Memo, MemoGetter, MemoSetter, Signal, nextTick } from 'new-vait'
import { Photo } from 'api/photo'

import './index.scss'

import PhotoBox, { Props as PhotoBoxProps, CoverClickEvent, Dimension, DimensionUnknown, postDimesions } from 'components/PhotoBox'

import useSafeState from 'hooks/useSafeState'
import { findListByProperty } from 'utils/common'
import { AppCriticalError } from 'App'

type Pos = {
  top: string
  left: string
  zIndex: number
}
type PhotoID = number
type PosMap = Record<PhotoID, Pos>

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

export type WaterfallLayoutClickCoverHandler = (clickInfo: CoverClickEvent, photo: Photo['id']) => void

export type Props = {
  show_vote_button: boolean
  layout_configure: WaterfallLayoutConfigure
  cannot_select_vote: boolean

  photos: Photo[]
  onClickVote(photo_id: Photo['id']): void
  onClickCover: WaterfallLayoutClickCoverHandler

  selected_id_list: number[]
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
    show_vote_button,
    layout_configure,
    photos,
    selected_id_list
  } = props
  const { box_type, vertial_gutter, gallery_width } = layout_configure
  const [ box_width ] = calcTotalBoxWidth(layout_configure)

  const { refFn, waterfall_height, pos_map, refresh_signal } = useLayout({
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
        // transition: pos && 'left 382ms, top 382ms'
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
              <PhotoBox
                key={String(photo.id)}
                style={posStyle(photo.id)}
                ref={getDim => refFn(getDim, String(photo.id), photo)}
                handleClickVote={() => props.onClickVote(photo.id)}
                onClickCover={(click_info) => props.onClickCover(click_info, photo.id)}
                {...{
                  id: photo.id,
                  type: box_type,
                  vertial_gutter,
                  box_width,
                  show_vote_button: show_vote_button,
                  hideMember: !photo.member,
                  vote_button_status: (
                    (selected_id_list && (selected_id_list.indexOf(photo.id) !== -1)) ?
                    'selected' :
                    (props.cannot_select_vote ? 'cannot-select' : 'un-selected')
                  ),
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

type Columns = DimessionInfo[][]
type DimOperateResult = readonly[undefined | DimessionInfo, Columns]

function countDim(cols: Columns) {
  let total = 0
  for (let i = 0; i < cols.length; ++i) {
    total = total + cols[i].length
  }
  return total
}

function toHeightList(cols: Columns): ColumnsHeightList {
  return cols.map(dim => computeColumnHeight(dim))
}

function popColumn(cols: Columns, select_col: number): readonly [DimessionInfo | undefined, Columns] {
  return dropDim(cols, select_col, cols[select_col].length - 1)
}

function whichMaxniumColumnSafe(cols: Columns): undefined | number {
  if (countDim(cols) <= cols.length) {
    return undefined
  } else {
    const top_dim_removed = cols.map(col => {
      return col.slice(1, col.length)
    })
    const h_list = top_dim_removed.map((col, idx) => {
      if (col.length) {
        return computeColumnHeight(cols[idx])
      } else {
        return 0
      }
    })
    const max_height = Math.max(...h_list)
    const max_col = h_list.indexOf(max_height)
    if (top_dim_removed[max_col].length === 0) {
      return undefined
    } else {
      if (cols[max_col].length === 0) {
        return undefined
      } else {
        return max_col
      }
    }
  }
}

function dropDim(
  cols: Columns,
  select_col: number,
  select_idx: number,
): DimOperateResult {
  let selected: DimessionInfo | undefined = undefined

  const droped = cols.map((col, col_idx) => {
    if (select_col !== col_idx) {
      return col
    } else {
      return col.filter((dim, idx) => {
        if (select_idx !== idx) {
          return true
        } else {
          selected = dim
          return false
        }
      })
    }
  })

  return [ selected, droped ] as const
}

function columnsPopSafe(cols: Columns): DimOperateResult {
  if (countDim(cols) <= cols.length) {
    return [undefined, cols]
  } else {
    const select_cols = cols.map(col => {
      return col.slice(1, col.length)
    })
    const h_list = select_cols.map((col, idx) => {
      if (col.length) {
        return computeColumnHeight(cols[idx])
      } else {
        return 0
      }
    })
    const max_height = Math.max(...h_list)
    const max_idx = h_list.indexOf(max_height)
    if (select_cols[max_idx].length === 0) {
      return [undefined, cols]
    } else {
      return dropDim(cols, max_idx, cols[max_idx].length - 1)
    }
  }
}

function isBalanced(cols: Columns) {
  if (countDim(cols) <= cols.length) {
    return true
  } else if (toHeightList(cols).includes(0)) {
    return false
  } else {
    const max_column = whichMaxniumColumnSafe(cols)
    if (max_column === undefined) {
      return true
    } else {
      const [ , poped_cols ] = popColumn(cols, max_column)
      return max_column === whichMinimum(toHeightList(poped_cols))
    }
  }
}

function toDimList(cols: Columns) {
  return cols.flat()
}

function toDimListWithSorted(cols: Columns) {
  return cols
    .map(
      col => col.map(
        (dim, idx) => ({
          dim,
          height: computeColumnHeight( col.slice(0, idx) )
        })
      )
    )
    .flat()
    .sort(
      (a, b) => (a.height < b.height) ? -1 : 1
    )
    .map(h => h.dim)
}

function filterByIDList(dim_list: DimessionInfo[], id_list: Set<number>) {
  return dim_list.filter(
    dim => id_list.has(dim.id)
  )
}

function toIDList(dim_list: DimessionInfo[]) {
  const exists = new Set<number>()
  for (const d of dim_list) { exists.add(d.id) }
  return exists
}

function appendDim(cols: Columns, dim: DimessionInfo) {
  const height_list = cols.map(col => {
    return computeColumnHeight(col)
  })

  const min_height_index = whichMinimum(height_list)
  return cols.map((col, idx) => {
    if (min_height_index === idx) {
      return [...col, dim]
    } else {
      return col
    }
  })
}

function appendMultiDim(cols: Columns, dim_list: DimessionInfo[]) {
  return dim_list.reduce((cols, dim) => {
    return appendDim(cols, dim)
  }, cols)
}

function concatColumns(left: Columns, right: Columns): Columns {
  return [...left, ...right]
}

function addColumn(cols: Columns, col: DimessionInfo[]) {
  return [...cols, col]
}

function columnCount(cols: Columns) {
  return cols.length
}

function selectColumns(cols: Columns, from: number, to: number) {
  return cols.slice(from, to)
}

function createPlainColumns(col_count: number): Columns {
  return Array.from(Array(col_count)).map(() => [])
}

function extendColumns(col_count: number, cols: Columns) {
  let new_cols = createPlainColumns(col_count).map((_, idx) => {
    const col: DimessionInfo[] | undefined = cols[idx]
    if (col) {
      return col
    } else {
      return []
    }
  })

  let count = 0
  while (!isBalanced(new_cols)) {
    ++count
    const [ dim, droped_cols ] = columnsPopSafe(new_cols)
    if (dim === undefined) {
      throw Error('dim is undefined')
    } else {
      new_cols = appendDim(droped_cols, dim)
    }

    if (count > 10000) {
      AppCriticalError('count over 10000')
      throw Error('count over 10000')
    }
  }
  return new_cols
}

function adjustColumns(target_column: number, cols: Columns): Columns {
  const current_column = cols.length
  if (target_column > current_column) {
    const extended = extendColumns(target_column, cols)
    return (
      concatColumns(
        selectColumns(extended, 0, current_column),
        appendMultiDim(
          createPlainColumns(target_column - current_column),
          filterByIDList(
            toDimListWithSorted(cols),
            toIDList(
              toDimList(
                selectColumns(extended, current_column, target_column)
              )
            )
          )
        )
      )
    )
  } else if (target_column < current_column) {
    return (
      appendMultiDim(
        selectColumns(cols, 0, target_column),
        toDimListWithSorted(
          selectColumns(cols, target_column, current_column)
        )
      )
    )
  } else {
    return cols
  }
}

function updateColumnsKeepPosition(prev_cols: Columns, latest_cols: Columns): Columns {
  const latest_list = toDimListWithSorted(latest_cols)

  const exists_list = new Set<number>()

  const keep_pos_cols = prev_cols.reduce<Columns>((left_cols, col) => {
    return addColumn(
      left_cols,
      col
        .filter(dim => {
          const idx = findListByProperty(latest_list, 'id', dim.id)
          if (idx !== -1) {
            exists_list.add(dim.id)
            return true
          } else {
            return false
          }
        })
        .map(dim => {
          const idx = findListByProperty(latest_list, 'id', dim.id)
          return latest_list[idx]
        })
    )
  }, [])

  return appendMultiDim(
    keep_pos_cols,
    latest_list.filter(dim => {
      return exists_list.has(dim.id) !== true
    })
  )
}

function mergeColumns(prev_cols: Columns, latest_cols: Columns) {
  if (columnCount(prev_cols) === 0) {
    return latest_cols
  } else {
    return adjustColumns(
      columnCount(latest_cols),
      updateColumnsKeepPosition(prev_cols, latest_cols)
    )
  }
}

function computeWaterfallHeight(waterfall_columns: Columns) {
  return Math.max(...toHeightList(waterfall_columns))
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
  const [ refresh_signal ] = useState(Signal())
  const [ refFn, dim_map_changed_signal, getDimMap ] = useDimensionMap(
    useCallback(() => {
      refresh_signal.trigger()
    }, [refresh_signal])
  )

  const computeWaterfallColumns = useCallback((
    photos: Photo[],
    column_count: number,
    dim_map: DimensionMap
  ) => {
    return photos.reduce((columns, photo) => {
      const height_list = columns.map(col => {
        return computeColumnHeight(col)
      })

      const min_height_index = whichMinimum(height_list)

      return columns.map((col, idx) => {
        if (idx === min_height_index) {
          const dim = dim_map[photo.id]
          if (dim) {
            const [ width, height ] = dim()
            return [...col, { id: photo.id, width, height }]
          } else {
            return col
          }
        } else {
          return col
        }
      })
    }, createPlainColumns(column_count))
  }, [])

  const [pos_map, refreshPosMap] = useSafeState<PosMap>({})
  const computePosMap = useCallback((waterfall_columns: Columns) => {
    const init_pos: PosMap = {}

    return waterfall_columns.reduce((column_pos_init, column, x) => {
      const left = `(${box_width}px * ${x} + ${column_gutter}px * ${x})`

      return column.reduce((pos_info, heightInfo, y) => {
        const h = computeColumnHeight(column.slice(0, y))
        return {
          ...pos_info,
          [heightInfo.id]: {
            top: `${h}px`,
            left,
            zIndex: h
          }
        }
      }, column_pos_init)
    }, init_pos)
  }, [box_width, column_gutter])

  const [ waterfall_height, refreshWaterfallHeight ] = useSafeState(0)

  const cacheID = (...vals: number[]) => vals.join('-')

  const columns_cache = useRef<Map<string, Columns>>()

  const prev_columns = useRef<Columns>([])

  const applyNewLayout = useCallback((new_cols: Columns) => {
    prev_columns.current = new_cols
    refreshPosMap( computePosMap(new_cols) )
    refreshWaterfallHeight( computeWaterfallHeight(new_cols) )
    refresh_signal.trigger()
  }, [computePosMap, refreshPosMap, refreshWaterfallHeight, refresh_signal])

  const refreshLayout = useCallback(() => {
    if (columns_cache.current !== undefined) {
      const cache_id = cacheID(box_width, column_count, column_gutter)
      const cached = columns_cache.current.get(cache_id)
      if (cached) {
        applyNewLayout(cached)
      } else {
        const latest_columns = computeWaterfallColumns(
          photos, column_count, getDimMap()
        )
        const merged = mergeColumns(prev_columns.current, latest_columns)
        columns_cache.current.set(cache_id, merged)
        applyNewLayout(merged)
      }
    } else {
      applyNewLayout(
        mergeColumns(
          prev_columns.current,
          computeWaterfallColumns(
            photos, column_count, getDimMap()
          )
        )
      )
    }
  }, [applyNewLayout, box_width, column_count, column_gutter, computeWaterfallColumns, getDimMap, photos])

  useEffect(() => {
    if (columns_cache.current === undefined) {
      columns_cache.current = new Map()
    }
    refreshLayout()
  }, [refreshLayout])

  return {
    refFn,
    pos_map,
    waterfall_height,
    refresh_signal,
  } as const
}

type DimensionMap = Record<string, () => Dimension>
function useDimensionMap(onDimChange: () => void) {
  const dim_map_changed_signal = useMemo(() => Signal(), [])
  const dim_map_ref = useRef(
    Memo<DimensionMap>({})
  )
  const getDimMap = useCallback(() => {
    const [ getDimMap ] = dim_map_ref.current
    return getDimMap()
  }, [])
  const setDimMap = useCallback<MemoSetter<Record<string, () => Dimension>>>((...args) => {
    const [ ,setDimMap ] = dim_map_ref.current
    return setDimMap(...args)
  }, [])

  const refFn = useCallback((getDim: null | (() => Dimension), id: string, photo: { width: number, height: number }) => {
    const dim_map = getDimMap()

    if (getDim !== null) {
      setDimMap({
        ...dim_map,
        [String(id)]: getDim
      })
    }
  }, [getDimMap, setDimMap])

  return [ refFn, dim_map_changed_signal, getDimMap ] as const
}
