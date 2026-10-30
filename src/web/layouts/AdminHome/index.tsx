import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Signal } from 'vait'
import type { AdminPoolDTO } from '@shared/dto'
import { ApiError } from '../../api/dispatch'
import { fetchAdminPool } from '../../admin/api/pool'
import { getToken, removeToken } from '../../admin/auth/token'
import { getApiErrorMessage } from '../../admin/utils/errors'
import { global_queue } from '../../utils/queue-load'
import AdminGallery from './components/AdminGallery'
import styles from './index.module.scss'
import './admin.css'
import Navigator from '@/components/Navigator'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; pool: AdminPoolDTO }
  | { status: 'error'; message: string }

export default function AdminHome({ thisIsDisplay }: { thisIsDisplay: boolean }) {
  const navigate = useNavigate()
  const token = getToken()
  const watterfall_refreshed = useMemo(() => Signal(), [])
  const [state, setState] = useState<LoadState>({ status: 'loading' })

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

  const load = useCallback(async () => {
    if (token === '') {
      return
    }
    setState({ status: 'loading' })
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
      void load()
    }
  }, [load, thisIsDisplay])

  useEffect(() => {
    if (state.status !== 'ready') {
      return
    }
    global_queue.startWorking()
    const timer = window.setTimeout(() => global_queue.startWorking(), 0)
    return () => window.clearTimeout(timer)
  }, [state])

  const refresh = useCallback(async () => {
    await load()
    watterfall_refreshed.trigger()
  }, [load, watterfall_refreshed])

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

  return (
    <main className={styles.page}>
      <Navigator
        showTitle
        isAdminTitle={true}
        onClickPushButton={() => navigate('/explore', { replace: true })}
      />
      <div className='gallery-home'>
        <div className='body'>
          {state.pool.galleries.length === 0
            ? <div className={styles.empty}>还没有相册</div>
            : state.pool.galleries.map(gallery => (
              <AdminGallery
                key={gallery.id}
                gallery={gallery}
                onChanged={refresh}
                onWatterfallRefreshed={watterfall_refreshed.trigger}
              />
            ))}
        </div>
      </div>
    </main>
  )
}
