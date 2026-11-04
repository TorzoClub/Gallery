import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Signal, timeout } from 'vait'

import ActivityLayout from '../GalleryHome/components/ActivityLayout'
import AllEmptyLayout from '../GalleryHome/components/AllEmptyLayout'
import LoadingLayout from '../GalleryHome/components/LoadingLayout'
import useConfirmQQ from '../GalleryHome/useConfirmQQ'

import Gallery from 'components/Gallery'
import PhotoDetail, { prepareDetail, type Detail } from 'components/Detail'
import ConfirmVote from 'components/ConfirmVote'
import { TotalAnimationDuration as DIALOG_ANIMATION_MS } from 'components/DialogLayout'
import SkeuomorphismButton from 'components/SkeuomorphismButton'
import type { CoverClickEvent } from 'components/PhotoCard'
import { usePhotoPriority } from './hooks/use-photo-priority'
import { vote } from 'api/client-pool'
import { useClientPool } from 'pool/store'
import { useMemberView } from 'pool/member-view'
import { activeGallery, normalGalleries } from 'pool/selectors'
import { shufflePhotosForEvent, toGalleryViews, type GalleryView } from 'pool/view'
import { canUseCacheWorker, transformCacheWorkerURL } from 'pool/media'
import { PaperShredder } from '@/components/uibrik/paper-shredder/paper-shredder'
import { signal_critical_error } from 'signals'

const watterfall_refreshed = Signal()
/** 提示弹层离场动画播完之后，再过多久才出现磁粒托盘 */
const MAGNET_TRAY_DELAY_MS = 2000

function cachedImageUrl(url: string): string {
  return canUseCacheWorker() ? `${transformCacheWorkerURL(url)}&redirect=1` : url
}

