import React, { useEffect, useMemo, useState } from 'react'

import './index.scss'

import Title from 'components/Title'
import Waterfall, { WaterfallLayout } from 'components/Waterfall'
import type { GalleryView } from 'pool/view'
import PhotoCard, { getPhotoCardScatter, type CoverClickEvent, type PhotoCardScatter } from 'components/PhotoCard'
import Submission from 'components/Submission'
import useSafeState from 'hooks/useSafeState'
import { dateDiffInDays } from 'utils/date'
import TextPlaceholder from './TextPlaceholder'

export type GalleryLayout = WaterfallLayout & {
  /** ≤ 900px 的紧凑布局：PhotoCard 散落得更小、更浅 */
  tight: boolean
}

function getViewportWidth() {
  const { innerWidth } = window
  return innerWidth
}

/** 宽屏列间距：给倾斜和横向位移留出余地（两列各占一半） */
const WIDE_GUTTER = 32
/** ≤ 900px 的列间距 */
const TIGHT_GUTTER = 20

const fixedLayout = ({
  column_count,
  gallery_width,
  column_gutter,
  tight,
}: Pick<GalleryLayout, 'column_count' | 'gallery_width' | 'column_gutter' | 'tight'>): GalleryLayout => ({
  tight,
  column_count,
  gallery_width,
  column_gutter,
  vertical_gutter: tight ? TIGHT_GUTTER : 27,
})

function computeColumnCountByBoxWidth(
  gallery_width: number,
  box_width: number,
  column_gutter: number,
  count = 0
) {
  const column_gutter_total = (count - 1) * column_gutter
  if (gallery_width < (box_width + column_gutter_total)) {
    return count
  } else {
    return computeColumnCountByBoxWidth(
      gallery_width - box_width,
      box_width,
      column_gutter,
      count + 1
    )
  }
}

function computeGalleryWidthWithAutoColumnCount(
  max_gallery_width: number,
  column_gutter: number,
  box_width: number,
) {
  const column_count = computeColumnCountByBoxWidth(
    max_gallery_width,
    box_width,
    column_gutter,
  )
  return {
    gallery_width: (box_width * column_count) + ((column_count - 1) * column_gutter),
    column_count
  } as const
}

const getLayoutConfigure = (): GalleryLayout => {
  const viewport_width = getViewportWidth()
  if (viewport_width > 1900) {
    const box_width = 232
    const column_gutter = 27
    const padding_horizontal = 54
    return fixedLayout({
      tight: false,
      column_gutter,
      ...computeGalleryWidthWithAutoColumnCount(
        viewport_width - (2 * padding_horizontal),
        column_gutter,
        box_width,
      ),
    })
  } else if (viewport_width > 1450) {
    return fixedLayout({ tight: false, gallery_width: 1200, column_count: 4, column_gutter: WIDE_GUTTER })
  } else if (viewport_width > 1150) {
    return fixedLayout({ tight: false, gallery_width: 900, column_count: 4, column_gutter: WIDE_GUTTER })
  } else if (viewport_width > 900) {
    return fixedLayout({ tight: false, gallery_width: 750, column_count: 3, column_gutter: WIDE_GUTTER })
  } else if (viewport_width > 640) {
    return fixedLayout({ tight: true, gallery_width: 640 - TIGHT_GUTTER * 2, column_count: 3, column_gutter: TIGHT_GUTTER })
  } else {
    return fixedLayout({
      tight: true,
      gallery_width: viewport_width - TIGHT_GUTTER * 2,
      column_count: 2,
      column_gutter: TIGHT_GUTTER,
    })
  }
}

export function getGalleryLayout(): GalleryLayout {
  return getLayoutConfigure()
}

export function galleryColumnWidth(layout: GalleryLayout): number {
  return (layout.gallery_width - layout.column_gutter * (layout.column_count - 1)) / layout.column_count
}

/** 瀑布流的一格：上下留白容纳纸胶带、倾斜多出来的高度和纵向错落；卡片在格子里居中，再由自身 transform 偏移、倾斜 */
export function PhotoCardCell({ scatter, children }: { scatter: PhotoCardScatter; children: React.ReactNode }) {
  return (
    <div
      className="photo-card-cell"
      style={{
        display: 'flex',
        justifyContent: 'center',
        paddingTop: `${scatter.pad_top}px`,
        paddingBottom: `${scatter.pad_bottom}px`,
      }}
    >
      {children}
    </div>
  )
}

