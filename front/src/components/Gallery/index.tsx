import React, { useEffect, useMemo, useState } from 'react'

import './index.scss'

import Title from 'components/Title'
import Waterfall, { WaterfallLayoutConfigure } from 'components/Waterfall'
import { Gallery, Photo } from 'api/photo'
import { CoverClickEvent, Props as PhotoBoxProps } from 'components/PhotoBox'
import Submission from 'components/Submission'
import useSafeState from 'hooks/useSafeState'

function getViewportWidth() {
  const { innerWidth } = window
  return innerWidth
}

const normalLayout = ({
  column_count,
  gallery_width,
}: Pick<WaterfallLayoutConfigure, 'column_count' | 'gallery_width'>): WaterfallLayoutConfigure => {
  const column_gutter = 54
  const vertial_gutter = column_gutter / 2
  return {
    box_type: 'normal',
    column_count,
    gallery_width,
    column_gutter,
    vertial_gutter,
  }
}

const compactLayout = (g: Gallery, {
  column_count,
  column_gutter,
  vote_event_vertial_gutter,
  gallery_width = getViewportWidth() - (column_gutter * column_count)
}: Pick<WaterfallLayoutConfigure, 'column_count' | 'column_gutter'> & {
  vote_event_vertial_gutter: number
  gallery_width?: number
}): WaterfallLayoutConfigure => {
  const is_vote_date = g.in_event && !g.can_submission
  const vertial_gutter = is_vote_date ? vote_event_vertial_gutter : column_gutter

  return {
    box_type: 'compact',
    column_count: column_count,
    gallery_width,
    column_gutter: column_gutter,
    vertial_gutter,
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

const getLayoutConfigure = (gallery: Gallery): WaterfallLayoutConfigure => {
  const viewport_width = getViewportWidth()
  if (viewport_width > 2100) {
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

export type Props = {
  cannot_select_vote?: boolean
  hideVoteButton: boolean
  gallery: Gallery
  selectedIdList: number[]
  onClickVote?: (photo_id: Photo['id']) => void
  onClickCover: (clickInfo: CoverClickEvent, photo_id: Photo['id']) => void
}
export default ({
  cannot_select_vote = false,
  hideVoteButton, gallery, selectedIdList, onClickVote, onClickCover,
}: Props) => {
  const layout = useWaterfallLayout(gallery)

  const title_node = useTitleNode(gallery)

  const waterfall_layout_node = useMemo(() => (
    <Waterfall
      layout_configure={layout}
      cannot_select_vote={cannot_select_vote}
      photos={gallery.photos}
      selectedIdList={selectedIdList}
      hideVoteButton={hideVoteButton}
      onClickCover={onClickCover}
      onClickVote={(photoId) => {
        onClickVote && onClickVote(photoId)
      }}
    />
  ), [cannot_select_vote, gallery.photos, hideVoteButton, layout, onClickCover, onClickVote, selectedIdList])

  return (
    <div className="gallery">
      { title_node }
      { waterfall_layout_node }
    </div>
  )
}

function useWaterfallLayout(gallery: Gallery) {
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

function useTitleNode(gallery: Gallery) {
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
