import React, { useState } from 'react'
import type { AdminGalleryDTO } from '@shared/dto'
import Popover from '../../../components/Popover'
import { adminMutate } from '../../../admin/api/client'
import { removeGallery } from '../../../admin/api/gallery'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import styles from './GalleryTitlePopover.module.scss'

type Props = {
  gallery: AdminGalleryDTO
  trigger: React.ReactNode
  onSaved(): void | Promise<void>
}

type FormProps = Omit<Props, 'trigger'> & { onClose(): void }

function GalleryTitleForm({ gallery, onSaved, onClose }: FormProps) {
  const [name, setName] = useState(gallery.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) {
      return
    }

    const next_name = name.trim()
    if (next_name.length === 0) {
      setError('相册名不能为空')
      return
    }
    if (next_name.length > 256) {
      setError('相册名不能超过 256 个字符')
      return
    }
    if (next_name === gallery.name.trim()) {
      onClose()
      return
    }

    setBusy(true)
    setError('')
    try {
      await adminMutate('adminUpdateGallery', {
        gallery_id: gallery.id,
        name: next_name,
      })
      await onSaved()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, '修改相册名失败'))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await removeGallery(gallery.id)
      await onSaved()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, '删除相册失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.label}>修改相册名：</div>
      <input
        className={styles.field}
        value={name}
        data-autofocus
        disabled={busy}
        onChange={(event) => {
          setName(event.target.value)
          setError('')
        }}
      />
      {error !== '' && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.actions}>
        <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void handleDelete()}>
          {busy ? '删除中…' : '删除'}
        </button>
        <div className={styles.actionsRight}>
          <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>
            取消
          </button>
          <button type="submit" className={styles.primaryButton} disabled={busy}>
            {busy ? '提交中…' : '提交'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function GalleryTitlePopover({ gallery, trigger, onSaved }: Props) {
  return (
    <Popover
      trigger={trigger}
      label="修改相册名"
      content={(close) => (
        <GalleryTitleForm
          gallery={gallery}
          onSaved={onSaved}
          onClose={close}
        />
      )}
    />
  )
}
