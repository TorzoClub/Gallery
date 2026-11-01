import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Signal } from 'vait'
import type { AdminGalleryDTO, AdminPoolDTO } from '@shared/dto'
import { ApiError } from '../../api/dispatch'
import { adminMutate } from '../../admin/api/client'
import { updateInstanceConfig } from '../../admin/api/config'
import { createGallery } from '../../admin/api/gallery'
import { refreshAvatar, refreshThumb } from '../../admin/api/image'
import { fetchAdminPool } from '../../admin/api/pool'
import { getToken, removeToken } from '../../admin/auth/token'
import { getApiErrorMessage } from '../../admin/utils/errors'
import { global_queue } from '../../utils/queue-load'
import Navigator from '@/components/Navigator'
import { signal_critical_error } from '../../signals'
import AdminGallery from './components/AdminGallery'
import type { MemberHistory } from './components/GalleryManagePanel'
import {
  AdminConsole,
  type AdminSettings,
  type AdminStats,
  type Member as ConsoleMember,
  type MemberCanDelete,
  type RebuildReporter,
} from './components/AdminConsole'
import { instanceConfigFromSettings, settingsFromInstanceConfig } from './admin-settings'
import styles from './index.module.scss'
import './admin.css'
import SkeuomorphismButton from '@/components/SkeuomorphismButton'
import SkeuomorphismButtonHighlight from '@/components/SkeuomorphismButtonHighlight'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; pool: AdminPoolDTO }
  | { status: 'error'; message: string }

const SETTINGS_SAVE_DELAY = 350

function statsFromPool(pool: AdminPoolDTO): AdminStats {
  let photos = 0
  let votes = 0

  for (const gallery of pool.galleries) {
    photos += gallery.photos.length
    votes += gallery.vote_records.length
  }

  return {
    photos,
    albums: pool.galleries.length,
    votes,
    members: pool.members.length,
  }
}

function consoleMembersFromPool(pool: AdminPoolDTO): ConsoleMember[] {
  return pool.members.map(member => ({
    id: member.id,
    nickname: member.name,
    qq: String(member.qq_num),
    avatarUrl: member.avatar_thumb_url,
  }))
}

