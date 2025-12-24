import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { nextTick, Signal, timeout } from 'new-vait'

import { global_queue } from 'utils/queue-load'
const { isLoading: globalQueueIsLoading, load: globalQueueLoad, } = global_queue

import { findListByProperty, removeListItemByIdx, sortByIdList, updateListItemById } from 'utils/common'
import { AppCriticalError } from 'App'

import { GalleryCommon, GalleryInActive, Member, Photo, fetchList, fetchListResult, fetchListWithQQNum, vote } from 'api/photo'

import LoadingLayout from './components/LoadingLayout'
import ActivityLayout from './components/ActivityLayout'
import AllEmptyLayout from './components/AllEmptyLayout'
import useConfirmQQ from './useConfirmQQ'
import { useSubmissionEvent } from 'components/Submission'

import Gallery from 'components/Gallery'
import PhotoDetail, { Detail } from 'components/Detail'
import ConfirmVote from 'components/ConfirmVote'
import shuffleArray from 'utils/shuffle-array'
import { WaterfallLayoutClickCoverHandler } from 'components/Waterfall'

const watterfall_refreshed = Signal()

function useScrollDirection() {
  const previousScrollY = useRef<number>(window.scrollY)
  const scrollDirection = useRef<'down' | 'up'>('down')
  useEffect(() => {
    const scrollHandler = () => {
      if (window.scrollY >= previousScrollY.current) {
        scrollDirection.current = 'down'
      } else {
        scrollDirection.current = 'up'
      }
      previousScrollY.current = window.scrollY
    }
    window.addEventListener('scroll', scrollHandler)
    return () => {
      window.removeEventListener('scroll', scrollHandler)
    }
  }, [])
  return useCallback(() => scrollDirection.current, [])
}

function usePhotoLoadingPriority(
  photo_list: Photo[]
) {
  const getDirection = useScrollDirection()

  const id_src_map = useMemo(() => {
    const m = new Map<number, string>()
    photo_list.forEach(p => m.set(p.id, p.thumb_url))
    return m
  }, [photo_list])

  const resort = useCallback(function _resortHandler() {
    type Position = 'in_screen' | 'above' | 'bottom'
    const bounding_appended_photos = photo_list.map((photo, idx) => {
      const photo_el = document.getElementById(`photo-${photo.id}`)
      if (!photo_el) { return }
      const bounding = photo_el.getBoundingClientRect()
      if (
        (bounding.y > (0 - bounding.height)) &&
        (bounding.y <= window.innerHeight)
      ) {
        return { idx, photo, bounding, position: 'in_screen' }
      } else {
        if (bounding.y > window.innerHeight) {
          return { idx, photo, bounding, position: 'bottom' }
        } else {
          return { idx, photo, bounding, position: 'above' }
        }
      }
    }).filter(p => p) as { idx: number; photo: Photo, bounding: DOMRect; position: Position }[]

    const sorted = bounding_appended_photos.sort((a, b) => {
      if (a.bounding.y === b.bounding.y) {
        return a.idx > b.idx ? 1 : -1
      } else {
        return a.bounding.y > b.bounding.y ? 1 : -1
      }
    })

    const S_UP = 1
    const S_DOWN = -1
    const coe = {
      I: 1,
      II: 10,
      III: 20,
      IV: 30,
      V: 40,
      VI: 50,
      VII: 60,
    } as const

    const PRIORITY = {
      'in_screen': { down: [S_DOWN, coe.VII, coe.VI], up: [S_UP, coe.VII, coe.VI] },
      'bottom': { down: [S_DOWN, coe.V, coe.III], up: [S_DOWN, coe.IV, coe.II] },
      'above': { down: [S_UP, coe.IV, coe.II], up: [S_UP, coe.V, coe.III] },
    } as const

    function calcPriority(position: Position, length: number, idx: number) {
      const [load_direction, photo_coe, avatar_coe] = PRIORITY[position][getDirection()]
      const sort = load_direction * idx
      return [(photo_coe * length + sort), (avatar_coe * length + sort)] as const
    }

    const mem_unique = new Map<string, number>()
    sorted.forEach(({ photo, position }, idx) => {
      const src = id_src_map.get(photo.id)
      if (src) {
        const [photo_p, avatar_p] = calcPriority(position, sorted.length, idx)
        globalQueueLoad(src, photo_p)
        if (photo.member) {
          const { avatar_thumb_url } = photo.member
          const p = mem_unique.get(avatar_thumb_url)
          if ( (p === undefined) || (avatar_p > p) ) {
            mem_unique.set(avatar_thumb_url, avatar_p)
            globalQueueLoad(avatar_thumb_url, avatar_p)
          }
        }
      }
    })
  }, [getDirection, id_src_map, photo_list])

  useEffect(() => {
    let mounted = true
    const resortHandler = () => {
      if (globalQueueIsLoading()) {
        nextTick().then(() => mounted && resort())
      }
    }

    window.addEventListener('resize', resortHandler)
    window.addEventListener('scroll', resortHandler)

    let handler
    const cancel =watterfall_refreshed.receive(() => {
      clearTimeout(handler)
      handler = setTimeout(() => {
        resort()
        global_queue.startWorking()
      }, 0)
    })

    return () => {
      mounted = false
      window.removeEventListener('resize', resortHandler)
      window.removeEventListener('scroll', resortHandler)
      clearTimeout(handler)
      cancel()
    }
  }, [resort])

  return resort
}

