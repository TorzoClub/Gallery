import React, { useEffect, useId, useMemo, useState } from 'react'
import type { AdminGalleryDTO, MemberDTO } from '@shared/dto'
import { getGalleryLayout } from '../../../components/Gallery'
import Waterfall, { type WaterfallItem } from '../../../components/Waterfall'
import GalleryHeader from './GalleryHeader'
import GalleryManagePanel, { type MemberHistory } from './GalleryManagePanel'
import AdminPhotoBox from './AdminPhotoBox'
import type { MemberCanDelete } from './AdminConsole'

type Props = {
  gallery: AdminGalleryDTO
  members: MemberDTO[]
  memberHistory: MemberHistory
  memberCanDelete?: MemberCanDelete
  onGalleryChanged?: () => void | Promise<void>
  onChanged(): Promise<void>
  onWatterfallRefreshed(): void
  sorting?: boolean
  dragging?: boolean
  dragOver?: boolean
  dropAfter?: boolean
  onDragPointerDown?(event: React.PointerEvent<HTMLElement>): void
}

export default function AdminGallery({
  gallery,
  members,
  memberHistory,
  memberCanDelete,
  onGalleryChanged,
  onChanged,
  onWatterfallRefreshed,
  sorting = false,
  dragging = false,
  dragOver = false,
  dropAfter = false,
  onDragPointerDown,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (sorting) {
      setExpanded(false)
    }
  }, [sorting])
  const show_expanded = expanded && !sorting
  const body_id = useId()
  const [viewport_width, setViewportWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const layout = useMemo(() => {
    void viewport_width
    return getGalleryLayout(gallery)
  }, [gallery, viewport_width])
  const box_width = (layout.gallery_width - layout.column_gutter * (layout.column_count - 1)) / layout.column_count

  const items: WaterfallItem[] = useMemo(() => show_expanded ? gallery.photos.map(photo => ({
    id: String(photo.id),
    node: (
      <AdminPhotoBox
        gallery={gallery}
        photo={photo}
        box_width={box_width}
        box_type={layout.box_type}
        memberCanDelete={memberCanDelete}
        onChanged={onChanged}
      />
    ),
  })) : [], [box_width, show_expanded, gallery, layout.box_type, memberCanDelete, onChanged])

  return (
    <div className='gallery-wrapper' data-gallery-sort-id={gallery.id}>
      <section className='admin-gallery'>
        <GalleryHeader
          name={gallery.name}
          expanded={show_expanded}
          controls={body_id}
          empty={gallery.photos.length === 0}
          onToggle={() => setExpanded(value => !value)}
          sorting={sorting}
          dragging={dragging}
          dragOver={dragOver}
          dropAfter={dropAfter}
          onDragPointerDown={onDragPointerDown}
        />
        <div id={body_id}>
          {show_expanded && (
            <>
              <GalleryManagePanel
                gallery={gallery}
                members={members}
                member_history={memberHistory}
                onChanged={onGalleryChanged ?? onChanged}
              />
              {items.length === 0
                ? <div style={{ textAlign: 'center', color: 'grey' }} >此相册为空</div>
                : (
                  <Waterfall
                    layout={layout}
                    items={items}
                    onWatterfallRefreshed={onWatterfallRefreshed}
                  />
                )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