export default function AdminHome({ thisIsDisplay }: { thisIsDisplay: boolean }) {
  const navigate = useNavigate()
  const token = getToken()
  const watterfall_refreshed = useMemo(() => Signal(), [])
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [creatingGallery, setCreatingGallery] = useState(false)
  const [createGalleryError, setCreateGalleryError] = useState('')
  const [sort_mode, setSortMode] = useState(false)
  const [draft_galleries, setDraftGalleries] = useState<AdminGalleryDTO[]>([])
  const [dragging_id, setDraggingId] = useState<number | null>(null)
  const [drag_offset_y, setDragOffsetY] = useState(0)
  const drag_grab_offset = useRef(0)
  const drag_pointer_y = useRef(0)
  const [sort_busy, setSortBusy] = useState(false)
  const [sort_error, setSortError] = useState('')
  const settingsSaveTimer = useRef<number | null>(null)
  const settingsSaveSequence = useRef(0)

  useEffect(() => {
    if (!thisIsDisplay) {
      return
    }
    document.title = '管理后台 · 同装摄影集'
    global_queue.startWorking()
    return () => {
      document.title = '同装摄影集'
    }
  }, [thisIsDisplay])

  const load = useCallback(async (show_loading = true) => {
    if (token === '') {
      return
    }
    if (show_loading) {
      setState({ status: 'loading' })
    }
    try {
      const pool = await fetchAdminPool()
      setState({ status: 'ready', pool })
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        removeToken()
        navigate('/behind', { replace: true })
        return
      }
      setState({ status: 'error', message: getApiErrorMessage(error, '读取后台数据失败') })
    }
  }, [navigate, token])

  useEffect(() => {
    if (thisIsDisplay) {
      void load(true)
    }
  }, [load, thisIsDisplay])

  useEffect(() => {
    if (state.status !== 'ready') {
      return
    }
    setSettings(current => current ?? settingsFromInstanceConfig(state.pool.instance_config))
    global_queue.startWorking()
    const timer = window.setTimeout(() => global_queue.startWorking(), 0)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => () => {
    if (settingsSaveTimer.current !== null) {
      window.clearTimeout(settingsSaveTimer.current)
    }
  }, [])

  const saveSettings = useCallback((next: AdminSettings) => {
    if (settingsSaveTimer.current !== null) {
      window.clearTimeout(settingsSaveTimer.current)
    }

    setSettingsSaving(true)
    const sequence = ++settingsSaveSequence.current

    settingsSaveTimer.current = window.setTimeout(() => {
      settingsSaveTimer.current = null

      updateInstanceConfig(instanceConfigFromSettings(next))
        .then(config => {
          if (sequence !== settingsSaveSequence.current) {
            return
          }
          setState(current => current.status === 'ready'
            ? { status: 'ready', pool: { ...current.pool, instance_config: config } }
            : current)
        })
        .catch(error => {
          if (sequence !== settingsSaveSequence.current) {
            return
          }
          signal_critical_error.trigger(
            `保存 instance_config 失败：${getApiErrorMessage(error, '未知错误')}`,
          )
        })
        .finally(() => {
          if (sequence === settingsSaveSequence.current) {
            setSettingsSaving(false)
          }
        })
    }, SETTINGS_SAVE_DELAY)
  }, [])

  const handleSettingsChange = useCallback((next: AdminSettings) => {
    setSettings(next)
    saveSettings(next)
  }, [saveSettings])

  const refresh = useCallback(async () => {
    await load(false)
    watterfall_refreshed.trigger()
  }, [load, watterfall_refreshed])

  const handleMembersChanged = useCallback(async () => {
    await load(false)
    watterfall_refreshed.trigger()
  }, [load, watterfall_refreshed])

  const handleGalleryChanged = useCallback(async () => {
    await load(false)
    watterfall_refreshed.trigger()
  }, [load, watterfall_refreshed])

  const handleCreateGallery = useCallback(async () => {
    if (state.status !== 'ready' || creatingGallery) {
      return
    }

    setCreatingGallery(true)
    setCreateGalleryError('')
    try {
      const galleries = state.pool.galleries
      const max_index = galleries.reduce((max, gallery) => Math.max(max, gallery.index), -1)
      const now = Date.now()
      const latest_end = galleries.reduce(
        (max, gallery) => Math.max(max, new Date(gallery.event_end).getTime()),
        now,
      )
      const day = 24 * 60 * 60 * 1000
      const event_start = new Date(latest_end + day)
      const submission_expire = new Date(event_start.getTime() + 7 * day)
      const event_end = new Date(event_start.getTime() + 14 * day)

      await createGallery({
        name: 'new Gallery',
        index: max_index + 1,
        vote_limit: 0,
        event_start: event_start.toISOString(),
        submission_expire: submission_expire.toISOString(),
        event_end: event_end.toISOString(),
      })
      await load(false)
      watterfall_refreshed.trigger()
    } catch (error) {
      setCreateGalleryError(getApiErrorMessage(error, '创建相册失败'))
    } finally {
      setCreatingGallery(false)
    }
  }, [creatingGallery, load, state, watterfall_refreshed])

  const sorted_galleries = useMemo(() => {
    if (state.status !== 'ready') {
      return []
    }
    return [...state.pool.galleries].sort((left, right) => (
      right.index - left.index || Number(right.id) - Number(left.id)
    ))
  }, [state])

  const display_galleries = sort_mode ? draft_galleries : sorted_galleries
  const sort_disabled = sort_mode ? sort_busy : sorted_galleries.length === 0

  const moveDraftGalleryToIndex = useCallback((source_id: number, target_index: number) => {
    setDraftGalleries(current => {
      const source_index = current.findIndex(gallery => gallery.id === source_id)
      if (source_index < 0) {
        return current
      }
      const next = current.filter(gallery => gallery.id !== source_id)
      const bounded_index = Math.max(0, Math.min(target_index, next.length))
      if (bounded_index === source_index) {
        return current
      }
      next.splice(bounded_index, 0, current[source_index])
      return next
    })
  }, [])

  const startSortMode = useCallback(() => {
    if (state.status !== 'ready') {
      return
    }
    setDraftGalleries([...sorted_galleries])
    setSortMode(true)
    setSortError('')
    setDraggingId(null)
    setDragOffsetY(0)
  }, [sorted_galleries, state.status])

  const finishSort = useCallback(async () => {
    if (sort_busy) {
      return
    }
    setSortBusy(true)
    setSortError('')
    const total = draft_galleries.length
    try {
      const updates = draft_galleries
        .map((gallery, position) => ({
          gallery_id: gallery.id,
          index: total - 1 - position,
          current_index: gallery.index,
        }))
        .filter(item => item.index !== item.current_index)

      for (const update of updates) {
        await adminMutate('adminUpdateGallery', {
          gallery_id: update.gallery_id,
          index: update.index,
        })
      }

      if (updates.length > 0) {
        await load(false)
        watterfall_refreshed.trigger()
      }
      setSortMode(false)
      setDraftGalleries([])
    } catch (error) {
      setSortError(getApiErrorMessage(error, '保存相册顺序失败'))
    } finally {
      setSortBusy(false)
    }
  }, [draft_galleries, load, sort_busy, watterfall_refreshed])

  const handleSortButton = useCallback(() => {
    if (sort_mode) {
      void finishSort()
    } else {
      startSortMode()
    }
  }, [finishSort, sort_mode, startSortMode])

  const startGalleryDrag = useCallback((
    event: React.PointerEvent<HTMLElement>,
    gallery_id: number,
  ) => {
    if (!sort_mode) {
      return
    }
    event.preventDefault()
    const source_row = document.querySelector<HTMLElement>(
      `[data-gallery-sort-id="${gallery_id}"]`,
    )
    drag_grab_offset.current = source_row === null
      ? 0
      : event.clientY - source_row.getBoundingClientRect().top
    drag_pointer_y.current = event.clientY
    setDragOffsetY(0)
    setDraggingId(gallery_id)
  }, [sort_mode])

  useLayoutEffect(() => {
    if (!sort_mode || dragging_id === null || drag_pointer_y.current === 0) {
      return
    }
    const source_row = document.querySelector<HTMLElement>(
      `[data-gallery-sort-id="${dragging_id}"]`,
    )
    if (source_row === null) {
      return
    }
    const base_top = source_row.getBoundingClientRect().top
    const next_offset = drag_pointer_y.current - drag_grab_offset.current - base_top
    setDragOffsetY(next_offset)
  }, [draft_galleries, dragging_id, sort_mode])

  useEffect(() => {
    if (!sort_mode || dragging_id === null) {
      return
    }

    const handleMove = (event: PointerEvent) => {
      const source_row = document.querySelector<HTMLElement>(
        `[data-gallery-sort-id="${dragging_id}"]`,
      )
      drag_pointer_y.current = event.clientY
      if (source_row !== null) {
        const base_top = source_row.getBoundingClientRect().top
        setDragOffsetY(event.clientY - drag_grab_offset.current - base_top)
      }

      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-gallery-sort-id]'))
        .filter(row => Number(row.dataset.gallerySortId) !== dragging_id)
      const target_index = rows.findIndex(row => {
        const rect = row.getBoundingClientRect()
        return event.clientY < rect.top + rect.height / 2
      })
      moveDraftGalleryToIndex(
        dragging_id,
        target_index === -1 ? rows.length : target_index,
      )
    }

    const stopDrag = () => {
      setDraggingId(null)
      setDragOffsetY(0)
      drag_pointer_y.current = 0
    }

    const handleUp = stopDrag
    const handleCancel = stopDrag

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
    }
  }, [dragging_id, moveDraftGalleryToIndex, sort_mode])

  const handleRebuild = useCallback(async (reporter: RebuildReporter) => {
    if (state.status !== 'ready') {
      throw new Error('后台数据尚未读取完成')
    }

    const photos = state.pool.galleries.flatMap(gallery => gallery.photos)
    const members = state.pool.members
    const total = photos.length + members.length
    let done = 0

    for (const photo of photos) {
      try {
        await refreshThumb({ photo_id: photo.id })
      } catch (error) {
        reporter.error(`相片 #${photo.id}：${getApiErrorMessage(error, '重建失败')}`)
      }
      done += 1
      reporter.progress(done, total)
    }

    for (const member of members) {
      try {
        await refreshAvatar({ member_id: member.id })
      } catch (error) {
        reporter.error(`成员 #${member.id}：${getApiErrorMessage(error, '重建失败')}`)
      }
      done += 1
      reporter.progress(done, total)
    }

    const pool = await fetchAdminPool()
    setState({ status: 'ready', pool })
    watterfall_refreshed.trigger()
  }, [state, watterfall_refreshed])

  const memberCanDelete = useMemo<MemberCanDelete>(() => {
    const referenced = new Set<number>()
    if (state.status === 'ready') {
      for (const gallery of state.pool.galleries) {
        for (const photo of gallery.photos) {
          referenced.add(Number(photo.member_id))
        }
        for (const vote of gallery.vote_records) {
          referenced.add(Number(vote.member_id))
        }
      }
    }
    return member => !referenced.has(Number(member.id))
  }, [state])

  const member_history = useMemo<MemberHistory>(() => {
    const ever_voted = new Set<number>()
    const ever_submitted = new Set<number>()
    if (state.status === 'ready') {
      for (const gallery of state.pool.galleries) {
        for (const photo of gallery.photos) {
          ever_submitted.add(Number(photo.member_id))
        }
        for (const vote of gallery.vote_records) {
          ever_voted.add(Number(vote.member_id))
        }
      }
    }
    return { ever_voted, ever_submitted }
  }, [state])

  if (!thisIsDisplay) {
    return null
  }

  if (token === '') {
    return <Navigate to="/behind" replace />
  }

  if (state.status === 'loading') {
    return <main className={styles.page}><div className={styles.loading}>正在读取完整 Pool…</div></main>
  }

  if (state.status === 'error') {
    return (
      <main className={styles.page}>
        <div className={styles.error} role="alert">{state.message}</div>
        <button type="button" onClick={() => void load()}>重试</button>
        <Link to="/explore">返回前台</Link>
      </main>
    )
  }

  const console_settings = settings ?? settingsFromInstanceConfig(state.pool.instance_config)

  return (
    <main className={styles.page}>
      <Navigator
        scene='admin'
        onClickPushButton={() => navigate('/explore', { replace: true })}
      />
      <AdminConsole
        stats={statsFromPool(state.pool)}
        settings={console_settings}
        onSettingsChange={handleSettingsChange}
        members={consoleMembersFromPool(state.pool)}
        memberCanDelete={memberCanDelete}
        onMembersChanged={handleMembersChanged}
        onRebuild={handleRebuild}
      />
      {settingsSaving && <div className={styles.consoleStatus}>正在保存设置…</div>}
      <div className={styles.createGallery}>
        <div className={styles.createGalleryActions}>
          <SkeuomorphismButton
            disabled={sort_mode || creatingGallery}
            onClick={() => void handleCreateGallery()}
            inputProps={{
              className: sort_mode ? styles.createGalleryDisabled : undefined,
            }}
          >
            {creatingGallery ? '创建中…' : '+ 创建相册'}
          </SkeuomorphismButton>
          {sort_mode ? (
            <SkeuomorphismButtonHighlight active={!sort_busy}>
              <SkeuomorphismButton
                disabled={sort_disabled}
                onClick={handleSortButton}
                inputProps={{
                  className: sort_disabled ? styles.sortButtonDisabled : undefined,
                }}
              >
                {sort_busy ? '保存中…' : '完成排序'}
              </SkeuomorphismButton>
            </SkeuomorphismButtonHighlight>
          ) : (
            <SkeuomorphismButton
              disabled={sort_disabled}
              onClick={handleSortButton}
            >
              调整相册顺序
            </SkeuomorphismButton>
          )}
        </div>
        {createGalleryError !== '' && (
          <div className={styles.createGalleryError} role='alert'>{createGalleryError}</div>
        )}
        {sort_error !== '' && (
          <div className={styles.sortError} role='alert'>{sort_error}</div>
        )}
      </div>
      <div className='gallery-home'>
        <div className='body'>
          <div style={{ height: '8px' }}></div>
          {display_galleries.length === 0
            ? <div className={styles.empty}>还没有相册</div>
            : display_galleries.map(gallery => (
              <AdminGallery
                key={gallery.id}
                gallery={gallery}
                members={state.pool.members}
                memberHistory={member_history}
                memberCanDelete={memberCanDelete}
                onGalleryChanged={handleGalleryChanged}
                onChanged={refresh}
                onWatterfallRefreshed={watterfall_refreshed.trigger}
                sorting={sort_mode}
                dragging={dragging_id === gallery.id}
                dragOffsetY={dragging_id === gallery.id ? drag_offset_y : 0}
                onDragPointerDown={event => startGalleryDrag(event, gallery.id)}
              />
            ))}
        </div>
      </div>
    </main>
  )
}
