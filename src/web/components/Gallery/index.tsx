import React, { useEffect, useMemo, useState } from 'react'

import './index.scss'

import Title from 'components/Title'
import Waterfall, { WaterfallLayout } from 'components/Waterfall'
import type { GalleryView } from 'pool/view'
import PhotoBox, { CoverClickEvent, Props as PhotoBoxProps } from 'components/PhotoBox'
import Submission from 'components/Submission'
import useSafeState from 'hooks/useSafeState'
import { dateDiffInDays } from 'utils/date'
import TextPlaceholder from './TextPlaceholder'

export type GalleryLayout = WaterfallLayout & {
  box_type: PhotoBoxProps['type']
}

function getViewportWidth() {
  const { innerWidth } = window
  return innerWidth
}

const normalLayout = ({
  column_count,
  gallery_width,
}: Pick<GalleryLayout, 'column_count' | 'gallery_width'>): GalleryLayout => {
  const column_gutter = 54
  const vertial_gutter = column_gutter / 2
  return {
    box_type: 'normal',
    column_count,
    gallery_width,
    column_gutter,
    vertical_gutter: vertial_gutter,
  }
}

const compactLayout = (g: Pick<GalleryView, 'in_event' | 'can_submission'>, {
  column_count,
  column_gutter,
  vote_event_vertial_gutter,
  gallery_width = getViewportWidth() - (column_gutter * column_count)
}: Pick<GalleryLayout, 'column_count' | 'column_gutter'> & {
  vote_event_vertial_gutter: number
  gallery_width?: number
}): GalleryLayout => {
  const is_vote_date = g.in_event && !g.can_submission
  const vertial_gutter = is_vote_date ? vote_event_vertial_gutter : column_gutter

  return {
    box_type: 'compact',
    column_count: column_count,
    gallery_width,
    column_gutter: column_gutter,
    vertical_gutter: vertial_gutter,
  }
}

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

const getLayoutConfigure = (gallery: Pick<GalleryView, 'in_event' | 'can_submission'>): GalleryLayout => {
  const viewport_width = getViewportWidth()
  if (viewport_width > 1900) {
    const box_width = 232
    const column_gutter = 27
    const padding_horizontal = 54
    return compactLayout(gallery, {
      column_gutter,
      vote_event_vertial_gutter: 27,
      ...computeGalleryWidthWithAutoColumnCount(
        viewport_width - (2 * padding_horizontal),
        column_gutter,
        box_width,
      )
    })
  } else if (viewport_width > 1450) {
    return normalLayout({
      gallery_width: 1200,
      column_count: 4,
    })
  } else if (viewport_width > 1150) {
    return normalLayout({
      gallery_width: 900,
      column_count: 4,
    })
  } else if (viewport_width > 900) {
    return normalLayout({
      gallery_width: 750,
      column_count: 3,
    })
  } else if (viewport_width > 640) {
    return compactLayout(gallery, {
      gallery_width: 640 - 8 * 2,
      column_count: 3,
      column_gutter: 8,
      vote_event_vertial_gutter: 27
    })
  } else {
    return compactLayout(gallery, {
      column_count: 2,
      column_gutter: 8,
      vote_event_vertial_gutter: 27
    })
  }
}

export function getGalleryLayout(
  gallery: Pick<GalleryView, 'in_event' | 'can_submission'>,
): GalleryLayout {
  return getLayoutConfigure(gallery)
}

export type Props = {
  cannot_add_vote?: boolean
  show_vote_button: boolean
  gallery: GalleryView
  selected_id_list: number[]
  onClickVote?: (photo_id: number) => void
  onClickCover: (clickInfo: CoverClickEvent, photo_id: number) => void
  onWatterfallRefreshed(): void
}
export default ({
  cannot_add_vote = false,
  show_vote_button,
  gallery,
  selected_id_list,
  onClickVote,
  onClickCover,
  onWatterfallRefreshed,
}: Props) => {
  const layout = useWaterfallLayout(gallery)

  const title_node = useTitleNode(gallery)

  const waterfall_layout_node = useMemo(() => {
    const day_diff = dateDiffInDays(new Date(gallery.event_start), new Date)
    const items = gallery.photos.map(photo => ({
      id: String(photo.id),
      node: (
        <PhotoBox
          id={photo.id}
          type={layout.box_type}
          box_width={(layout.gallery_width - layout.column_gutter * (layout.column_count - 1)) / layout.column_count}
          onClickCover={(click_info) => onClickCover(click_info, photo.id)}
          {...{
            hideMember: !photo.member,
            show_vote_button: show_vote_button,
            vote_button_status: (
              selected_id_list.indexOf(photo.id) !== -1
                ? 'selected'
                : (cannot_add_vote ? 'cannot-add' : 'un-selected')
            ),
            handleClickVote: () => onClickVote?.(photo.id),
            name: photo.member ? photo.member.name : null,
            desc: photo.desc,
            photo: {
              width: photo.width,
              height: photo.height,
              src: photo.src_url,
              thumb: photo.thumb,
            },
            avatar: photo.member ? {
              width: 0,
              height: 0,
              thumb: photo.member.avatar_thumb_url,
              src: photo.member.avatar_thumb_url,
            } : null,
          }}
        />
      ),
    }))
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
  }, [cannot_add_vote, gallery.can_submission, gallery.event_start, gallery.in_event, gallery.photos, layout, onClickCover, onClickVote, onWatterfallRefreshed, selected_id_list, show_vote_button])

  return (
    <div className="gallery">
      { title_node }
      { waterfall_layout_node }
    </div>
  )
}

function useWaterfallLayout(gallery: GalleryView) {
  const [layout, refreshLayout] = useSafeState(getLayoutConfigure(gallery))

  useEffect(() => {
    let latest_width: number | undefined
    updateState()

    function updateState() {
      const viewport_width = getViewportWidth()
      if (latest_width !== viewport_width) {
        latest_width = viewport_width
        refreshLayout(getLayoutConfigure(gallery))
      }
    }
    window.addEventListener('resize', updateState)
    return () => window.removeEventListener('resize', updateState)
  }, [gallery, refreshLayout])

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
    <div onClick={() => {}}>
      <Title title={gallery.name} open={open} keepTransition={true}>
        <Submission gallery={gallery} />
      </Title>
    </div>
  ), [gallery, open])

  return title_node
}
