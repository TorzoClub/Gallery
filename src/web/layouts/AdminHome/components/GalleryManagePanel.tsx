import React, { useMemo, useState } from 'react'
import type { AdminGalleryDTO, MemberDTO } from '@shared/dto'
import { adminMutate } from '../../../admin/api/client'
import { removeGallery } from '../../../admin/api/gallery'
import Popover from '../../../components/Popover'
import { sortPhotosByVoteCount } from '../../../admin/api/photo'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import {
  compareDateTimeLocalValue,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../../../admin/utils/date'
import styles from './GalleryManagePanel.module.scss'

export type MemberHistory = {
  ever_voted: ReadonlySet<number>
  ever_submitted: ReadonlySet<number>
}

type VoteView = 'summary' | 'revote' | 'non_voters' | 'non_submitters'
type NonVoterFilter = 'all' | 'ever_voted' | 'ever_submitted'

type Props = {
  gallery: AdminGalleryDTO
  members: MemberDTO[]
  member_history: MemberHistory
  onChanged(): void | Promise<void>
}

type FormState = {
  name: string
  event_start: string
  submission_expire: string
  event_end: string
  vote_limit: string
}

function formFromGallery(gallery: AdminGalleryDTO): FormState {
  return {
    name: gallery.name,
    event_start: toDateTimeLocalValue(gallery.event_start),
    submission_expire: toDateTimeLocalValue(gallery.submission_expire),
    event_end: toDateTimeLocalValue(gallery.event_end),
    vote_limit: String(gallery.vote_limit),
  }
}

type MemberFilterListProps = {
  title: string
  members: MemberDTO[]
  history: MemberHistory
  onBack(): void
}

function MemberFilterList({ title, members, history, onBack }: MemberFilterListProps) {
  const [filter, setFilter] = useState<NonVoterFilter>('all')
  const filtered = useMemo(() => {
    if (filter === 'ever_voted') {
      return members.filter(member => history.ever_voted.has(Number(member.id)))
    }
    if (filter === 'ever_submitted') {
      return members.filter(member => history.ever_submitted.has(Number(member.id)))
    }
    return members
  }, [filter, history, members])

  return (
    <div className={styles.nonVoterView}>
      <div className={styles.revoteHead}>
        <h3 className={styles.heading}>{title}</h3>
        <button type='button' className={styles.backButton} onClick={onBack}>
          返回统计
        </button>
      </div>

      <div className={styles.filterRow} role='group' aria-label={`${title}筛选`}>
        {([
          ['all', '所有人'],
          ['ever_voted', '曾经参加过投票'],
          ['ever_submitted', '曾经投稿过作品'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type='button'
            className={`${styles.filterButton} ${filter === value ? styles.filterButtonActive : ''}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.nonVoterList}>
        {filtered.length === 0
          ? <div className={styles.nonVoterEmpty}>没有符合条件的成员</div>
          : filtered.map(member => (
            <div key={member.id} className={styles.nonVoterRow}>
              <img className={styles.nonVoterAvatar} src={member.avatar_thumb_url} alt='' loading='lazy' />
              <div className={styles.nonVoterInfo}>
                <strong>{member.name}</strong>
                <span>{member.qq_num}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export default function GalleryManagePanel({ gallery, members, member_history, onChanged }: Props) {
  const [form, setForm] = useState<FormState>(() => formFromGallery(gallery))
  const [form_busy, setFormBusy] = useState(false)
  const [form_error, setFormError] = useState('')
  const [saved_note, setSavedNote] = useState('')
  const [sort_busy, setSortBusy] = useState(false)
  const [sort_error, setSortError] = useState('')
  const [delete_open, setDeleteOpen] = useState(false)
  const [delete_busy, setDeleteBusy] = useState(false)
  const [vote_view, setVoteView] = useState<VoteView>('summary')
  const [revote_busy_id, setRevoteBusyId] = useState<number | null>(null)
  const [revote_confirm_id, setRevoteConfirmId] = useState<number | null>(null)
  const [revote_error, setRevoteError] = useState('')

  const photo_map = useMemo(
    () => new Map(gallery.photos.map(photo => [Number(photo.id), photo])),
    [gallery.photos],
  )
  const votes_by_member = useMemo(() => {
    const map = new Map<number, AdminGalleryDTO['vote_records']>()
    for (const vote of gallery.vote_records) {
      const member_id = Number(vote.member_id)
      const current = map.get(member_id)
      if (current === undefined) {
        map.set(member_id, [vote])
      } else {
        current.push(vote)
      }
    }
    return map
  }, [gallery.vote_records])

  const voted_members = useMemo(
    () => members.filter(member => (votes_by_member.get(Number(member.id))?.length ?? 0) > 0),
    [members, votes_by_member],
  )
  const voted = voted_members.length
  const total = members.length
  const submitted_ids = useMemo(
    () => new Set(gallery.photos.map(photo => Number(photo.member_id))),
    [gallery.photos],
  )
  const non_voters = useMemo(
    () => members.filter(member => !votes_by_member.has(Number(member.id))),
    [members, votes_by_member],
  )
  const non_submitters = useMemo(
    () => members.filter(member => !submitted_ids.has(Number(member.id))),
    [members, submitted_ids],
  )

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(current => ({ ...current, [key]: value }))
    setFormError('')
    setSavedNote('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (form_busy) {
      return
    }

    const name = form.name.trim()
    if (name.length === 0) {
      setFormError('相册名不能为空')
      return
    }
    if (name.length > 256) {
      setFormError('相册名不能超过 256 个字符')
      return
    }
    if (!/^\d+$/.test(form.vote_limit.trim())) {
      setFormError('投票限制必须是大于等于 0 的整数')
      return
    }
    if (compareDateTimeLocalValue(form.event_start, form.submission_expire) >= 0) {
      setFormError('活动截止时间必须晚于活动开始时间')
      return
    }
    if (compareDateTimeLocalValue(form.submission_expire, form.event_end) >= 0) {
      setFormError('活动结束时间必须晚于活动截止时间')
      return
    }

    const event_start = fromDateTimeLocalValue(form.event_start)
    const submission_expire = fromDateTimeLocalValue(form.submission_expire)
    const event_end = fromDateTimeLocalValue(form.event_end)
    if (event_start === null || submission_expire === null || event_end === null) {
      setFormError('请填写合法的日期时间')
      return
    }

    setFormBusy(true)
    setFormError('')
    setSavedNote('')
    try {
      await adminMutate('adminUpdateGallery', {
        gallery_id: gallery.id,
        name,
        vote_limit: Number(form.vote_limit),
        event_start,
        submission_expire,
        event_end,
      })
      await onChanged()
      setSavedNote('已保存')
    } catch (err) {
      setFormError(getApiErrorMessage(err, '保存相册失败'))
    } finally {
      setFormBusy(false)
    }
  }

  const handleSort = async () => {
    if (sort_busy) {
      return
    }
    setSortBusy(true)
    setSortError('')
    try {
      await sortPhotosByVoteCount(gallery.id)
      await onChanged()
    } catch (err) {
      setSortError(getApiErrorMessage(err, '按票数排序失败'))
    } finally {
      setSortBusy(false)
    }
  }

  const handleDelete = async () => {
    if (delete_busy) {
      return
    }
    if (gallery.photos.length > 0) {
      setFormError('只能删除没有相片的空相册')
      return
    }

    setDeleteBusy(true)
    setFormError('')
    setSavedNote('')
    try {
      await removeGallery(gallery.id)
      await onChanged()
    } catch (err) {
      setFormError(getApiErrorMessage(err, '删除相册失败'))
    } finally {
      setDeleteBusy(false)
    }
  }

  const handleDeleteOpenChange = (next: boolean) => {
    if (!next) {
      setDeleteOpen(false)
      return
    }
    if (gallery.photos.length > 0) {
      setFormError('只能删除没有相片的空相册')
      return
    }
    setFormError('')
    setDeleteOpen(true)
  }

  const handleRevote = async (member: MemberDTO) => {
    if (revote_busy_id !== null) {
      return
    }
    setRevoteBusyId(Number(member.id))
    setRevoteError('')
    try {
      await adminMutate('adminClearMemberGalleryVotes', {
        gallery_id: gallery.id,
        member_id: member.id,
      })
      await onChanged()
    } catch (err) {
      setRevoteError(getApiErrorMessage(err, '设置重投失败'))
    } finally {
      setRevoteBusyId(null)
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.editor}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span>相册名称</span>
            <input
              value={form.name}
              disabled={form_busy}
              onChange={event => setField('name', event.target.value)}
            />
          </label>

          <div className={styles.dates}>
            <label className={styles.field}>
              <span>活动开始时间</span>
              <input
                type='datetime-local'
                value={form.event_start}
                disabled={form_busy}
                onChange={event => setField('event_start', event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>活动截止时间</span>
              <input
                type='datetime-local'
                value={form.submission_expire}
                disabled={form_busy}
                onChange={event => setField('submission_expire', event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>活动结束时间</span>
              <input
                type='datetime-local'
                value={form.event_end}
                disabled={form_busy}
                onChange={event => setField('event_end', event.target.value)}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>投票限制票数</span>
            <input
              type='number'
              min={0}
              step={1}
              value={form.vote_limit}
              disabled={form_busy}
              onChange={event => setField('vote_limit', event.target.value)}
            />
            <small>0 表示不限制投票数量</small>
          </label>

          {form_error !== '' && <div className={styles.error} role='alert'>{form_error}</div>}
          {saved_note !== '' && <div className={styles.success}>{saved_note}</div>}

          <div className={styles.formActions}>
            <Popover
              open={delete_open}
              onOpenChange={handleDeleteOpenChange}
              label='确认删除相册'
              trigger={(
                <button type='button' className={styles.deleteButton} disabled={form_busy || delete_busy}>
                  删除相册
                </button>
              )}
              content={(close) => (
                <div className={styles.deleteConfirm}>
                  <div className={styles.deleteConfirmText}>
                    确定删除相册「{gallery.name}」吗？此操作不可撤销。
                  </div>
                  <div className={styles.deleteConfirmActions}>
                    <button type='button' className={styles.secondaryButton} disabled={delete_busy} onClick={close}>
                      取消
                    </button>
                    <button
                      type='button'
                      className={styles.dangerButton}
                      disabled={delete_busy}
                      onClick={() => {
                        close()
                        void handleDelete()
                      }}
                    >
                      {delete_busy ? '删除中…' : '确认删除'}
                    </button>
                  </div>
                </div>
              )}
            />
            <button type='submit' className={styles.primaryButton} disabled={form_busy || delete_busy}>
              {form_busy ? '保存中…' : '保存相册'}
            </button>
          </div>
        </form>
      </div>

      <aside className={styles.votePanel}>
        {vote_view === 'summary' && (
          <>
            <div
              className={styles.voteRatioCard}
              aria-label={`参与投票的人数比：已投 ${voted} 人，成员总数 ${total} 人`}
            >
              <span className={styles.voteRatioTitle}>参与投票的人数比</span>
              <div className={styles.voteRatioGrid} aria-hidden='true'>
                <span className={styles.voteRatioValue}>{voted}</span>
                <span className={styles.voteRatioSlash}>/</span>
                <span className={styles.voteRatioValue}>{total}</span>
                <span className={styles.voteRatioLabel}>已投</span>
                <span />
                <span className={styles.voteRatioLabel}>成员数量</span>
              </div>
            </div>

            {sort_error !== '' && <div className={styles.error} role='alert'>{sort_error}</div>}

            <div className={styles.voteActions}>
              <Popover
                label='确认按票数排序'
                trigger={(
                  <button
                    type='button'
                    className={styles.secondaryButton}
                    disabled={sort_busy}
                  >
                    {sort_busy ? '排序中…' : '按票数排序'}
                  </button>
                )}
                content={(close) => (
                  <div className={styles.sortConfirm}>
                    <div className={styles.sortConfirmText}>确定要按当前票数重新排列相片吗？</div>
                    <div className={styles.sortConfirmActions}>
                      <button type='button' className={styles.secondaryButton} onClick={close}>
                        取消
                      </button>
                      <button
                        type='button'
                        className={styles.primaryButton}
                        onClick={() => {
                          close()
                          void handleSort()
                        }}
                      >
                        开始排序
                      </button>
                    </div>
                  </div>
                )}
              />
              <button
                type='button'
                className={styles.secondaryButton}
                onClick={() => {
                  setRevoteError('')
                  setVoteView('revote')
                }}
              >
                投票/投稿状况
              </button>
              <button
                type='button'
                className={styles.secondaryButton}
                onClick={() => setVoteView('non_voters')}
              >
                谁没投票
              </button>
              <button
                type='button'
                className={styles.secondaryButton}
                onClick={() => setVoteView('non_submitters')}
              >
                谁没投稿
              </button>
            </div>
          </>
        )}

        {vote_view === 'revote' && (
          <div className={styles.revoteView}>
            <div className={`${styles.revoteHead} ${styles.revoteHeadEnd}`}>
              <button
                type='button'
                className={styles.backButton}
                onClick={() => {
                  setRevoteConfirmId(null)
                  setVoteView('summary')
                }}
              >
                返回统计
              </button>
            </div>

            {revote_error !== '' && <div className={styles.error} role='alert'>{revote_error}</div>}

            <div className={styles.tableScroll}>
              <table className={styles.revoteTable}>
                <thead>
                  <tr>
                    <th>昵称（QQ号）</th>
                    <th>投票状况</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {voted_members.length === 0 && (
                    <tr>
                      <td colSpan={3} className={styles.tableEmpty}>还没有成员投票</td>
                    </tr>
                  )}
                  {voted_members.map(member => {
                    const member_votes = votes_by_member.get(Number(member.id)) ?? []
                    const pending = revote_busy_id === Number(member.id)
                    return (
                      <tr key={member.id}>
                        <td className={styles.nameCell}>
                          {member.name} ({member.qq_num})
                        </td>
                        <td>
                          {member_votes.length === 0
                            ? <span className={styles.muted}>未投</span>
                            : (
                              <div className={styles.voteThumbs}>
                                {member_votes.map(vote => {
                                  const photo = photo_map.get(Number(vote.photo_id))
                                  if (photo === undefined) {
                                    return <span key={vote.id} className={styles.muted}>#{vote.photo_id}</span>
                                  }
                                  return (
                                    <img
                                      key={vote.id}
                                      className={styles.voteThumb}
                                      src={photo.thumb_url}
                                      alt={`相片 ${photo.id}`}
                                      title={photo.desc}
                                    />
                                  )
                                })}
                              </div>
                            )}
                        </td>
                        <td className={styles.actionCell}>
                          <Popover
                            open={revote_confirm_id === Number(member.id)}
                            onOpenChange={open => setRevoteConfirmId(
                              open ? Number(member.id) : null,
                            )}
                            label='确认设置重投'
                            trigger={(
                              <button
                                type='button'
                                className={styles.smallButton}
                                disabled={member_votes.length === 0 || revote_busy_id !== null}
                              >
                                {pending ? '处理中…' : '设置重投'}
                              </button>
                            )}
                            content={(close) => (
                              <div className={styles.revoteConfirm}>
                                <div className={styles.revoteConfirmText}>
                                  确定要让「{member.name}（{member.qq_num}）」重新投票吗？<br />
                                  该名成员在这个相册的投票记录将会被清除。
                                </div>
                                <div className={styles.revoteConfirmActions}>
                                  <button type='button' className={styles.secondaryButton} onClick={close}>
                                    取消
                                  </button>
                                  <button
                                    type='button'
                                    className={styles.primaryButton}
                                    onClick={() => {
                                      close()
                                      void handleRevote(member)
                                    }}
                                  >
                                    确认重投
                                  </button>
                                </div>
                              </div>
                            )}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {vote_view === 'non_voters' && (
          <MemberFilterList
            title='谁没投票'
            members={non_voters}
            history={member_history}
            onBack={() => setVoteView('summary')}
          />
        )}

        {vote_view === 'non_submitters' && (
          <MemberFilterList
            title='谁没投稿'
            members={non_submitters}
            history={member_history}
            onBack={() => setVoteView('summary')}
          />
        )}
      </aside>
    </section>
  )
}
