import React, { useEffect, useRef, useState } from 'react'
import type { Member } from './AdminConsole'
import Popover from '../../../components/Popover'
import { createMember, removeMember, updateMember } from '../../../admin/api/member'
import { uploadImage } from '../../../api/upload'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import styles from './MemberPopover.module.scss'

type Props = {
  mode: 'create' | 'edit'
  member?: Member
  trigger: React.ReactNode
  canDelete?: boolean
  onSaved(): void | Promise<void>
}

type FormProps = {
  mode: 'create' | 'edit'
  member?: Member
  canDelete: boolean
  onClose(): void
  onSaved(): void | Promise<void>
}

function MemberForm({ mode, member, canDelete, onClose, onSaved }: FormProps) {
  const [qq, setQQ] = useState(mode === 'edit' ? member?.qq ?? '' : '')
  const [nickname, setNickname] = useState(member?.nickname ?? '')
  const [avatar_file, setAvatarFile] = useState<File | null>(null)
  const [avatar_preview, setAvatarPreview] = useState<string | null>(member?.avatarUrl ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const file_ref = useRef<HTMLInputElement>(null)
  const object_url_ref = useRef<string | null>(null)

  useEffect(() => () => {
    if (object_url_ref.current !== null) {
      URL.revokeObjectURL(object_url_ref.current)
    }
  }, [])

  const selectFile = (file: File) => {
    if (object_url_ref.current !== null) {
      URL.revokeObjectURL(object_url_ref.current)
    }
    const url = URL.createObjectURL(file)
    object_url_ref.current = url
    setAvatarFile(file)
    setAvatarPreview(url)
    setError('')
  }

  const handleDelete = async () => {
    if (busy || member === undefined) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await removeMember(Number(member.id))
      await onSaved()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, '删除成员失败'))
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) {
      return
    }

    const name = nickname.trim()
    if (name === '') {
      setError('请填写昵称')
      return
    }

    let qq_num = 0
    if (mode === 'create') {
      qq_num = Number(qq.trim())
      if (!Number.isSafeInteger(qq_num) || qq_num <= 0) {
        setError('请填写有效的 QQ 号')
        return
      }
      if (avatar_file === null) {
        setError('请选择头像')
        return
      }
    }

    setBusy(true)
    setError('')
    try {
      const avatar_temp_id = avatar_file === null
        ? undefined
        : (await uploadImage(avatar_file)).temp_id

      if (mode === 'create') {
        if (avatar_temp_id === undefined) {
          throw new Error('头像上传失败')
        }
        await createMember({
          qq_num,
          name,
          avatar_temp_id,
        })
      } else if (member !== undefined) {
        await updateMember(Number(member.id), {
          name,
          ...(avatar_temp_id === undefined ? {} : { avatar_temp_id }),
        })
      }

      await onSaved()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, mode === 'create' ? '新增成员失败' : '修改成员失败'))
    } finally {
      setBusy(false)
      if (file_ref.current !== null) {
        file_ref.current.value = ''
      }
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.heading}>
        {mode === 'create' ? '新增成员' : `修改成员 · ${member?.nickname ?? ''}`}
      </div>

      <div className={styles.avatarRow}>
        <div className={styles.avatarPreview}>
          {avatar_preview === null
            ? <span className={styles.avatarFallback}>{nickname.slice(0, 1) || '?'}</span>
            : <img src={avatar_preview} alt="" />}
        </div>
        <div className={styles.avatarCopy}>
          <span>{mode === 'create' ? '需要一张头像' : '可以保留当前头像'}</span>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={busy}
            onClick={() => file_ref.current?.click()}
          >
            {avatar_preview === null ? '选择头像' : '更换头像'}
          </button>
        </div>
        <input
          ref={file_ref}
          className={styles.fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file !== undefined) {
              selectFile(file)
            }
          }}
        />
      </div>

      <label className={styles.field}>
        <span>QQ 号</span>
        <input
          value={qq}
          readOnly={mode === 'edit'}
          inputMode="numeric"
          data-autofocus={mode === 'create' ? true : undefined}
          onChange={(event) => {
            setQQ(event.target.value)
            setError('')
          }}
        />
      </label>

      <label className={styles.field}>
        <span>昵称</span>
        <input
          value={nickname}
          data-autofocus={mode === 'edit' ? true : undefined}
          onChange={(event) => {
            setNickname(event.target.value)
            setError('')
          }}
        />
      </label>

      {error !== '' && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.actions}>
        {mode === 'edit' && canDelete && (
          <button
            type="button"
            className={styles.dangerButton}
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            {busy ? '删除中…' : '删除成员'}
          </button>
        )}
        <div className={styles.actionsRight}>
          <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>
            取消
          </button>
          <button type="submit" className={styles.primaryButton} disabled={busy}>
            {busy ? '保存中…' : mode === 'create' ? '创建成员' : '保存修改'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function MemberPopover({ mode, member, trigger, canDelete = false, onSaved }: Props) {
  return (
    <Popover
      trigger={trigger}
      label={mode === 'create' ? '新增成员' : '修改成员'}
      content={(close) => (
        <MemberForm
          mode={mode}
          member={member}
          canDelete={canDelete}
          onClose={close}
          onSaved={onSaved}
        />
      )}
    />
  )
}
