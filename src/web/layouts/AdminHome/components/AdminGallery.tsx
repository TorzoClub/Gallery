import React, { useEffect, useId, useMemo, useState } from 'react'
import type { AdminGalleryDTO } from '@shared/dto'
import { getGalleryLayout } from '../../../components/Gallery'
import Waterfall, { type WaterfallItem } from '../../../components/Waterfall'
import GalleryHeader from './GalleryHeader'
import GalleryTitlePopover from './GalleryTitlePopover'
import AdminPhotoBox from './AdminPhotoBox'
import type { MemberCanDelete } from './AdminConsole'

type Props = {
  gallery: AdminGalleryDTO
  memberCanDelete?: MemberCanDelete
  onGalleryChanged?: () => void | Promise<void>
  onChanged(): Promise<void>
  onWatterfallRefreshed(): void
}

export default function AdminGallery({
  gallery,
  memberCanDelete,
  onGalleryChanged,
  onChanged,
  onWatterfallRefreshed,
}: Props) {
  const [expanded, setExpanded] = useState(false)
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

  const items: WaterfallItem[] = useMemo(() => expanded ? gallery.photos.map(photo => ({
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
  })) : [], [box_width, expanded, gallery, layout.box_type, memberCanDelete, onChanged])

  return (
    <div className='gallery-wrapper'>
      <section className='admin-gallery'>
        <GalleryHeader
          name={gallery.name}
          expanded={expanded}
          controls={body_id}
          onToggle={() => setExpanded(value => !value)}
          renderName={(name, className) => (
            <GalleryTitlePopover
              gallery={gallery}
              trigger={(
                <button type='button' className={className}>
                  {name}
                </button>
              )}
              onSaved={onGalleryChanged ?? onChanged}
            />
          )}
        />
        <div id={body_id}>
          {expanded && (
            <Waterfall
              layout={layout}
              items={items}
              onWatterfallRefreshed={onWatterfallRefreshed}
            />
          )}
        </div>
      </section>
    </div>
  )
}
