import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { nextTick, timeout } from 'new-vait'

import { getGlobalQueue, globalQueueLoad, setGlobalQueue } from 'utils/queue-load'
import { sortByIdList } from 'utils/common'
import { AppCriticalError } from 'App'

import { Photo, fetchList, fetchListResult, fetchListWithQQNum, vote } from 'api/photo'

import LoadingLayout from './components/LoadingLayout'
import ActivityLayout from './components/ActivityLayout'
import EmptyGalleryLayout from './components/EmptyGalleryLayout'
import useConfirmQQ from './useConfirmQQ'
import { useSubmissionEvent } from 'components/Submission'

import Gallery from 'components/Gallery'
import PhotoDetail, { Detail } from 'components/Detail'
import ConfirmVote from 'components/ConfirmVote'
import shuffleArray from 'utils/shuffle-array'

type MediaID = string | number
type MediaType = 'AVATAR' | 'PHOTO'
type Media = { id: MediaID; type: MediaType }
function usePhotoLoadingPriority(photo_list: Photo[]) {
  const id_src_map = useMemo(() => {
    const m = new Map<number, string>()
    photo_list.forEach(p => m.set(p.id, p.thumb_url))
    return m
  }, [photo_list])

  function id(type: MediaType, mid: MediaID) {
    if (type === 'PHOTO') return `photo-${mid}`
    else return `avatar-${mid}`
  }

  useEffect(() => {
    function _resortHandler() {
      const in_screen_photos = photo_list.map(photo => {
        const photo_el = document.getElementById(id('PHOTO', photo.id))
        if (!photo_el) { return }
        const bounding = photo_el.getBoundingClientRect()
        if (
          (bounding.y > (0 - bounding.height)) &&
          (bounding.y < window.innerHeight)
        ) {
          return { photo, bounding }
        } else {
          return
        }
      }).filter(p => p) as { photo: Photo, bounding: DOMRect }[]

      const sorted = in_screen_photos.sort((a, b) => {
        return a.bounding.y > b.bounding.y ? 1 : -1
      })

      const all_tasks = getGlobalQueue()
      setGlobalQueue(
        all_tasks.map((t, idx) => {
          return { ...t, priority: all_tasks.length - idx }
        })
      )

      sorted.forEach(({ photo }, idx) => {
        const src = id_src_map.get(photo.id)
        if (!src) return
        globalQueueLoad(src, 10000 - idx)
        if (photo.member) {
          globalQueueLoad(photo.member.avatar_thumb_url, 5000 - idx)
        }
      })
    }
    const resortHandler = () => {
      nextTick().then(_resortHandler)
    }
    window.addEventListener('resize', resortHandler)
    window.addEventListener('scroll', resortHandler)
    _resortHandler()

    return () => {
      window.removeEventListener('resize', resortHandler)
      window.removeEventListener('scroll', resortHandler)
    }
  }, [id_src_map, photo_list])
}

export default () => {
  const [loaded, setLoaded] = useState(false)

  const [showArrow, setShowArrow] = useState(false)

  const [hideVoteButton, setHideVoteButton] = useState(true)

  const [selectedIdList, setSelectedIdList] = useState<number[]>([])

  const [submiting, setSubmiting] = useState(false)

  const [active, setActive] = useState<null | fetchListResult['active']>(null)
  const [list, setList] = useState<fetchListResult['galleries']>([])

  const [submittedPool, setSubmittedPool] = useState({})

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
        setActive({
          ...active,
          photos: shuffleArray(active.photos)
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
      setHideVoteButton(true)
      return
    }

    if (active.can_submission) {
      // 征集投稿期间要隐藏投票按钮
      setHideVoteButton(true)
    } else {
      setHideVoteButton(false)
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
      setConfirmState({
        isLoading: false,
        isDone: true
      })

      const fetchListResult = fetchListWithQQNum(Number(currentQQNum))

      timeout(1500).then(() => {
        fetchListResult.then(({ active: new_active, galleries }) => {
          if (mounted === false) { return }
          setEventLoaded(true)
          if (!new_active) {
            setActive(null)
            setList(galleries)
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
          timeout(618).then(() => {
            if (mounted === false) { return }
            setShowConfirmVoteLayout(true)
          })
        }).catch(err => {
          AppCriticalError(`获取投票信息失败: ${err.message}`)
        })
      })

      return () => { mounted = false }
    }
  }, [active, currentQQNum, event_loaded, loaded, setActive, setConfirmState, suffled_idx_list])

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
          photo_id_list: selectedIdList,
          qq_num: Number(currentQQNum)
        })

        setSubmittedPool({
          submittedPool,
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

  const handleClickAnyWhere = useCallback(() => {
    setShowConfirmVoteLayout(false)
    timeout(618).then(() => {
      setHideVoteButton(false)
      setShowArrow(true)
    })
  }, [])

  useSubmissionEvent({
    created: useCallback((created_photo) => {
      if (active) {
        setActive({
          ...active,
          photos: [
            created_photo,
            ...active.photos,
          ],
        })
      }
    }, [active, setActive]),
    updated: useCallback((updated_photo) => {
      if (active) {
        setActive({
          ...active,
          photos: active.photos.map(p => {
            if (p.id === updated_photo.id) {
              return updated_photo
            } else {
              return p
            }
          })
        })
      }
    }, [active, setActive]),
    canceled: useCallback((canceled_photo_id) => {
      if (active) {
        setActive({
          ...active,
          photos: active.photos.filter(p => {
            return p.id !== canceled_photo_id
          })
        })
      }
    }, [active, setActive]),
  })

  const ConfirmVoteLayout = useMemo(() => (
    <ConfirmVote
      in={showConfirmVoteLayout}
      handleClickAnyWhere={handleClickAnyWhere}
    />
  ), [handleClickAnyWhere, showConfirmVoteLayout])

  if (loaded && !active && (list.length === 0)) {
    return <EmptyGalleryLayout />
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
                  active,
                  hideVoteButton,
                  submiting,
                  showArrow,
                  confirmState,

                  submittedPool,
                  selectedIdList,
                  setSelectedIdList,

                  toDetail: (detail: Detail) => setImageDetail(detail),
                  onClickSubmit: () => handleClickSubmit(),
                }} />
              )}

              {
                list.map(gallery => {
                  return (
                    <div className="gallery-wrapper" key={gallery.id} style={{ display: active ? 'none' : '' }}>
                      <Gallery
                        hideVoteButton={hideVoteButton}
                        gallery={gallery}
                        selectedIdList={[]}
                        onClickCover={({ from, thumbBlobUrl }, photoId) => {
                          const idx = gallery.photos.map(p => p.id).indexOf(photoId)
                          if (idx === -1) return
                          const photo = gallery.photos[idx]

                          setImageDetail({
                            from: from,
                            thumb: thumbBlobUrl,
                            src: photo.src_url,
                            height: photo.height,
                            width: photo.width
                          })
                        }}
                      />
                    </div>
                  )
                })
              }

              <PhotoDetail
                detail={imageDetail}
                // imageUrl={detailImageUrl}
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
