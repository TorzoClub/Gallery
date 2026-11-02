import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { MemberDTO } from '@shared/dto'
import Popover from '../../../components/Popover'
import { createPhoto } from '../../../admin/api/photo'
import { uploadImage } from '../../../api/upload'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import styles from './AddPhotoPopover.module.scss'

type Props = {
  gallery_id: number
  members: MemberDTO[]
  submitted_member_ids: ReadonlySet<number>
  onChanged(): void | Promise<void>
}

type FormProps = Props & {
  onClose(): void
}

function AddPhotoForm({
  gallery_id,
  members,
  submitted_member_ids,
  onChanged,
  onClose,
}: FormProps) {
  const [author_id, setAuthorId] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview_url, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const file_ref = useRef<HTMLInputElement>(null)
  const object_url_ref = useRef<string | null>(null)

  const eligible_members = useMemo(
    () => members.filter(member => !submitted_member_ids.has(Number(member.id))),
    [members, submitted_member_ids],
  )

  useEffect(() => () => {
    if (object_url_ref.current !== null) {
      URL.revokeObjectURL(object_url_ref.current)
    }
  }, [])

  useEffect(() => {
    if (author_id === '') {
      return
    }
    if (!eligible_members.some(member => String(member.id) === author_id)) {
      setAuthorId('')
    }
  }, [author_id, eligible_members])

  const selectFile = (next_file: File) => {
    if (object_url_ref.current !== null) {
      URL.revokeObjectURL(object_url_ref.current)
    }
    const url = URL.createObjectURL(next_file)
    object_url_ref.current = url
    setFile(next_file)
    setPreviewUrl(url)
    setError('')
    if (file_ref.current !== null) {
      file_ref.current.value = ''
    }
  }

  const handleCreate = async () => {
    if (busy) {
      return
    }
    if (eligible_members.length === 0) {
      setError('所有成员都已投稿，不能再新增照片')
      return
    }
    if (author_id === '') {
      setError('请选择作者')
      return
    }
    if (file === null) {
      setError('请选择相片')
      return
    }

    setBusy(true)
    setError('')
    try {
      const uploaded = await uploadImage(file)
      await createPhoto({
        gallery_id,
        member_id: Number(author_id),
        desc: description,
        temp_id: uploaded.temp_id,
      })
      await onChanged()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, '新增照片失败'))
    } finally {
      setBusy(false)
      if (file_ref.current !== null) {
        file_ref.current.value = ''
      }
    }
  }

  return (
    <div className={styles.form}>
      <div className={styles.heading}>新增照片</div>

      <label className={styles.field}>
        <span>作者</span>
        <select
          value={author_id}
          disabled={busy || eligible_members.length === 0}
          data-autofocus
          onChange={(event) => {
            setAuthorId(event.target.value)
            setError('')
          }}
        >
          <option value=''>选择作者</option>
          {eligible_members.map(member => (
            <option key={member.id} value={member.id}>
              {member.name}（{member.qq_num}）
            </option>
          ))}
        </select>
        {eligible_members.length === 0 && (
          <small className={styles.empty}>所有成员都已投稿</small>
        )}
      </label>

      <div className={styles.field}>
        <span>相片</span>
        <div className={styles.fileRow}>
          <div className={styles.preview}>
            {preview_url === null
              ? <span className={styles.previewPlaceholder}>未选择相片</span>
              : <img src={preview_url} alt='待上传相片预览' />}
          </div>
          <div className={styles.fileActions}>
            <button
              type='button'
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => file_ref.current?.click()}
            >
              {file === null ? '选择相片' : '更换相片'}
            </button>
            {file !== null && (
              <span className={styles.fileName} title={file.name}>{file.name}</span>
            )}
          </div>
        </div>
        <input
          ref={file_ref}
          type='file'
          accept='image/*'
          hidden
          onChange={(event) => {
            const next_file = event.target.files?.[0]
            if (next_file !== undefined) {
              selectFile(next_file)
            }
          }}
        />
      </div>

      <label className={styles.field}>
        <span>相片描述</span>
        <textarea
          rows={3}
          value={description}
          disabled={busy}
          onChange={(event) => {
            setDescription(event.target.value)
            setError('')
          }}
        />
      </label>

      {error !== '' && <div className={styles.error} role='alert'>{error}</div>}

      <div className={styles.actions}>
        <button
          type='button'
          className={styles.secondaryButton}
          disabled={busy}
          onClick={onClose}
        >
          取消
        </button>
        <button
          type='button'
          className={styles.primaryButton}
          disabled={busy || eligible_members.length === 0}
          onClick={() => void handleCreate()}
        >
          {busy ? '创建中…' : '创建照片'}
        </button>
      </div>
    </div>
  )
}

export default function AddPhotoPopover({
  gallery_id,
  members,
  submitted_member_ids,
  onChanged,
}: Props) {
  return (
    <Popover
      label='新增照片'
      trigger={(
        <button type='button' className={styles.triggerButton}>
          新增照片
        </button>
      )}
      content={(close) => (
        <AddPhotoForm
          gallery_id={gallery_id}
          members={members}
          submitted_member_ids={submitted_member_ids}
          onChanged={onChanged}
          onClose={close}
        />
      )}
    />
  )
}
