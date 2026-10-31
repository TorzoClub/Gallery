import React, { useRef, useState } from 'react'
import type { AdminGalleryDTO } from '@shared/dto'
import Popover from '../../../components/Popover'
import { adminMutate } from '../../../admin/api/client'
import { uploadImage } from '../../../api/upload'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import styles from './PhotoPopover.module.scss'

type Props = {
  photo: AdminGalleryDTO['photos'][number]
  gallery_id: number
  trigger: React.ReactNode
  onChanged(): void | Promise<void>
}

function Actions({
  photo,
  gallery_id,
  onChanged,
  onClose,
}: Omit<Props, 'trigger'> & { onClose(): void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [description, setDescription] = useState(photo.desc)
  const file_ref = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const uploaded = await uploadImage(file)
      await adminMutate('adminUpdatePhoto', {
        photo_id: photo.id,
        gallery_id,
        temp_id: uploaded.temp_id,
      })
      await onChanged()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, '替换图片失败'))
    } finally {
      setBusy(false)
      if (file_ref.current !== null) {
        file_ref.current.value = ''
      }
    }
  }

  const handleSaveDescription = async () => {
    if (busy || description === photo.desc) {
      onClose()
      return
    }
    setBusy(true)
    setError('')
    try {
      await adminMutate('adminUpdatePhoto', {
        photo_id: photo.id,
        desc: description,
      })
      await onChanged()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, '保存描述失败'))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    setError('')
    try {
      await adminMutate('adminRemovePhoto', { photo_id: photo.id })
      await onChanged()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, '删除相片失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.heading}>相片操作</div>

      <input
        ref={file_ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file !== undefined) {
            void handleFile(file)
          }
        }}
      />

      <label className={styles.description}>
        <span>描述</span>
        <textarea
          value={description}
          rows={4}
          disabled={busy}
          data-autofocus
          onChange={(event) => {
            setDescription(event.target.value)
            setError('')
          }}
        />
      </label>

      <button
        type="button"
        className={styles.primaryButton}
        disabled={busy}
        onClick={() => void handleSaveDescription()}
      >
        {busy ? '保存中…' : '保存描述'}
      </button>

      {confirming ? (
        <div className={styles.confirm}>
          <span>确定删除这张相片？</span>
          <div className={styles.confirmActions}>
            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setConfirming(false)}>
              取消
            </button>
            <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void handleDelete()}>
              {busy ? '删除中…' : '确认删除'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={busy}
            onClick={() => file_ref.current?.click()}
          >
            {busy ? '处理中…' : '替换图片'}
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            disabled={busy}
            onClick={() => {
              setError('')
              setConfirming(true)
            }}
          >
            删除相片
          </button>
        </div>
      )}

      {error !== '' && <div className={styles.error} role="alert">{error}</div>}
    </div>
  )
}

export default function PhotoPopover({ photo, gallery_id, trigger, onChanged }: Props) {
  return (
    <Popover
      trigger={trigger}
      label="相片操作"
      content={(close) => (
        <Actions
          photo={photo}
          gallery_id={gallery_id}
          onChanged={onChanged}
          onClose={close}
        />
      )}
    />
  )
}
