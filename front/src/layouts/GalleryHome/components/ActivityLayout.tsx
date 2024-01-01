import React, { useMemo, useState } from 'react'
import { GalleryInActive, Photo } from 'api/photo'
import { ConfirmQQState } from 'components/ConfirmQQ'
import { Detail } from 'components/Detail'

import { Gallery as GalleryType } from 'api/photo'
import Gallery from 'components/Gallery'
import Loading from 'components/Loading'
import GuideLayout from 'components/GuideLayout'
import SkeuomorphismButton from 'components/SkeuomorphismButton'

type ActivityLayoutProps = {
  active: GalleryInActive
  hideVoteButton: boolean
  submiting: boolean
  showArrow: boolean,
  confirmState: ConfirmQQState

  submittedPool: Record<string, number | undefined>
  selectedIdList: number[]
  setSelectedIdList: (idList: number[]) => void

  toDetail: (d: Detail) => void
  onClickSubmit: () => void
}

export default function ActivityLayout({
  active,
  hideVoteButton,
  submiting,
  showArrow,
  confirmState,

  submittedPool,
  selectedIdList,
  setSelectedIdList,

  toDetail,
  onClickSubmit,
}: ActivityLayoutProps) {
  const [arrowTickTock, setArrowTickTock] = useState(0)

  const showSubmitButton = useMemo(() => {
    if (active.can_submission || active.vote_submitted) {
      return false
    } else {
      return true
    }
  }, [active.can_submission, active.vote_submitted])
  const vote_is_submitted = submittedPool[active.id]

  const buttonState = useMemo(() => {
    if (confirmState.in) {
      return 'disabled'
    } else if (selectedIdList.length === 0) {
      return 'disabled'
    } else {
      return 'highlight'
    }
  }, [confirmState.in, selectedIdList.length])

  const handleClickVote = (gallery: GalleryType, photo: Photo) => {
    // console.log('handleClickVote', gallery.vote_submitted, photo)

    const isSubmitted = submittedPool[gallery.id]
    const can_vote = gallery.in_event && !gallery.can_submission

    if (isSubmitted || !can_vote || gallery.vote_submitted) {
      return
    }

    const { id } = photo

    const newSelectedIdList = [...selectedIdList]

    const idx = newSelectedIdList.indexOf(id)

    if (idx === -1) {
      if ((gallery.vote_limit > 0) && (newSelectedIdList.length >= gallery.vote_limit)) {
        return
      } else {
        setArrowTickTock(Date.now())
        newSelectedIdList.push(id)
      }
    } else {
      newSelectedIdList.splice(idx, 1)
      setArrowTickTock(-Date.now())
    }

    setSelectedIdList(newSelectedIdList)
  }

  return (
    <div className="gallery-wrapper">
      <Gallery
        hideVoteButton={hideVoteButton}
        gallery={active}
        selectedIdList={selectedIdList}
        onClickVote={(photoId) => {
          const idx = active.photos.map(p => p.id).indexOf(photoId)
          if (idx === -1) return
          const photo = active.photos[idx]

          handleClickVote(active, photo)
        }}
        onClickCover={({ from, thumbBlobUrl }, photoId) => {
          const idx = active.photos.map(p => p.id).indexOf(photoId)
          if (idx === -1) return
          const photo = active.photos[idx]

          toDetail({
            from,
            thumb: thumbBlobUrl,
            src: photo.src_url,
            height: photo.height,
            width: photo.width
          })
        }}
      />
      {showSubmitButton && (
        <div className="submit-button-area">
          {(() => {
            if (submiting) {
              return <Loading />
            } else if (vote_is_submitted) {
              return <div className="submitted">感谢你的投票</div>
            } else {
              return (
                <GuideLayout
                  showArrow={showArrow}
                  animatedTickTock={arrowTickTock}
                >
                  <SubmitButton
                    buttonState={buttonState}
                    onClick={() => {
                      if (!vote_is_submitted && !submiting) {
                        if (selectedIdList.length === 0) {
                          alert('你需要选择至少一部作品才能提交投票')
                        } else {
                          onClickSubmit()
                        }
                      }
                    }}
                  />
                </GuideLayout>
              )
            }
          })()}

          <style>{`
            .submitted {
              color: #999999;
            }
            .submit-button-area {
              margin-top: 32px;

              height: 64px;
              width: 100%;

              display: flex;
              align-items: center;
              align-content: center;
              justify-content: center;
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

type ButttonState = 'disabled' | 'highlight' | 'normal'
export const SubmitButton = ({ onClick, buttonState }: {
  onClick?(): void
  buttonState?: ButttonState
}) => (
  <>
    <div className={`grayscale-wrap ${buttonState === 'disabled' && 'enabled'}`}>
      <div className={`submit-button-wrap ${buttonState}`}>
        <SkeuomorphismButton onClick={onClick}>提交</SkeuomorphismButton>
      </div>
    </div>
    <style>{`
      .grayscale-wrap {
        transition: filter 382ms;
      }
      .grayscale-wrap.enabled {
        filter: grayscale(1) brightness(1) opacity(0.75);
      }

      .submit-button-wrap {
        animation: submitbuttonhighlight 3s infinite;
        animation-timing-function: ease-in-out;
        animation-direction: normal;
        animation-fill-mode: forwards;
        animation-play-state: paused;
        animation-delay: 500ms;
      }
      .submit-button-wrap.disabled {

      }
      @keyframes submitbuttonhighlight {
        0% { filter: brightness(1) }
        50% { filter: brightness(1.2) }
        100% { filter: brightness(1) }
      }
      .submit-button-wrap.highlight {
        animation-play-state: running;
      }
    `}</style>
  </>
)
