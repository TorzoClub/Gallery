import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Signal } from 'vait'
import type { AdminPoolDTO } from '@shared/dto'
import { ApiError } from '../../api/dispatch'
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
    await load(true)
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

  const sorted_galleries = useMemo(() => {
    if (state.status !== 'ready') {
      return []
    }
    return [...state.pool.galleries].sort((left, right) => (
      right.index - left.index || Number(right.id) - Number(left.id)
    ))
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
        showTitle
        isAdminTitle={true}
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
        <SkeuomorphismButton onClick={() => void handleCreateGallery()}>
          {creatingGallery ? '创建中…' : '+ 创建相册'}
        </SkeuomorphismButton>
        {createGalleryError !== '' && (
          <div className={styles.createGalleryError} role='alert'>{createGalleryError}</div>
        )}
      </div>
      <div className='gallery-home'>
        <div className='body'>
          <div style={{ height: '8px' }}></div>
          {sorted_galleries.length === 0
            ? <div className={styles.empty}>还没有相册</div>
            : sorted_galleries.map(gallery => (
              <AdminGallery
                key={gallery.id}
                gallery={gallery}
                memberCanDelete={memberCanDelete}
                onGalleryChanged={handleGalleryChanged}
                onChanged={refresh}
                onWatterfallRefreshed={watterfall_refreshed.trigger}
              />
            ))}
        </div>
      </div>
    </main>
  )
}
