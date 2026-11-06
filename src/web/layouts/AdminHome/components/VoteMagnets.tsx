import React, { useEffect, useRef, useState, type CSSProperties } from 'react'
import Popover from '../../../components/Popover'
import { Magnet as MagnetDot } from '../../../components/Magnet'
import { formatDateTime } from '../../../admin/utils/date'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import { signal_critical_error } from '../../../signals'
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

  return <MagnetDot ref={element} value={value} className={styles.dot} />
}

type LegendProps = {
  sort_by: PhotoSortBy
  direction: PhotoSortDirection
  onSortByChange(value: PhotoSortBy): void
  onDirectionChange(value: PhotoSortDirection): void
  /** 把当前展示顺序写成相片的 index（一次批量请求），公开页按这个顺序展示 */
  onFreeze(): Promise<void>
}

/** “固化成功”在按钮上停留的时间，之后瞬时回到“固化这个排序” */
const FREEZE_DONE_MS = 2000

type FreezePhase = 'idle' | 'busy' | 'done'

const FREEZE_LABELS: Record<FreezePhase, string> = {
  idle: '固化这个排序',
  busy: '固化中…',
  done: '固化成功',
}

const FREEZE_PHASES = Object.keys(FREEZE_LABELS) as FreezePhase[]

function FreezeSort({ sort_by, direction, onFreeze }: Pick<LegendProps, 'sort_by' | 'direction' | 'onFreeze'>) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<FreezePhase>('idle')
  const done_timer = useRef<number | undefined>(undefined)
  const by_label = PHOTO_SORT_OPTIONS.find(option => option.value === sort_by)?.label ?? ''
  const dir_label = direction === 'asc' ? '升序' : '降序'

  useEffect(() => () => window.clearTimeout(done_timer.current), [])

  const freeze = async () => {
    if (phase === 'busy') {
      return
    }
    window.clearTimeout(done_timer.current)
    // 确认后立即关掉弹层，进度和结果写在按钮上
    setOpen(false)
    setPhase('busy')
    try {
      await onFreeze()
      setPhase('done')
      done_timer.current = window.setTimeout(() => setPhase('idle'), FREEZE_DONE_MS)
    } catch (err) {
      setPhase('idle')
      signal_critical_error.trigger(`固化排序失败：${getApiErrorMessage(err, '未知错误')}`)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label='确认固化排序'
      trigger={(
        // 三种文案叠在同一个格子里，按钮宽度始终取最宽的那一个，切换时不跳动
        <button
          type='button'
          className={styles.freezeButton}
          disabled={phase === 'busy'}
          aria-live='polite'
        >
          {FREEZE_PHASES.map(item => (
            <span
              key={item}
              className={styles.freezeLabel}
              aria-hidden={item !== phase}
              style={item === phase ? undefined : { visibility: 'hidden' }}
            >
              {FREEZE_LABELS[item]}
            </span>
          ))}
        </button>
      )}
      content={close => (
        <div className={styles.freezeConfirm}>
          <div className={styles.freezeConfirmText}>
            要把相片固化为「{by_label}·{dir_label}」的顺序吗？固化后公开页的相片按这个顺序展示。
          </div>
          <div className={styles.freezeConfirmActions}>
            <button type='button' className={styles.close} onClick={close}>
              取消
            </button>
            <button type='button' className={styles.freezePrimary} onClick={() => void freeze()}>
              固化
            </button>
          </div>
        </div>
      )}
    />
  )
}

export function VoteMagnetLegend({ sort_by, direction, onSortByChange, onDirectionChange, onFreeze }: LegendProps) {
  return (
    <div className={styles.legend} aria-label='投票磁粒图例'>
      <span className={styles.sortGroup}>
        <FreezeSort sort_by={sort_by} direction={direction} onFreeze={onFreeze} />
        <SortSelect
          label='相片展示排序'
          options={PHOTO_SORT_OPTIONS}
          value={sort_by}
          direction={direction}
          onChange={onSortByChange}
          onDirectionChange={onDirectionChange}
        />
      </span>
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
