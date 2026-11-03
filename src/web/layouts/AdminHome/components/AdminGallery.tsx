import React, { useEffect, useId, useMemo, useState } from 'react'
import type { AdminGalleryDTO, MemberDTO } from '@shared/dto'
import { getGalleryLayout, PhotoCardCell, scatterFor } from '../../../components/Gallery'
import Waterfall, { type WaterfallItem } from '../../../components/Waterfall'
import GalleryHeader from './GalleryHeader'
import GalleryManagePanel, { type MemberHistory } from './GalleryManagePanel'
import AdminPhotoCard from './AdminPhotoCard'
import { VoteMagnetLegend } from './VoteMagnets'
import { sortPhotos } from '../../../admin/api/photo'
import { EMPTY_PHOTO_VOTES, indexPhotoVotes, sortGalleryPhotos, type PhotoSortBy, type PhotoSortDirection } from './photo-votes'
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
  dragOffsetY?: number
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
  dragOffsetY = 0,
  onDragPointerDown,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [photo_sort_by, setPhotoSortBy] = useState<PhotoSortBy>('created_at')
  const [photo_sort_direction, setPhotoSortDirection] = useState<PhotoSortDirection>('asc')
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
    return getGalleryLayout()
  }, [viewport_width])
  const votes_by_photo = useMemo(
    () => indexPhotoVotes(gallery.id, gallery.vote_records, members),
    [gallery.id, gallery.vote_records, members],
  )

  const sorted_photos = useMemo(
    () => sortGalleryPhotos(gallery.photos, votes_by_photo, photo_sort_by, photo_sort_direction),
    [gallery.photos, votes_by_photo, photo_sort_by, photo_sort_direction],
  )

  // 与公开页同一套散落摆放（同一张相片在两边的大小、倾角、位移完全一致）
  const items: WaterfallItem[] = useMemo(() => show_expanded ? sorted_photos.map(photo => {
    const scatter = scatterFor(layout, photo)
    return {
      id: String(photo.id),
      node: (
        <PhotoCardCell scatter={scatter}>
          <AdminPhotoCard
            gallery={gallery}
            photo={photo}
            votes={votes_by_photo.get(photo.id) ?? EMPTY_PHOTO_VOTES}
            scatter={scatter}
            memberCanDelete={memberCanDelete}
            onChanged={onChanged}
          />
        </PhotoCardCell>
      ),
    }
  }) : [], [show_expanded, gallery, layout, memberCanDelete, onChanged, votes_by_photo, sorted_photos])

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
          dragOffsetY={dragOffsetY}
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
                  <>
                    <VoteMagnetLegend
                      sort_by={photo_sort_by}
                      direction={photo_sort_direction}
                      onSortByChange={setPhotoSortBy}
                      onDirectionChange={setPhotoSortDirection}
                      onFreeze={async () => {
                        // 一次请求按当前展示顺序写完整个相册的 index；失败会抛给弹层显示
                        await sortPhotos(gallery.id, sorted_photos.map(photo => photo.id))
                        await (onGalleryChanged ?? onChanged)()
                      }}
                    />
                    <Waterfall
                      preservePositions={false}
                      layout={layout}
                      items={items}
                      onWatterfallRefreshed={onWatterfallRefreshed}
                    />
                  </>
                )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
