import React, { useRef, type CSSProperties } from 'react'
import Popover from '../../../components/Popover'
import { formatDateTime } from '../../../admin/utils/date'
import {
  createMagnetOffset,
  type PhotoSortBy,
  type PhotoSortDirection,
  getVoteMagnetLayout,
  getVoteMagnetValues,
  type PhotoVoteRecord,
} from './photo-votes'
import { SortSelect, type SortOption } from './SortSelect'
import styles from './VoteMagnets.module.scss'

const PHOTO_SORT_OPTIONS: ReadonlyArray<SortOption<PhotoSortBy>> = [
  { value: 'created_at', label: '投稿时间' },
  { value: 'vote_count', label: '获票数' },
]

type Props = {
  photo_id: number
  records: readonly PhotoVoteRecord[]
  cover_width: number
  cover_height: number
}

function Magnet({ value, scattered = false, offsetScale = 1 }: {
  value: 1 | 5
  scattered?: boolean
  offsetScale?: number
}) {
  const offset = useRef<ReturnType<typeof createMagnetOffset> | null>(null)
  const element = useRef<HTMLSpanElement>(null)
  React.useLayoutEffect(() => {
    if (element.current === null) {
      return
    }
    if (!scattered) {
      element.current.style.transform = ''
      return
    }
    offset.current ??= createMagnetOffset()
    element.current.style.transform = `translate(${offset.current.x * offsetScale}px, ${offset.current.y * offsetScale}px)`
  }, [scattered, offsetScale])

  return (
    <span
      ref={element}
      className={`${styles.magnet} ${value === 5 ? styles.five : styles.one}`}
      aria-hidden='true'
    />
  )
}

type LegendProps = {
  sort_by: PhotoSortBy
  direction: PhotoSortDirection
  onSortByChange(value: PhotoSortBy): void
  onDirectionChange(value: PhotoSortDirection): void
}

export function VoteMagnetLegend({ sort_by, direction, onSortByChange, onDirectionChange }: LegendProps) {
  return (
    <div className={styles.legend} aria-label='投票磁粒图例'>
      <SortSelect
        label='相片展示排序'
        options={PHOTO_SORT_OPTIONS}
        value={sort_by}
        direction={direction}
        onChange={onSortByChange}
        onDirectionChange={onDirectionChange}
      />
      <span className={styles.legendItem}><Magnet value={1} />1 票</span>
      <span className={styles.legendItem}><Magnet value={5} />5 票</span>
    </div>
  )
}

function PhotoVoteRecords({
  photo_id,
  records,
  onClose,
}: Pick<Props, 'photo_id' | 'records'> & { onClose(): void }) {
  return (
    <section
      className={styles.records}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.stopPropagation()
        }
      }}
    >
      <header className={styles.heading}>
        <strong>投票记录 · {records.length} 票</strong>
        <button type='button' className={styles.close} onClick={onClose}>关闭</button>
      </header>
      <p className={styles.caption}>相片 #{photo_id} · 按投票时间从新到旧</p>
      {records.length === 0
        ? <p className={styles.empty}>这张相片还没有收到投票</p>
        : (
          <ol className={styles.recordList} tabIndex={0} aria-label='投票人及投票时间'>
            {records.map(({ vote, member }) => (
              <li key={vote.id} className={styles.record}>
                {member === null
                  ? <span className={styles.avatarFallback} aria-hidden='true'>?</span>
                  : <img className={styles.avatar} src={member.avatar_thumb_url} alt='' loading='lazy' />}
                <div className={styles.voter}>
                  <strong>{member?.name ?? `未知成员 #${vote.member_id}`}</strong>
                  {member !== null && <span>QQ {member.qq_num}</span>}
                  <time dateTime={vote.created_at}>{formatDateTime(vote.created_at)}</time>
                </div>
                <span className={styles.recordCount}>1 票</span>
              </li>
            ))}
          </ol>
        )}
    </section>
  )
}

export default function VoteMagnets({ photo_id, records, cover_width, cover_height }: Props) {
  const values = getVoteMagnetValues(records.length)
  const layout = getVoteMagnetLayout(values.length, cover_width, cover_height)
  const label = `相片 #${photo_id}：${records.length} 票，查看投票记录`

  return (
    <Popover
      label={`相片 #${photo_id} 的投票记录`}
      align='end'
      trigger={(
        <button
          type='button'
          className={`${styles.trigger} ${values.length === 0 ? styles.zero : ''}`}
          aria-label={label}
          title={label}
          style={{
            top: layout.inset,
            right: layout.inset,
            width: layout.width,
            height: layout.height,
            gridTemplateColumns: `repeat(${layout.columns}, ${layout.diameter}px)`,
            gap: layout.gap,
            fontSize: layout.font_size,
            '--magnet-size': `${layout.diameter}px`,
          } as CSSProperties}
        >
          {values.length === 0
            ? <span aria-hidden='true'>0 票</span>
            : values.map((value, index) => (
              <Magnet
                key={`${value}-${value === 1 ? index : index - records.length % 5}`}
                value={value}
                scattered
                offsetScale={Math.min(1, layout.inset / 3)}
              />
            ))}
        </button>
      )}
      content={close => <PhotoVoteRecords photo_id={photo_id} records={records} onClose={close} />}
    />
  )
}