export default function ExplorePage() {
  const pool_state = useClientPool()
  const [qq_num, setQQNum] = useState<number | null>(null)
  const member_view = useMemberView(qq_num)

  const pool = pool_state.status === 'ready' ? pool_state.pool : null
  const active_client = useMemo(() => pool === null ? null : activeGallery(pool), [pool])
  const past_clients = useMemo(() => pool === null ? [] : normalGalleries(pool), [pool])

  const gallery_views = useMemo(() => (
    pool === null
      ? []
      : toGalleryViews(pool, member_view.view)
  ), [member_view.view, pool])

  const active = useMemo<GalleryView | null>(() => {
    if (active_client === null) {
      return null
    }
    const view = gallery_views.find(gallery => gallery.id === active_client.id)
    // 活动期的相册乱序展示，不按 index（后台仍按 index / 所选排序）
    return view === undefined ? null : { ...view, photos: shufflePhotosForEvent(view.photos) }
  }, [active_client, gallery_views])

  const past = useMemo(() => {
    const active_id = active?.id
    return gallery_views.filter(gallery => gallery.id !== active_id)
  }, [active?.id, gallery_views])

  const all_photos = useMemo(() => [
    ...(active?.photos ?? []),
    ...past.flatMap(gallery => gallery.photos),
  ], [active, past])

  usePhotoPriority(all_photos, watterfall_refreshed)

  const [selected_ids, setSelectedIds] = useState<number[]>([])
  const [submiting, setSubmiting] = useState(false)
  const [show_arrow, setShowArrow] = useState(false)
  const [show_submit_button_area, setShowSubmitButtonArea] = useState(false)
  const [show_confirm_vote, setShowConfirmVote] = useState(false)
  // 磁粒托盘（HUD）：“可别忘了点下面的提交”弹层离场动画播完后再等 2 秒才出现
  const [show_magnet_tray, setShowMagnetTray] = useState(false)
  const [show_past, setShowPast] = useState(false)
  const [detail, setDetail] = useState<Detail>(null)

  useEffect(() => {
    if (active === null) {
      setShowPast(true)
    }
  }, [active])

  const [ConfirmQQLayout, confirm_state, setConfirmState] = useConfirmQQ({
    onConfirmSuccess(value) {
      setQQNum(Number(value))
    },
  })

  const in_vote_period = Boolean(active?.can_vote)
  const vote_submitted = Boolean(member_view.view?.vote_submitted)

  useEffect(() => {
    if (member_view.view !== null) {
      setSelectedIds(member_view.view.voted_photo_ids)
    }
  }, [member_view.view])

  useEffect(() => {
    if (qq_num !== null) {
      setConfirmState({ in: false, isLoading: false, isFailure: null })
    }
  }, [qq_num, setConfirmState])

  useEffect(() => {
    if (active === null) {
      return
    }
    if (!in_vote_period) {
      return
    }
    if (qq_num === null && !confirm_state.in) {
      setConfirmState({ in: true })
    }
  }, [active, confirm_state.in, in_vote_period, qq_num, setConfirmState])

  useEffect(() => {
    if (!in_vote_period || member_view.view === null || vote_submitted || active === null) {
      setShowSubmitButtonArea(false)
      return
    }

    let mounted = true
    const timer = timeout(618).then(() => {
      if (!mounted) {
        return
      }
      setShowSubmitButtonArea(true)
      setShowConfirmVote(true)
    })

    return () => {
      mounted = false
    }
  }, [active, in_vote_period, member_view.view, vote_submitted])

  useEffect(() => {
    if (show_confirm_vote || !show_submit_button_area) {
      setShowMagnetTray(false)
      return
    }
    const timer = setTimeout(() => setShowMagnetTray(true), DIALOG_ANIMATION_MS + MAGNET_TRAY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [show_confirm_vote, show_submit_button_area])

  const handleClickAnyWhere = useCallback(() => {
    setShowConfirmVote(false)
    timeout(1000).then(() => setShowArrow(true))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (active === null) {
      return
    }
    if (qq_num === null) {
      setConfirmState({ in: true })
      return
    }

    try {
      setSubmiting(true)
      await vote({
        gallery_id: active.id,
        qq_num,
        photo_ids: selected_ids,
      })
      member_view.applyVote(selected_ids)
      setShowConfirmVote(false)
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message)
      } else {
        alert(String(error))
      }
    } finally {
      setSubmiting(false)
    }
  }, [active, member_view, qq_num, selected_ids, setConfirmState])

  const handleClickCover = useCallback((gallery: GalleryView) => (
    (click_info: CoverClickEvent, photo_id: number) => {
      const photo = gallery.photos.find(item => item.id === photo_id)
      if (photo === undefined) {
        return
      }
      setDetail(prepareDetail({
        from: click_info.from,
        thumb: click_info.thumbBlobUrl,
        src: cachedImageUrl(photo.src_optimized),
        height: photo.height,
        width: photo.width,
      }))
    }
  ), [])

  const normal_list_nodes = useMemo(() => (
    past.map((gallery, idx) => (
      <div className="gallery-wrapper" key={gallery.id}>
        <Gallery
          loose_tape={active === null && idx === 0}
          show_vote_button={false}
          gallery={gallery}
          selected_id_list={[]}
          onClickCover={handleClickCover(gallery)}
          onWatterfallRefreshed={watterfall_refreshed.trigger}
        />
      </div>
    ))
  ), [active, handleClickCover, past])

  const pool_error_message = pool_state.status === 'error' ? pool_state.error.message : null
  useEffect(() => {
    if (pool_error_message !== null) {
      signal_critical_error.trigger(`获取相册数据失败：${pool_error_message}`)
    }
  }, [pool_error_message])

  if (pool_state.status === 'loading') {
    return <LoadingLayout />
  }

  if (pool_state.status === 'error') {
    return null
  }

  if (active === null && past.length === 0) {
    return <AllEmptyLayout />
  }

  return (
    <div className='gallery-home' style={{ minHeight: '100vh' }}>
      <div className='body'>
        {active !== null && (
          <ActivityLayout
            loose_tape
            show_submit_button_area={show_submit_button_area}
            active={active}
            show_vote_button={in_vote_period}
            submiting={submiting}
            showArrow={show_arrow}
            confirmState={confirm_state}
            hide_magnet_tray={!show_magnet_tray}
            submitted_pool={{ [active.id]: vote_submitted ? 1 : undefined }}
            selected_id_list={selected_ids}
            setSelectedIdList={setSelectedIds}
            onClickSubmit={handleSubmit}
            onClickCover={handleClickCover(active)}
            onWatterfallRefreshed={watterfall_refreshed.trigger}
          />
        )}

        {active !== null && past.length > 0 && !show_past && (
          <SkeuomorphismButton onClick={() => setShowPast(true)}>
            查看过往相册
          </SkeuomorphismButton>
        )}

        {show_past && normal_list_nodes}

        <PhotoDetail
          detail={detail}
          onCancel={() => setDetail(null)}
        />
      </div>

      {ConfirmQQLayout}
      <ConfirmVote
        in={show_confirm_vote}
        handleClickAnyWhere={handleClickAnyWhere}
      />
    </div>
  )
}
