import React, { useEffect, useMemo, useState } from 'react'
import type { AdminGalleryDTO } from '@shared/dto'
import { getGalleryLayout } from '../../../components/Gallery'
import Waterfall, { type WaterfallItem } from '../../../components/Waterfall'
import Title from '../../../components/Title'
import AdminPhotoBox from './AdminPhotoBox'
import type { MemberCanDelete } from './AdminConsole'

type Props = {
  gallery: AdminGalleryDTO
  memberCanDelete?: MemberCanDelete
  onChanged(): Promise<void>
  onWatterfallRefreshed(): void
}

export default function AdminGallery({
  gallery,
  memberCanDelete,
  onChanged,
  onWatterfallRefreshed,
}: Props) {
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

  const items: WaterfallItem[] = useMemo(() => gallery.photos.map(photo => ({
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
  })), [box_width, gallery, layout.box_type, memberCanDelete, onChanged])

  return (
    <div className='gallery-wrapper'>
      <section className='gallery'>
        <Title title={gallery.name} keepTransition={false} />
        <Waterfall
          layout={layout}
          items={items}
          onWatterfallRefreshed={onWatterfallRefreshed}
        />
      </section>
    </div>
  )
}
