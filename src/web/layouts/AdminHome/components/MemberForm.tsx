import React, { useEffect, useRef, useState } from 'react'
import type { Member } from './AdminConsole'
import { createMember, removeMember, updateMember } from '../../../admin/api/member'
import { uploadImage } from '../../../api/upload'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import styles from './MemberForm.module.scss'

export type MemberFormDraft = {
  qq: string
  nickname: string
  avatarFile: File | null
}

export type MemberFormProps = {
  mode: 'create' | 'edit'
  member?: Member
  canDelete: boolean
  /** 显示标题。名单簿二级页面自己有页眉，所以不显示 */
  showHeading?: boolean
  /** 名单簿二级页面：取消和提交按钮都不在表单里（页眉有“名单簿”和外置的提交按钮） */
  embedded?: boolean
  /** 外置提交按钮用 form={formId} 关联到这个表单 */
  formId?: string
  /** 上一次离开时没保存的输入；翻到三级页面再翻回来时用它恢复 */
  draft?: MemberFormDraft
  onDraftChange?(draft: MemberFormDraft): void
  onBusyChange?(busy: boolean): void
  onClose(): void
  onSaved(): void | Promise<void>
}

type ErrorAt = 'avatar' | 'qq' | 'nickname' | 'form'

export function MemberForm({
  mode, member, canDelete, showHeading = true, embedded = false, formId,
  draft, onDraftChange, onBusyChange, onClose, onSaved,
}: MemberFormProps) {
  const [qq, setQQ] = useState(draft?.qq ?? (mode === 'edit' ? member?.qq ?? '' : ''))
  const [nickname, setNickname] = useState(draft?.nickname ?? member?.nickname ?? '')
  const [avatar_file, setAvatarFile] = useState<File | null>(draft?.avatarFile ?? null)
  const [avatar_preview, setAvatarPreview] = useState<string | null>(member?.avatarUrl ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setErrorText] = useState('')
  // 出错提示挂在哪个输入项下面；form 表示整张表单的错误（接口失败等），放在最后
  const [error_at, setErrorAt] = useState<ErrorAt>('form')
  const setError = (text: string, at: ErrorAt = 'form') => {
    setErrorText(text)
    setErrorAt(at)
  }
  const file_ref = useRef<HTMLInputElement>(null)
  const object_url_ref = useRef<string | null>(null)

  // 草稿里带着没上传的头像文件：重新生成预览
  useEffect(() => {
    const file = draft?.avatarFile
    if (file === undefined || file === null) {
      return
    }
    const url = URL.createObjectURL(file)
    object_url_ref.current = url
    setAvatarPreview(url)
    // 只在挂载时恢复一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => {
    if (object_url_ref.current !== null) {
      URL.revokeObjectURL(object_url_ref.current)
    }
  }, [])

  useEffect(() => {
    onDraftChange?.({ qq, nickname, avatarFile: avatar_file })
    // onDraftChange 由调用方每次渲染重建，这里只关心输入本身
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qq, nickname, avatar_file])

  useEffect(() => {
    onBusyChange?.(busy)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy])

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
      setError('请填写昵称', 'nickname')
      return
    }

    let qq_num = 0
    if (mode === 'create') {
      qq_num = Number(qq.trim())
      if (!Number.isSafeInteger(qq_num) || qq_num <= 0) {
        setError('请填写有效的 QQ 号', 'qq')
        return
      }
      if (avatar_file === null) {
        setError('请选择头像', 'avatar')
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

  // 某一项的出错提示：紧贴在该项下面，用上箭头指向它
  const fieldError = (at: Exclude<ErrorAt, 'form'>) => (
    error !== '' && error_at === at
      ? <div className={`${styles.error} ${styles.fieldError}`} role="alert">{error}</div>
      : null
  )

  return (
    <form id={formId} className={embedded ? `${styles.form} ${styles.ruled}` : styles.form} onSubmit={handleSubmit}>
      {showHeading && (
        <div className={styles.heading}>
          {mode === 'create' ? '新增成员' : `修改成员 · ${member?.nickname ?? ''}`}
        </div>
      )}

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
      {fieldError('avatar')}

      <label className={styles.field}>
        <span>QQ 号</span>
        <input
          value={qq}
          readOnly={mode === 'edit'}
          inputMode="numeric"
          placeholder={mode === 'create' ? '输入QQ号码' : undefined}
          aria-invalid={error !== '' && error_at === 'qq' ? true : undefined}
          data-autofocus={mode === 'create' ? true : undefined}
          onChange={(event) => {
            setQQ(event.target.value)
            setError('')
          }}
        />
      </label>
      {fieldError('qq')}

      <label className={styles.field}>
        <span>昵称</span>
        <input
          value={nickname}
          placeholder="输入昵称"
          aria-invalid={error !== '' && error_at === 'nickname' ? true : undefined}
          data-autofocus={mode === 'edit' ? true : undefined}
          onChange={(event) => {
            setNickname(event.target.value)
            setError('')
          }}
        />
      </label>
      {fieldError('nickname')}

      {error !== '' && error_at === 'form' && <div className={styles.error} role="alert">{error}</div>}

      {/* 名单簿成员页的删除按钮在页眉里（MemberNotebook 的 DeleteMember），这里只给弹层版用 */}
      {!embedded && (
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
          {!embedded && (
            <div className={styles.actionsRight}>
              <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>
                取消
              </button>
              <button type="submit" className={styles.primaryButton} disabled={busy}>
                {busy ? '保存中…' : mode === 'create' ? '创建成员' : '保存修改'}
              </button>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
