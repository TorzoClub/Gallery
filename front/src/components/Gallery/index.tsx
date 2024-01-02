import React, { useEffect, useMemo, useState } from 'react'

import './index.scss'

import Title from 'components/Title'
import PhotoStream from 'components/PhotoStream'
import { Gallery, Photo } from 'api/photo'
import { CoverClickEvent, Props as PhotoBoxProps } from 'components/PhotoBox'
import Submission from 'components/Submission'
import useSafeState from 'hooks/useSafeState'

export type PhotoStreamLayout = {
  screen: PhotoBoxProps['screen']
  column_count: number
  gallery_width: string
  column_gutter: string
}
const photoStreamLayout = (): PhotoStreamLayout => {
  const viewport_width = getViewportWidth()
  if (viewport_width > 2100) {
    return {
      screen: 'normal',
      column_count: 6,
      gallery_width: '1750px',
      column_gutter: '54px'
    }
  } else if (viewport_width > 1450) {
    return {
      screen: 'normal',
      column_count: 4,
      gallery_width: '1200px',
      column_gutter: '54px'
    }
  } else if (viewport_width > 1150) {
    return {
      screen: 'normal',
      column_count: 4,
      gallery_width: '900px',
      column_gutter: '54px'
    }
  } else if (viewport_width > 900) {
    return {
      screen: 'normal',
      column_count: 3,
      gallery_width: '700px',
      column_gutter: '54px'
    }
  } else if (viewport_width > 640) {
    return {
      screen: 'mobile',
      column_count: 3,
      gallery_width: '600px',
      column_gutter: '12px'
    }
  } else {
    return {
      screen: 'mobile',
      column_count: 2,
      gallery_width: '100vw',
      column_gutter: '8px'
    }
  }
}

function getViewportWidth() {
  const { innerWidth } = window
  return innerWidth
}

export type Props = {
  hideVoteButton: boolean
  gallery: Gallery
  selectedIdList: number[]
  onClickVote?: (photo_id: Photo['id']) => void
  onClickCover: (clickInfo: CoverClickEvent, photo: Photo['id']) => void
}
export default (props: Props) => {
  const [layout, refreshLayout] = useSafeState(photoStreamLayout())

  console.log('gallery render')

  useEffect(() => {
    let latest_width: number | undefined
    // setState(getPhotoStreamState())
    updateState()

    function updateState() {
      const viewport_width = getViewportWidth()
      if (latest_width !== viewport_width) {
        latest_width = viewport_width
        refreshLayout(photoStreamLayout())
      }
    }
    window.addEventListener('resize', updateState)
    return () => window.removeEventListener('resize', updateState)
  }, [refreshLayout])

  const { screen, column_count, gallery_width, column_gutter } = layout
  const { hideVoteButton, gallery } = props

  const title_node = useTitleNode(gallery)

  return (
    <div className="gallery">
      { title_node }
      {
        useMemo(() => (
          <PhotoStream
            photoStreamLayout={layout}
            photos={gallery.photos}
            selectedIdList={props.selectedIdList}
            hideVoteButton={hideVoteButton}
            onClickVote={(photoId) => {
              if (props.onClickVote) props.onClickVote(photoId)
            }}
            onClickCover={props.onClickCover}
          />
        ), [gallery.photos, hideVoteButton, props, layout])
      }
    </div>
  )
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
