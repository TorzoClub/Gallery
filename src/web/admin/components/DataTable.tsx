import React, { ReactNode, useMemo, useState } from 'react'

import Icon from './Icon'
import { PageLoading } from './Feedback'

export type Column<T> = {
  key: string
  title: ReactNode
  render: (row: T, index: number) => ReactNode
  sortValue?: (row: T) => string | number
  width?: number | string
  align?: 'left' | 'center' | 'right'
  className?: string
}

type SortState = {
  key: string
  direction: 'asc' | 'desc'
}

type Props<T> = {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  loading?: boolean
  emptyText?: string
  initialSort?: SortState | null
  maxHeight?: string
  footer?: ReactNode
  rowClassName?: (row: T) => string | undefined
}

function compareValues(left: string | number, right: string | number) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }
  return String(left).localeCompare(String(right), 'zh-CN')
}

export default function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  emptyText = '暂无数据',
  initialSort = null,
  maxHeight,
  footer,
  rowClassName,
}: Props<T>) {
  const [sort, setSort] = useState<SortState | null>(initialSort)

  const sortedRows = useMemo(() => {
    if (!sort) {
      return rows
    }

    const column = columns.find(item => item.key === sort.key)
    if (!column?.sortValue) {
      return rows
    }

    const direction = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((left, right) => (
      compareValues(column.sortValue!(left), column.sortValue!(right)) * direction
    ))
  }, [columns, rows, sort])

  const toggleSort = (column: Column<T>) => {
    if (!column.sortValue) {
      return
    }

    setSort(current => {
      if (current?.key !== column.key) {
        return { key: column.key, direction: 'asc' }
      }
      return {
        key: column.key,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      }
    })
  }

  return (
    <div className="adm-table-card">
      <div className="adm-table-scroll" style={maxHeight ? { maxHeight } : undefined}>
        <table className="adm-table">
          <thead>
            <tr>
              {columns.map(column => {
                const isSorted = sort?.key === column.key
                const ariaSort = isSorted
                  ? (sort.direction === 'asc' ? 'ascending' : 'descending')
                  : 'none'

                return (
                  <th
                    key={column.key}
                    className={column.className}
                    style={{ width: column.width, textAlign: column.align ?? 'left' }}
                    aria-sort={column.sortValue ? ariaSort : undefined}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        className={isSorted ? 'adm-table__sort adm-table__sort--active' : 'adm-table__sort'}
                        onClick={() => toggleSort(column)}
                      >
                        <span>{column.title}</span>
                        <Icon name="chevron-down" size={14} className={isSorted && sort.direction === 'asc' ? 'adm-table__sort-icon--asc' : ''} />
                      </button>
                    ) : column.title}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => (
              <tr key={rowKey(row)} className={rowClassName?.(row)}>
                {columns.map(column => (
                  <td
                    key={column.key}
                    className={column.className}
                    style={{ textAlign: column.align ?? 'left' }}
                  >
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && sortedRows.length === 0 && (
          <div className="adm-table-empty">{emptyText}</div>
        )}

        {loading && (
          <div className="adm-table-loading">
            <PageLoading compact label="加载中…" />
          </div>
        )}
      </div>
      {footer}
    </div>
  )
}
