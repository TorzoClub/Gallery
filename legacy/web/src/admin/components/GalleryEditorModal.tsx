import React, { FormEvent, useEffect, useState } from 'react'

import { createGallery, updateGallery } from '../api/gallery'
import type { Gallery } from '../api/types'
import Field from './Field'
import Icon from './Icon'
import Modal from './Modal'
import { Spinner } from './Feedback'
import { useToast } from './ToastProvider'
import {
  addDaysToDateTimeLocalValue,
  compareDateTimeLocalValue,
  fromDateTimeLocalValue,
  nowDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../utils/date'
import { getApiErrorMessage } from '../utils/errors'

type GalleryForm = {
  name: string
  vote_limit: string
  event_start: string
  submission_expire: string
  event_end: string
}

type FormErrors = Partial<Record<keyof GalleryForm, string>>

type Props = {
  open: boolean
  gallery: Gallery | null
  galleries: Gallery[]
  onClose: () => void
  onSaved?: () => void
}

function createDefaultForm(): GalleryForm {
  const start = nowDateTimeLocalValue()
  return {
    name: '',
    vote_limit: '0',
    event_start: start,
    submission_expire: addDaysToDateTimeLocalValue(start, 7),
    event_end: addDaysToDateTimeLocalValue(start, 14),
  }
}

function formFromGallery(gallery: Gallery): GalleryForm {
  return {
    name: gallery.name,
    vote_limit: String(gallery.vote_limit),
    event_start: toDateTimeLocalValue(gallery.event_start),
    submission_expire: toDateTimeLocalValue(gallery.submission_expire),
    event_end: toDateTimeLocalValue(gallery.event_end),
  }
}

const formID = 'gallery-editor-form'

export default function GalleryEditorModal({
  open,
  gallery,
  galleries,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast()
  const [form, setForm] = useState<GalleryForm>(createDefaultForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setForm(gallery ? formFromGallery(gallery) : createDefaultForm())
    setFormErrors({})
    setSubmitting(false)
  }, [gallery, open])

  const setField = <K extends keyof GalleryForm>(key: K, value: GalleryForm[K]) => {
    setForm(current => ({ ...current, [key]: value }))
    setFormErrors(current => ({ ...current, [key]: undefined }))
  }

  const requestClose = () => {
    if (!submitting) {
      onClose()
    }
  }

  const validate = () => {
    const errors: FormErrors = {}
    if (!form.name.trim()) {
      errors.name = '请输入相册名称'
    }

    if (!/^\d+$/.test(form.vote_limit.trim())) {
      errors.vote_limit = '票数限制需要是大于等于 0 的整数'
    }

    if (!form.event_start) {
      errors.event_start = '请选择活动开始时间'
    }
    if (!form.submission_expire) {
      errors.submission_expire = '请选择投稿截止时间'
    }
    if (!form.event_end) {
      errors.event_end = '请选择活动结束时间'
    }

    if (form.event_start && form.submission_expire && form.event_end) {
      const start = compareDateTimeLocalValue(form.event_start, form.submission_expire)
      const end = compareDateTimeLocalValue(form.submission_expire, form.event_end)
      if (start >= 0) {
        errors.submission_expire = '投稿截止时间必须晚于活动开始时间'
      } else if (end >= 0) {
        errors.event_end = '活动结束时间必须晚于投稿截止时间'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate() || submitting) {
      return
    }

    const eventStart = fromDateTimeLocalValue(form.event_start)
    const submissionExpire = fromDateTimeLocalValue(form.submission_expire)
    const eventEnd = fromDateTimeLocalValue(form.event_end)
    if (!eventStart || !submissionExpire || !eventEnd) {
      setFormErrors({ event_start: '日期格式不正确' })
      return
    }

    const payload = {
      name: form.name.trim(),
      vote_limit: Number(form.vote_limit),
      event_start: eventStart,
      submission_expire: submissionExpire,
      event_end: eventEnd,
    }

    setSubmitting(true)
    try {
      if (gallery) {
        await updateGallery(gallery.id, payload)
        toast.success(`【${payload.name}】已更新`)
      } else {
        const maxIndex = galleries.reduce((max, item) => Math.max(max, item.index), -1)
        await createGallery({ ...payload, index: maxIndex + 1 })
        toast.success(`【${payload.name}】已创建`)
      }

      onClose()
      onSaved?.()
    } catch (err) {
      toast.error(getApiErrorMessage(err, gallery ? '更新相册失败' : '创建相册失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title={gallery ? '编辑相册' : '创建相册'}
      onClose={requestClose}
      closeOnOverlay={!submitting}
      size="md"
      footer={(
        <>
          <button type="button" className="adm-button" disabled={submitting} onClick={requestClose}>
            取消
          </button>
          <button type="submit" form={formID} className="adm-button adm-button--primary" disabled={submitting}>
            {submitting ? <><Spinner size={16} /> 保存中…</> : '保存'}
          </button>
        </>
      )}
    >
      <form id={formID} className="adm-form" onSubmit={handleSubmit} noValidate>
        <Field label="相册名称" htmlFor="gallery-name" required error={formErrors.name}>
          <input
            id="gallery-name"
            className="adm-input"
            value={form.name}
            onChange={event => setField('name', event.target.value)}
            placeholder="例如：2026 春季同装"
          />
        </Field>

        <div className="adm-form-grid">
          <Field label="活动开始时间" htmlFor="gallery-start" required error={formErrors.event_start}>
            <input
              id="gallery-start"
              className="adm-input"
              type="datetime-local"
              value={form.event_start}
              onChange={event => setField('event_start', event.target.value)}
            />
          </Field>

          <Field label="投稿截止时间" htmlFor="gallery-submission" required error={formErrors.submission_expire}>
            <input
              id="gallery-submission"
              className="adm-input"
              type="datetime-local"
              value={form.submission_expire}
              onChange={event => setField('submission_expire', event.target.value)}
            />
          </Field>

          <Field label="活动结束时间" htmlFor="gallery-end" required error={formErrors.event_end}>
            <input
              id="gallery-end"
              className="adm-input"
              type="datetime-local"
              value={form.event_end}
              onChange={event => setField('event_end', event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="投票限制票数"
          htmlFor="gallery-vote-limit"
          error={formErrors.vote_limit}
          hint="0 表示不限制投票数量"
        >
          <input
            id="gallery-vote-limit"
            className="adm-input"
            type="number"
            min={0}
            step={1}
            value={form.vote_limit}
            onChange={event => setField('vote_limit', event.target.value)}
          />
        </Field>

        <div className="adm-form-hint">
          <Icon name="info" size={15} />
          时间关系必须满足：活动开始 &lt; 投稿截止 &lt; 活动结束。
        </div>
      </form>
    </Modal>
  )
}
