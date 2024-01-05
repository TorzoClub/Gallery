import React, { useMemo, useState } from 'react'
import { GalleryInActive, Photo } from 'api/photo'
import { ConfirmQQState } from 'components/ConfirmQQ'
import { Detail } from 'components/Detail'

import Gallery, { Props as GalleryProps } from 'components/Gallery'
import Loading from 'components/Loading'
import GuideLayout from 'components/GuideLayout'
import SkeuomorphismButton from 'components/SkeuomorphismButton'
import { findListByProperty, removeListItemByIdx } from 'utils/common'

type ActivityLayoutProps = {
  active: GalleryInActive
  show_submit_vote_button: boolean
  hide_vote_button: boolean
  submiting: boolean
  showArrow: boolean,
  confirmState: ConfirmQQState

  submitted_pool: Record<string, number | undefined>
  selected_id_list: number[]
  setSelectedIdList: (idList: number[]) => void

  onClickCover: GalleryProps['onClickCover']

  toDetail: (d: Detail) => void
  onClickSubmit: () => void
}

export default function ActivityLayout({
  active,
  hide_vote_button,
  submiting,
  showArrow,
  confirmState,

  submitted_pool,
  selected_id_list,
  setSelectedIdList,

  toDetail,
  onClickSubmit,
  ...remain_props
}: ActivityLayoutProps) {
  const [arrow_tick_tock, setArrowTickTock] = useState(0)

  const in_vote_period = active.in_event && !active.can_submission

  const show_submit_button = remain_props.show_submit_vote_button && (in_vote_period && !active.vote_submitted)

  const vote_is_submitted = Boolean(submitted_pool[active.id])

  const cannot_select_vote = useMemo(() => {
    const is_unlimited = active.vote_limit === 0
    const over_limit = !is_unlimited && (selected_id_list.length >= active.vote_limit)

    return Boolean(over_limit || active.vote_submitted || vote_is_submitted)
  }, [active.vote_limit, active.vote_submitted, selected_id_list.length, vote_is_submitted])

  const handleClickVote = (photo_id: Photo['id']) => {
    if (cannot_select_vote || !in_vote_period) {
      return
    } else {
      const idx = selected_id_list.indexOf(photo_id)
      if (idx !== -1) {
        setArrowTickTock(-Date.now())
        setSelectedIdList(
          removeListItemByIdx(selected_id_list, idx)
        )
      } else {
        setArrowTickTock(Date.now())
        setSelectedIdList([...selected_id_list, photo_id])
      }
    }
  }

  const button_state = useMemo(() => {
    if (confirmState.in || (selected_id_list.length === 0)) {
      return 'disabled'
    } else {
      return 'highlight'
    }
  }, [confirmState.in, selected_id_list.length])

  return (
    <div className="gallery-wrapper">
      <Gallery
        gallery={active}
        cannot_select_vote={cannot_select_vote}
        hideVoteButton={hide_vote_button}
        selectedIdList={selected_id_list}
        onClickVote={handleClickVote}
        onClickCover={remain_props.onClickCover}
      />
      {show_submit_button && (
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
                  animatedTickTock={arrow_tick_tock}
                >
                  <SubmitButton
                    buttonState={button_state}
                    onClick={() => {
                      if (!submiting) {
                        if (selected_id_list.length === 0) {
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
