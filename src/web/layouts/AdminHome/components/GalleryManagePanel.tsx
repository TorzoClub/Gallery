import React, { useMemo, useState } from 'react'
import type { AdminGalleryDTO, MemberDTO } from '@shared/dto'
import { adminMutate } from '../../../admin/api/client'
import { sortPhotosByVoteCount } from '../../../admin/api/photo'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import {
  compareDateTimeLocalValue,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../../../admin/utils/date'
import RevotePopover from './RevotePopover'
import styles from './GalleryManagePanel.module.scss'

type Props = {
  gallery: AdminGalleryDTO
  members: MemberDTO[]
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

export default function GalleryManagePanel({ gallery, members, onChanged }: Props) {
  const [form, setForm] = useState<FormState>(() => formFromGallery(gallery))
  const [form_busy, setFormBusy] = useState(false)
  const [form_error, setFormError] = useState('')
  const [saved_note, setSavedNote] = useState('')
  const [sort_busy, setSortBusy] = useState(false)
  const [sort_error, setSortError] = useState('')

  const voted_ids = useMemo(
    () => new Set(gallery.vote_records.map(vote => Number(vote.member_id))),
    [gallery.vote_records],
  )
  const voted_members = useMemo(
    () => members.filter(member => voted_ids.has(Number(member.id))),
    [members, voted_ids],
  )
  const total = members.length
  const voted = voted_members.length
  const not_voted = Math.max(0, total - voted)

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
            <button type='submit' className={styles.primaryButton} disabled={form_busy}>
              {form_busy ? '保存中…' : '保存相册'}
            </button>
          </div>
        </form>
      </div>

      <aside className={styles.votePanel}>
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
          <button
            type='button'
            className={styles.secondaryButton}
            disabled={sort_busy}
            onClick={() => void handleSort()}
          >
            {sort_busy ? '排序中…' : '按票数排序'}
          </button>
          <RevotePopover
            gallery_id={gallery.id}
            members={voted_members}
            onChanged={onChanged}
            trigger={(
              <button
                type='button'
                className={styles.secondaryButton}
                disabled={voted_members.length === 0}
              >
                设置重投
              </button>
            )}
          />
        </div>
      </aside>
    </section>
  )
}
