import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MemberDTO } from '@shared/dto'
import { adminMutate } from '../../../admin/api/client'
import { uploadImage } from '../../../api/upload'
import { getApiErrorMessage } from '../../../admin/utils/errors'

type Props = {
  member: MemberDTO
  anchor: DOMRect
  onClose(): void
  onChanged(): Promise<void>
}

export default function AdminMemberPopover({ member, anchor, onClose, onChanged }: Props) {
  const root_ref = useRef<HTMLDivElement>(null)
  const input_ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (root_ref.current !== null && !root_ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const width = 270
  const left = Math.min(Math.max(8, anchor.left), window.innerWidth - width - 8)
  const top = Math.min(anchor.bottom + 8, window.innerHeight - 300)

  const handleFile = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const uploaded = await uploadImage(file)
      await adminMutate('adminUpdateMember', {
        member_id: member.id,
        avatar_temp_id: uploaded.temp_id,
      })
      await onChanged()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, '更新头像失败'))
    } finally {
      setBusy(false)
      if (input_ref.current !== null) {
        input_ref.current.value = ''
      }
    }
  }

  return createPortal(
    <div
      ref={root_ref}
      className="admin-member-popover"
      style={{ left, top, width }}
      role="dialog"
      aria-label="成员信息"
    >
      <div className="admin-member-popover__head">
        <img src={member.avatar_thumb_url} alt="" />
        <div>
          <strong>{member.name}</strong>
          <span>QQ 号：{member.qq_num}</span>
        </div>
      </div>
      <button
        type="button"
        className="admin-member-popover__button"
        disabled={busy}
        onClick={() => input_ref.current?.click()}
      >
        {busy ? '更新中…' : '修改头像'}
      </button>
      <input
        ref={input_ref}
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
      {error !== '' && <div className="admin-member-popover__error">{error}</div>}
    </div>,
    document.body,
  )
}
