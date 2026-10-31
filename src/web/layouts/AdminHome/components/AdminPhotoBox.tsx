import React, { type ReactNode } from 'react'
import PhotoBox from '../../../components/PhotoBox'
import MemberPopover from './MemberPopover'
import PhotoPopover from './PhotoPopover'
import type { AdminGalleryDTO } from '@shared/dto'
import type { MemberCanDelete } from './AdminConsole'

type Props = {
  gallery: AdminGalleryDTO
  photo: AdminGalleryDTO['photos'][number]
  box_width: number
  box_type: 'normal' | 'compact'
  memberCanDelete?: MemberCanDelete
  onChanged(): Promise<void>
}

export default function AdminPhotoBox({
  gallery,
  photo,
  box_width,
  box_type,
  memberCanDelete,
  onChanged,
}: Props) {
  const member = photo.member
  const member_data = member === null
    ? undefined
    : {
        id: member.id,
        nickname: member.name,
        qq: String(member.qq_num),
        avatarUrl: member.avatar_thumb_url,
      }

  const can_delete = member_data !== undefined && memberCanDelete?.(member_data) === true

  const with_member_popover = (trigger: ReactNode) => {
    if (member_data === undefined) {
      return trigger
    }
    return (
      <MemberPopover
        mode='edit'
        member={member_data}
        canDelete={can_delete}
        trigger={trigger}
        onSaved={onChanged}
      />
    )
  }

  return (
    <PhotoPopover
      photo={photo}
      gallery_id={gallery.id}
      onChanged={onChanged}
      trigger={(
        <PhotoBox
          id={photo.id}
          type={box_type}
          box_width={box_width}
          hideMember={false}
          show_vote_button={false}
          name={member?.name ?? null}
          desc={photo.desc}
          photo={{
            width: photo.width,
            height: photo.height,
            src: photo.src_url,
            thumb: photo.thumb_url,
          }}
          avatar={member === null ? null : {
            width: 0,
            height: 0,
            thumb: member.avatar_thumb_url,
            src: member.avatar_thumb_url,
          }}
          renderAvatar={(avatar) => with_member_popover(
            <button type='button' className='admin-avatar-trigger'>
              {avatar}
            </button>,
          )}
          renderName={(name) => with_member_popover(
            <button type='button' className='admin-member-name-trigger'>
              {name}
            </button>,
          )}
        />
      )}
    />
  )
}
