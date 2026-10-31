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

type VoteView = 'summary' | 'revote' | 'non_voters'
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
  const [non_voter_filter, setNonVoterFilter] = useState<NonVoterFilter>('all')
  const [revote_busy_id, setRevoteBusyId] = useState<number | null>(null)
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

  const voted = useMemo(
    () => members.filter(member => (votes_by_member.get(Number(member.id))?.length ?? 0) > 0).length,
    [members, votes_by_member],
  )
  const total = members.length
  const not_voted = Math.max(0, total - voted)
  const non_voters = useMemo(
    () => members.filter(member => !votes_by_member.has(Number(member.id))),
    [members, votes_by_member],
  )
  const filtered_non_voters = useMemo(() => {
    if (non_voter_filter === 'ever_voted') {
      return non_voters.filter(member => member_history.ever_voted.has(Number(member.id)))
    }
    if (non_voter_filter === 'ever_submitted') {
      return non_voters.filter(member => member_history.ever_submitted.has(Number(member.id)))
    }
    return non_voters
  }, [member_history, non_voter_filter, non_voters])

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
        <h3 className={styles.heading}>编辑相册</h3>
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
            <h3 className={styles.heading}>成员投票</h3>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span>投票总人数</span>
                <strong>{total}</strong>
              </div>
              <div className={styles.stat}>
                <span>已投</span>
                <strong>{voted}</strong>
              </div>
              <div className={styles.stat}>
                <span>未投</span>
                <strong>{not_voted}</strong>
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
                设置重投
              </button>
              <button
                type='button'
                className={styles.secondaryButton}
                onClick={() => {
                  setNonVoterFilter('all')
                  setVoteView('non_voters')
                }}
              >
                看看谁没投
              </button>
            </div>
          </>
        )}

        {vote_view === 'revote' && (
          <div className={styles.revoteView}>
            <div className={styles.revoteHead}>
              <h3 className={styles.heading}>成员投票</h3>
              <button type='button' className={styles.backButton} onClick={() => setVoteView('summary')}>
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
                  {members.map(member => {
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
                          <button
                            type='button'
                            className={styles.smallButton}
                            disabled={member_votes.length === 0 || revote_busy_id !== null}
                            onClick={() => void handleRevote(member)}
                          >
                            {pending ? '处理中…' : '设置重投'}
                          </button>
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
          <div className={styles.nonVoterView}>
            <div className={styles.revoteHead}>
              <h3 className={styles.heading}>谁没投</h3>
              <button type='button' className={styles.backButton} onClick={() => setVoteView('summary')}>
                返回统计
              </button>
            </div>

            <div className={styles.filterRow} role='group' aria-label='未投成员筛选'>
              {([
                ['all', '所有人'],
                ['ever_voted', '曾经参加过投票'],
                ['ever_submitted', '曾经投稿过作品'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type='button'
                  className={`${styles.filterButton} ${non_voter_filter === value ? styles.filterButtonActive : ''}`}
                  onClick={() => setNonVoterFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={styles.nonVoterList}>
              {filtered_non_voters.length === 0
                ? <div className={styles.nonVoterEmpty}>没有符合条件的成员</div>
                : filtered_non_voters.map(member => (
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
        )}
      </aside>
    </section>
  )
}
