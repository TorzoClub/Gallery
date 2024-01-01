import React, { useEffect, useMemo, useState } from 'react'

import './index.scss'

import Title from 'components/Title'
import PhotoStream from 'components/PhotoStream'
import { Gallery, Photo } from 'api/photo'
import { CoverClickEvent, Props as PhotoBoxProps } from 'components/PhotoBox'
import Submission from 'components/Submission'

export type PhotoStreamState = {
  screen: PhotoBoxProps['screen']
  column_count: number
  gallery_width: string
  column_gutter: string
}
const getPhotoStreamState = (): PhotoStreamState => {
  if (window.innerWidth > 1200) {
    return {
      screen: 'normal',
      column_count: 4,
      gallery_width: '1200px',
      column_gutter: '24px'
    }
  } else if (window.innerWidth > 640) {
    return {
      screen: 'normal',
      column_count: 3,
      gallery_width: '640px',
      column_gutter: '16px'
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

export type Props = {
  hideVoteButton: boolean
  gallery: Gallery
  selectedIdList: number[]
  onClickVote?: (photo_id: Photo['id']) => void
  onClickCover: (clickInfo: CoverClickEvent, photo: Photo['id']) => void
}
export default (props: Props) => {
  const [state, setState] = useState(getPhotoStreamState())

  useEffect(() => {
    let lastWidth: number

    setState(getPhotoStreamState())

    const resizeHandler = () => {
      // const { lastWidth } = this
      const { innerWidth } = window
      if (lastWidth !== innerWidth) {
        lastWidth = innerWidth
        setState(getPhotoStreamState())
      }
    }
    window.addEventListener('resize', resizeHandler)

    return () => window.removeEventListener('resize', resizeHandler)
  }, [])

  const { screen, column_count, gallery_width, column_gutter } = state
  const { hideVoteButton, gallery } = props

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

  return (
    <div className="gallery">
      {title_node}

      <PhotoStream
        hideVoteButton={hideVoteButton}
        screen={screen}
        column_count={column_count}
        total_width={gallery_width}
        gallery={gallery}
        photos={gallery.photos}
        gutter={column_gutter}
        selectedIdList={props.selectedIdList}

        onClickVote={(photoId) => {
          if (props.onClickVote) props.onClickVote(photoId)
        }}
        onClickCover={props.onClickCover}
      />
    </div>
  )
}