export function scatterFor(layout: GalleryLayout, photo: {
  id: number
  width: number
  height: number
  desc: string
  member: unknown
}): PhotoCardScatter {
  return getPhotoCardScatter({
    id: photo.id,
    column_width: galleryColumnWidth(layout),
    column_gutter: layout.column_gutter,
    photo,
    desc_length: photo.desc.trim().length,
    has_member: Boolean(photo.member),
    tight: layout.tight,
  })
}

export type Props = {
  /** 显示登录成员自己放在相片上的磁粒 */
  show_vote_button: boolean
  /** 还能放 / 收回磁粒（投票期、已确认 QQ、尚未提交） */
  vote_interactive?: boolean
  gallery: GalleryView
  selected_id_list: number[]
  onClickVote?: (photo_id: number) => void
  onClickCover: (clickInfo: CoverClickEvent, photo_id: number) => void
  onWatterfallRefreshed(): void
}
export default ({
  show_vote_button,
  vote_interactive = false,
  gallery,
  selected_id_list,
  onClickVote,
  onClickCover,
  onWatterfallRefreshed,
}: Props) => {
  const layout = useWaterfallLayout()

  const title_node = useTitleNode(gallery)

  const waterfall_layout_node = useMemo(() => {
    const day_diff = dateDiffInDays(new Date(gallery.event_start), new Date)
    const items = gallery.photos.map(photo => {
      const scatter = scatterFor(layout, photo)
      return {
        id: String(photo.id),
        node: (
          <PhotoCardCell scatter={scatter}>
            <PhotoCard
              id={photo.id}
              width={scatter.card_width}
              tilt={{ rotate: scatter.rotate, x: scatter.offset_x }}
              tape={{ x: scatter.tape_x, rotate: scatter.tape_rotate }}
              onClickCover={(click_info) => onClickCover(click_info, photo.id)}
              hideMember={!photo.member}
              vote={show_vote_button ? {
                selected: selected_id_list.includes(photo.id),
                interactive: vote_interactive,
                onToggle: () => onClickVote?.(photo.id),
              } : undefined}
              name={photo.member ? photo.member.name : null}
              desc={photo.desc}
              photo={{
                width: photo.width,
                height: photo.height,
                src: photo.src_url,
                thumb: photo.thumb,
              }}
              avatar={photo.member ? {
                width: 0,
                height: 0,
                thumb: photo.member.avatar_thumb_url,
                src: photo.member.avatar_thumb_url,
              } : null}
            />
          </PhotoCardCell>
        ),
      }
    })
    const waterfall = () => (
      <Waterfall
        layout={layout}
        items={items}
        onWatterfallRefreshed={onWatterfallRefreshed}
      />
    )

    if (gallery.in_event) {
      if (gallery.can_submission && (gallery.photos.length === 0)) {
        return <TextPlaceholder>提交你的投稿</TextPlaceholder>
      } else {
        return waterfall()
      }
    } else {
      if (gallery.photos.length === 0) {
        if ((day_diff < 30) && day_diff > 0) {
          return (
            <TextPlaceholder>
              活动将于 { day_diff } 天后开始<br />
            </TextPlaceholder>
          )
        } else {
          return <TextPlaceholder>暂无相片</TextPlaceholder>
        }
      } else {
        return waterfall()
      }
    }
  }, [gallery.can_submission, gallery.event_start, gallery.in_event, gallery.photos, layout, onClickCover, onClickVote, onWatterfallRefreshed, selected_id_list, show_vote_button, vote_interactive])

  return (
    <div className="gallery">
      { title_node }
      { waterfall_layout_node }
    </div>
  )
}

function useWaterfallLayout() {
  const [layout, refreshLayout] = useSafeState(getLayoutConfigure())

  useEffect(() => {
    let latest_width: number | undefined
    updateState()

    function updateState() {
      const viewport_width = getViewportWidth()
      if (latest_width !== viewport_width) {
        latest_width = viewport_width
        refreshLayout(getLayoutConfigure())
      }
    }
    window.addEventListener('resize', updateState)
    return () => window.removeEventListener('resize', updateState)
  }, [refreshLayout])

  return layout
}

function useTitleNode(gallery: GalleryView) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (gallery.can_submission) {
      if (!open) {
        const h = setTimeout(() => {
          setOpen(true)
        }, 1000)
        return () => clearTimeout(h)
      }
    }
  }, [gallery.can_submission, open])

  const title_node = useMemo(() => (
    <div onClick={() => {}} style={{ marginBottom: '20px' }}>
      <Title title={gallery.name} open={open} keepTransition={true}>
        <Submission gallery={gallery} />
      </Title>
    </div>
  ), [gallery, open])

  return title_node
}
