import React, { useState } from 'react'
import type { MemberDTO } from '@shared/dto'
import Popover from '../../../components/Popover'
import { adminMutate } from '../../../admin/api/client'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import styles from './RevotePopover.module.scss'

type Props = {
  gallery_id: number
  members: MemberDTO[]
  trigger: React.ReactNode
  onChanged(): void | Promise<void>
}

type FormProps = Omit<Props, 'trigger'> & { onClose(): void }

function RevoteForm({ gallery_id, members, onChanged, onClose }: FormProps) {
  const [member_id, setMemberId] = useState<number>(members[0]?.id ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || member_id === 0) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await adminMutate('adminClearMemberGalleryVotes', {
        gallery_id,
        member_id,
      })
      await onChanged()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, '设置重投失败'))
    } finally {
      setBusy(false)
    }
  }

  if (members.length === 0) {
    return (
      <div className={styles.form}>
        <div className={styles.label}>设置成员重投</div>
        <div className={styles.empty}>当前相册没有已投票的成员。</div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>关闭</button>
        </div>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.label}>设置成员重投</div>
      <select
        className={styles.select}
        value={member_id}
        data-autofocus
        disabled={busy}
        onChange={(event) => {
          setMemberId(Number(event.target.value))
          setError('')
        }}
      >
        {members.map(member => (
          <option key={member.id} value={member.id}>
            {member.name}（QQ {member.qq_num}）
          </option>
        ))}
      </select>
      {error !== '' && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>
          取消
        </button>
        <button type="submit" className={styles.primaryButton} disabled={busy}>
          {busy ? '处理中…' : '设置重投'}
        </button>
      </div>
    </form>
  )
}

export default function RevotePopover({ gallery_id, members, trigger, onChanged }: Props) {
  return (
    <Popover
      trigger={trigger}
      label="设置成员重投"
      content={(close) => (
        <RevoteForm
          gallery_id={gallery_id}
          members={members}
          onChanged={onChanged}
          onClose={close}
        />
      )}
    />
  )
}
