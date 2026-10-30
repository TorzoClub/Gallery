import React, { useRef, useState } from 'react'
import { adminMutate } from '../../../admin/api/client'
import { uploadImage } from '../../../api/upload'
import PhotoBox from '../../../components/PhotoBox'
import { Spinner } from '../../../admin/components/Feedback'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import type { AdminGalleryDTO } from '@shared/dto'
import AdminMemberPopover from './AdminMemberPopover'

type Props = {
  gallery: AdminGalleryDTO
  photo: AdminGalleryDTO['photos'][number]
  box_width: number
  box_type: 'normal' | 'compact'
  onChanged(): Promise<void>
}

export default function AdminPhotoBox({
  gallery,
  photo,
  box_width,
  box_type,
  onChanged,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [member_anchor, setMemberAnchor] = useState<DOMRect | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input_ref = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const uploaded = await uploadImage(file)
      await adminMutate('adminUpdatePhoto', {
        photo_id: photo.id,
        gallery_id: gallery.id,
        temp_id: uploaded.temp_id,
      })
      setEditing(false)
      await onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, '替换图片失败'))
    } finally {
      setBusy(false)
      if (input_ref.current !== null) {
        input_ref.current.value = ''
      }
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    setError('')
    try {
      await adminMutate('adminRemovePhoto', { photo_id: photo.id })
      setDeleting(false)
      await onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, '删除相片失败'))
    } finally {
      setBusy(false)
    }
  }

  const cover_overlay = editing ? (
    <button
      type="button"
      className="admin-photo-edit-overlay"
      disabled={busy}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        input_ref.current?.click()
      }}
    >
      <span>{busy ? '上传中…' : '点击替换图片'}</span>
      {busy && <Spinner size={18} />}
    </button>
  ) : null

  const bottom = (
    <div className="admin-photo-actions">
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
      <div className="admin-photo-actions__row">
        <button
          type="button"
          className="admin-photo-action"
          disabled={busy}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setError('')
            setEditing(value => !value)
          }}
        >
          {editing ? '取消编辑' : '编辑'}
        </button>
        <button
          type="button"
          className="admin-photo-action admin-photo-action--danger"
          disabled={busy}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setError('')
            setDeleting(value => !value)
          }}
        >
          删除
        </button>
      </div>
      {deleting && (
        <div className="admin-photo-delete-popover" role="dialog" aria-label="确认删除相片">
          <span>确认删除这张相片？</span>
          <div className="admin-photo-delete-popover__actions">
            <button type="button" className="admin-photo-action" disabled={busy} onClick={() => setDeleting(false)}>
              取消
            </button>
            <button type="button" className="admin-photo-action admin-photo-action--danger" disabled={busy} onClick={() => void handleDelete()}>
              {busy ? '删除中…' : '确认删除'}
            </button>
          </div>
        </div>
      )}
      {error !== '' && <div className="admin-photo-action-error">{error}</div>}
    </div>
  )

  return (
    <>
    <PhotoBox
      id={photo.id}
      type={box_type}
      box_width={box_width}
      hideMember={false}
      show_vote_button={false}
      name={photo.member?.name ?? null}
      desc={photo.desc}
      photo={{
        width: photo.width,
        height: photo.height,
        src: photo.src_url,
        thumb: photo.thumb_url,
      }}
      avatar={photo.member === null ? null : {
        width: 0,
        height: 0,
        thumb: photo.member.avatar_thumb_url,
        src: photo.member.avatar_thumb_url,
      }}
      bottomActions={bottom}
      coverOverlay={cover_overlay}
      onClickAvatar={photo.member === null ? undefined : (event) => {
        setMemberAnchor(event.currentTarget.getBoundingClientRect())
      }}
    />
    {photo.member !== null && member_anchor !== null && (
      <AdminMemberPopover
        member={photo.member}
        anchor={member_anchor}
        onClose={() => setMemberAnchor(null)}
        onChanged={onChanged}
      />
    )}
  </>
)
}