function useVoteReady(active: GalleryInActive | null) {
  const [ vote_ready, showSubmitButtonArea ] = useState(false)
  const in_vote_period = useMemo(() => {
    if (active) {
      return Boolean(active.in_event && !active.can_submission)
    } else { return false }
  }, [active])
  const show_submit_button_area = useMemo(() => {
    if (active) {
      const active_vote_submitted = Boolean(active.vote_submitted)
      return vote_ready && (
        in_vote_period && !active_vote_submitted
      )
    } else {
      return false
    }
  }, [active, in_vote_period, vote_ready])

  return  {
    in_vote_period,
    show_submit_button_area,
    showSubmitButtonArea,
  } as const
}

type PageStatus = 'LOADING' | 'NONE_EVENT' | 'SUBMISSION' | 'VOTE';
const page_status: PageStatus = 'LOADING'

export default () => {
  const [loaded, setLoaded] = useState(false)

  const [showArrow, setShowArrow] = useState(false)

  const [selected_id_list, setSelectedIdList] = useState<number[]>([])

  const [submiting, setSubmiting] = useState(false)

  const [active, setActive] = useState<null | fetchListResult['active']>(null)
  const [list, setList] = useState<fetchListResult['galleries']>([])

  const { in_vote_period, show_submit_button_area, showSubmitButtonArea } = useVoteReady(active)

  const [submitted_pool, setSubmittedPool] = useState<Record<string, number | undefined>>({})

  const suffled_idx_list = useMemo(() => {
    return (active === null) ? [] : active.photos.map(p => p.id)
  }, [active])

  usePhotoLoadingPriority(
    useMemo(() => [
      ...(active ? active.photos : []),
      ...list.map(g => g.photos).flat(),
    ], [active, list])
  )

  const [imageDetail, setImageDetail] = useState<Detail | null>(null)
  const [currentQQNum, setCurrentQQNum] = useState(0)

  const [ConfirmQQLayout, confirmState, setConfirmState] = useConfirmQQ({
    onConfirmSuccess(qq_num) {
      setCurrentQQNum(Number(qq_num))
    }
  })

  const [showConfirmVoteLayout, setShowConfirmVoteLayout] = useState(false)

  useEffect(() => {
    let mounted = true
    if (loaded === true) { return }
    fetchList().then(({ active, galleries: list }) => {
      if (mounted === false) { return }
      setLoaded(true)

      if (active !== null) {
        const photos = shuffleArray(active.photos)
        setActive({
          ...active,
          photos: photos
        })
      } else {
        setActive(null)
        setList(list)
      }
    }).catch(err => AppCriticalError(`获取相册列表失败: ${err}`))
    return () => { mounted = false }
  }, [loaded, setActive])

  const [ event_loaded, setEventLoaded ] = useState(false)
  useEffect(() => {
    if (loaded === false) { return }
    else if (event_loaded === true) { return }
    else if (!active) {
      // 没活动？那没事了
      // setHideVoteButton(true)
      return
    }

    if (active.can_submission) {
      // 征集投稿期间
      return
    } else if (!currentQQNum) {
      // 没扣号的话就来个弹窗
      setConfirmState({ in: true })
      return
    } else {
      let mounted = true
      // 有的话就用这个扣号获取已投的照片列表
      setConfirmState({ isLoading: true })

      const fetchListResult = fetchListWithQQNum(Number(currentQQNum))

      Promise.allSettled([fetchListResult, timeout(1000)]).finally(() => {
        fetchListResult.then(({ active: new_active, galleries }) => {
          if (mounted === false) { return }
          if (!new_active) {
            setActive(null)
            setList(galleries)
            setEventLoaded(true)
            return
          }

          setActive({
            ...new_active,
            photos: sortByIdList(new_active.photos, suffled_idx_list)
          })

          setSelectedIdList(
            new_active.photos
              .filter(photo => photo.is_voted)
              .map(photo => photo.id)
          )

          setConfirmState({ in: false })
          setEventLoaded(true)
        }).catch(err => {
          AppCriticalError(`获取投票信息失败: ${err.message}`)
        })
      })

      return () => { mounted = false }
    }
  }, [active, currentQQNum, event_loaded, loaded, setActive, setConfirmState, suffled_idx_list])

  useEffect(() => {
    if ((event_loaded === true)) {
      let unmounted = false
      timeout(618).then(() => {
        if (unmounted) { return }
        showSubmitButtonArea(true)
        setShowConfirmVoteLayout(true)
      })
      return () => { unmounted = true }
    }
  }, [event_loaded, showSubmitButtonArea])

  const handleClickAnyWhere = useCallback(() => {
    setShowConfirmVoteLayout(false)
    timeout(1000).then(() => {
      setShowArrow(true)
    })
  }, [])

  const handleClickSubmit = async () => {
    if (!active) return

    try {
      setSubmiting(true)

      if (!currentQQNum) {
        // 未缓存 Q 号
        return setConfirmState({
          in: true,
          isLoading: false,
          isFailure: null
        })
      } else {
        await vote({
          gallery_id: active.id,
          photo_id_list: selected_id_list,
          qq_num: Number(currentQQNum)
        })

        setSubmittedPool({
          ...submitted_pool,
          [active.id]: true
        })
      }
    } catch (err: any) {
      if (err.status === 403 && /已过投票截止时间/.test(err.message)) {
        alert('已经过了投票时间了，朋友，下一年再来支持吧')
        return
      } else {
        console.error(err.message)
        alert(err.message)
      }
    } finally {
      setSubmiting(false)
    }
  }

  useSubmissionEvent({
    created(created_photo) {
      if (active) {
        setActive({
          ...active,
          photos: [
            created_photo,
            ...active.photos,
          ],
        })
      }
    },
    updated(updated_photo) {
      if (active) {
        setActive({
          ...active,
          photos: updateListItemById(active.photos, updated_photo.id, updated_photo)
        })
      }
    },
    canceled(canceled_photo_id) {
      if (active) {
        setActive({
          ...active,
          photos: removeListItemByIdx(
            active.photos,
            findListByProperty(active.photos, 'id', canceled_photo_id)
          )
        })
      }
    },
  })

  const ConfirmVoteLayout = useMemo(() => (
    <ConfirmVote
      in={showConfirmVoteLayout}
      handleClickAnyWhere={handleClickAnyWhere}
    />
  ), [handleClickAnyWhere, showConfirmVoteLayout])

  const HandleClickCover = (gallerycommon: GalleryCommon & {
    photos: Array<{ id: number; src_url: string; width: number; height: number }>
  }) => {
    const handler: WaterfallLayoutClickCoverHandler = ({ from, thumbBlobUrl }, photo_id) => {
      const idx = findListByProperty(gallerycommon.photos, 'id', photo_id)
      if (idx !== -1) {
        const photo = gallerycommon.photos[idx]
        setImageDetail({
          from: from,
          thumb: thumbBlobUrl,
          src: photo.src_url,
          height: photo.height,
          width: photo.width
        })
      }
    }
    return handler
  }

  if (loaded && !active && (list.length === 0)) {
    return <AllEmptyLayout />
  }

  return (
    <>
      <div className={'gallery-home'} style={{ minHeight: '100vh' }}>
        {
          !loaded ? (
            <LoadingLayout />
          ) : (
            <div className="body">
              {active && (
                <ActivityLayout {...{
                  show_submit_button_area,
                  active,
                  show_vote_button: in_vote_period,
                  submiting,
                  showArrow,
                  confirmState,

                  submitted_pool,
                  selected_id_list,
                  setSelectedIdList,

                  onClickSubmit: () => handleClickSubmit(),
                  onClickCover: HandleClickCover(active),
                  onWatterfallRefreshed: watterfall_refreshed.trigger
                }} />
              )}

              {
                list.map(gallery => {
                  return (
                    <div className="gallery-wrapper" key={gallery.id} style={{ display: active ? 'none' : '' }}>
                      <Gallery
                        show_vote_button={false}
                        gallery={gallery}
                        selected_id_list={[]}
                        onClickCover={HandleClickCover(gallery)}
                        onWatterfallRefreshed={watterfall_refreshed.trigger}
                      />
                    </div>
                  )
                })
              }

              <PhotoDetail
                detail={imageDetail}
                onCancel={() => {
                  setImageDetail(null)
                }}
              />
            </div>
          )
        }

        {ConfirmQQLayout}
        {ConfirmVoteLayout}

        <style>{`
          .gallery-home {
            padding-bottom: 64px;
            box-sizing: border-box;
          }
        `}</style>
      </div>
    </>
  )
}
