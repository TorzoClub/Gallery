import React from 'react'
import styles from './SortSelect.module.scss'

export type SortDirection = 'asc' | 'desc'

export type SortOption<K extends string> = { value: K; label: string }

type Props<K extends string> = {
  options: ReadonlyArray<SortOption<K>>
  value: K
  direction: SortDirection
  onChange(value: K): void
  onDirectionChange(direction: SortDirection): void
  /** 整个控件的读屏名称，例如“名单排序” */
  label: string
  className?: string
}

/**
 * 排序控件：一个外壳里左边是升降序箭头（↑ 升序 / ↓ 降序，点一下切换），右边是排序字段的原生 select。
 * 箭头直接换向，不加过渡。
 */
export function SortSelect<K extends string>({ options, value, direction, onChange, onDirectionChange, label, className }: Props<K>) {
  const asc = direction === 'asc'
  return (
    <div className={className === undefined ? styles.sort : `${styles.sort} ${className}`} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.direction}
        aria-label={asc ? '升序，点击改为降序' : '降序，点击改为升序'}
        title={asc ? '升序' : '降序'}
        onClick={() => onDirectionChange(asc ? 'desc' : 'asc')}
      >
        <svg viewBox="0 0 10 12" width="10" height="12" aria-hidden>
          {asc
            ? <path d="M5 1.5v9M1.8 4.7 5 1.5l3.2 3.2" />
            : <path d="M5 10.5v-9M1.8 7.3 5 10.5l3.2-3.2" />}
        </svg>
      </button>
      <select
        className={styles.field}
        value={value}
        aria-label="排序依据"
        onChange={(event) => onChange(event.target.value as K)}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
