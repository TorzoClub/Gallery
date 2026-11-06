import React, { type ReactNode } from 'react'
import PhotoCard, { photoCardCover, type PhotoCardScatter } from '../../../components/PhotoCard'
import MemberPopover from './MemberPopover'
import PhotoPopover from './PhotoPopover'
import VoteMagnets from './VoteMagnets'
import type { PhotoVoteRecord } from './photo-votes'
import type { AdminGalleryDTO } from '@shared/dto'
import type { MemberCanDelete } from './AdminConsole'

type Props = {
  gallery: AdminGalleryDTO
  photo: AdminGalleryDTO['photos'][number]
  votes: readonly PhotoVoteRecord[]
  scatter: PhotoCardScatter
  memberCanDelete?: MemberCanDelete
  /** 正在贴纸胶带（新相片贴上来）：放一只 🤚 抹胶带，见 Gallery 的 .photo-card-entering */
  hand?: boolean
  onChanged(): Promise<void>
}

export default function AdminPhotoCard({
  gallery,
  photo,
  votes,
  scatter,
  memberCanDelete,
  hand = false,
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

  // 磁粒在相片区域内，随卡片一起倾斜
  const cover = photoCardCover(scatter.card_width, photo)

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
        <PhotoCard
          id={photo.id}
          width={scatter.card_width}
          tilt={{ rotate: scatter.rotate, x: scatter.offset_x }}
          tape={{ x: scatter.tape_x, rotate: scatter.tape_rotate }}
          hand={hand}
          hideMember={false}
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
          coverOverlay={(
            <VoteMagnets
              photo_id={photo.id}
              records={votes}
              cover_width={cover.cover_width}
              cover_height={cover.cover_height}
            />
          )}
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
