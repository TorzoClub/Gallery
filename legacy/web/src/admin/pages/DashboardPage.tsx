import React, { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

import { cleanUnusedImages, getAvailablePhotos, refreshThumb, AVATAR_THUMB_SIZE } from '../api/image'
import { listMembers } from '../api/member'
import { getStatistic } from '../api/statistic'
import type { Statistic } from '../api/types'
import { useConfirm } from '../components/ConfirmProvider'
import { PageHeader, Spinner } from '../components/Feedback'
import Icon from '../components/Icon'
import { useToast } from '../components/ToastProvider'
import { getApiErrorMessage, isUnauthorizedResponse } from '../utils/errors'

type ThumbTask = {
  key: string
  name: string
  src: string
  thumb_size?: number
}

type ThumbFailure = {
  task: ThumbTask
  message: string
}

type ThumbProgress = {
  total: number
  done: number
  failures: ThumbFailure[]
  running: boolean
}

const emptyProgress: ThumbProgress = {
  total: 0,
  done: 0,
  failures: [],
  running: false,
}

export default function DashboardPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const mountedRef = useRef(true)

  const [statistic, setStatistic] = useState<Statistic | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')
  const [cleanBusy, setCleanBusy] = useState(false)
  const [preparingThumbs, setPreparingThumbs] = useState(false)
  const [progress, setProgress] = useState<ThumbProgress>(emptyProgress)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadStats = useCallback(async (showErrorToast = false) => {
    setStatsLoading(true)
    setStatsError('')
    try {
      const data = await getStatistic()
      if (mountedRef.current) {
        setStatistic(data)
      }
    } catch (err) {
      if (!mountedRef.current) {
        return
      }
      const message = getApiErrorMessage(err, '获取概览数据失败')
      setStatsError(message)
      if (showErrorToast) {
        toast.error(message)
      }
    } finally {
      if (mountedRef.current) {
        setStatsLoading(false)
      }
    }
  }, [toast])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    if (!progress.running && !preparingThumbs) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [preparingThumbs, progress.running])

  const runThumbTasks = useCallback(async (tasks: ThumbTask[]) => {
    if (tasks.length === 0) {
      toast.info('没有需要处理的图片')
      return
    }

    setProgress({
      total: tasks.length,
      done: 0,
      failures: [],
      running: true,
    })

    let done = 0
    const failures: ThumbFailure[] = []

    for (const task of tasks) {
      if (!mountedRef.current) {
        return
      }

      try {
        await refreshThumb({
          src: task.src,
          thumb_size: task.thumb_size,
        })
      } catch (err) {
        if (!mountedRef.current) {
          return
        }

        if (axios.isAxiosError(err) && isUnauthorizedResponse(err.response?.status, err.response?.data)) {
          setProgress(current => ({ ...current, running: false }))
          return
        }

        failures.push({
          task,
          message: getApiErrorMessage(err, '生成失败'),
        })
      }

      done += 1
      setProgress({
        total: tasks.length,
        done,
        failures: [...failures],
        running: true,
      })
    }

    setProgress({
      total: tasks.length,
      done,
      failures,
      running: false,
    })

    if (failures.length === 0) {
      toast.success('所有缩略图已刷新')
    } else {
      toast.error(`缩略图处理完成，失败 ${failures.length} 张`)
    }

    void loadStats()
  }, [loadStats, toast])

  const collectThumbTasks = useCallback(async () => {
    const [photos, members] = await Promise.all([
      getAvailablePhotos(),
      listMembers(),
    ])

    return [
      ...photos.map<ThumbTask>(photo => ({
        key: `p-${photo.id}`,
        name: `相片(id=${photo.id})`,
        src: photo.src,
      })),
      ...members.map<ThumbTask>(member => ({
        key: `m-${member.id}`,
        name: `成员头像(id=${member.id})`,
        src: member.avatar_src,
        thumb_size: AVATAR_THUMB_SIZE,
      })),
    ]
  }, [])

  const handleRefreshThumbs = async () => {
    if (progress.running || preparingThumbs) {
      return
    }

    const confirmed = await confirm({
      title: '重新生成缩略图',
      message: '这将重新生成所有相片和成员头像的缩略图，可能需要较长时间。处理过程中请不要关闭页面。',
      confirmText: '开始处理',
    })
    if (!confirmed) {
      return
    }

    setPreparingThumbs(true)
    try {
      const tasks = await collectThumbTasks()
      await runThumbTasks(tasks)
    } catch (err) {
      toast.error(getApiErrorMessage(err, '准备缩略图任务失败'))
    } finally {
      if (mountedRef.current) {
        setPreparingThumbs(false)
      }
    }
  }

  const handleRetryFailed = async () => {
    if (progress.running || progress.failures.length === 0) {
      return
    }
    await runThumbTasks(progress.failures.map(item => item.task))
  }

  const handleCleanImages = async () => {
    if (cleanBusy) {
      return
    }

    const confirmed = await confirm({
      title: '清理无引用图片',
      message: '这会删除图片库中没有被相片或成员头像引用的文件。如果还有未保存的上传，请先完成保存。',
      confirmText: '开始清理',
      danger: true,
    })
    if (!confirmed) {
      return
    }

    setCleanBusy(true)
    try {
      const removed = await cleanUnusedImages()
      const count = Array.isArray(removed) ? removed.length : 0
      if (count > 0) {
        toast.success(`已清理 ${count} 个无引用文件`)
      } else {
        toast.info('没有发现无引用图片')
      }
      await loadStats()
    } catch (err) {
      toast.error(getApiErrorMessage(err, '清理图片失败'))
    } finally {
      if (mountedRef.current) {
        setCleanBusy(false)
      }
    }
  }

  const total = progress.total
  const failures = progress.failures.length
  const successCount = Math.max(progress.done - failures, 0)
  const percent = total > 0 ? Math.floor((progress.done / total) * 100) : 0
  const running = progress.running || preparingThumbs

  return (
    <div className="adm-page">
      <PageHeader
        title="概览"
        subtitle="查看相册数据，并维护图片与缩略图资源"
        actions={(
          <button
            type="button"
            className="adm-button"
            disabled={statsLoading}
            onClick={() => void loadStats(true)}
          >
            <Icon name="refresh" size={16} />
            刷新数据
          </button>
        )}
      />

      {statsError && (
        <div className="adm-inline-error" role="alert">
          <span>{statsError}</span>
          <button type="button" className="adm-button adm-button--small" onClick={() => void loadStats(true)}>
            重试
          </button>
        </div>
      )}

      <div className="adm-stat-grid">
        <div className="adm-stat-card">
          <div className="adm-stat-card__icon"><Icon name="gallery" size={22} /></div>
          <div className="adm-stat-card__label">总投稿数</div>
          <div className="adm-stat-card__value">
            {statsLoading && !statistic ? <Spinner size={22} /> : (statistic?.available_photo_count ?? '—')}
          </div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-card__icon"><Icon name="heart" size={22} /></div>
          <div className="adm-stat-card__label">图片占用空间</div>
          <div className="adm-stat-card__value">
            {statsLoading && !statistic ? <Spinner size={22} /> : (statistic?.src_storage ?? '—')}
          </div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-card__icon"><Icon name="dashboard" size={22} /></div>
          <div className="adm-stat-card__label">缩略图占用空间</div>
          <div className="adm-stat-card__value">
            {statsLoading && !statistic ? <Spinner size={22} /> : (statistic?.thumb_storage ?? '—')}
          </div>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card__header">
          <div>
            <h2>缩略图重建</h2>
            <p>重新生成相片缩略图和成员头像缩略图。处理会按顺序逐张进行。</p>
          </div>
          <button
            type="button"
            className="adm-button adm-button--primary"
            disabled={running || cleanBusy}
            onClick={() => void handleRefreshThumbs()}
          >
            {running ? <><Spinner size={16} /> 处理中…</> : <><Icon name="refresh" size={16} /> 重新生成缩略图</>}
          </button>
        </div>

        {(running || progress.total > 0) && (
          <div className="adm-progress-panel">
            <div className="adm-progress-panel__meta">
              <span>
                {preparingThumbs
                  ? '正在准备任务…'
                  : `已处理 ${progress.done} / ${total}`}
              </span>
              <span>
                成功 {successCount}
                {failures > 0 ? ` · 失败 ${failures}` : ''}
              </span>
            </div>
            <div className="adm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <span
                className={failures > 0 ? 'adm-progress__bar adm-progress__bar--warning' : 'adm-progress__bar'}
                style={{ width: `${percent}%` }}
              />
            </div>

            {failures > 0 && (
              <div className="adm-failure-list">
                <div className="adm-failure-list__title">
                  处理失败
                  <button
                    type="button"
                    className="adm-button adm-button--small"
                    disabled={progress.running}
                    onClick={() => void handleRetryFailed()}
                  >
                    重试失败项
                  </button>
                </div>
                <ul>
                  {progress.failures.map(failure => (
                    <li key={failure.task.key}>
                      <strong>{failure.task.name}</strong>
                      <span>{failure.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="adm-card">
        <div className="adm-card__header">
          <div>
            <h2>图片存储清理</h2>
            <p>删除图片库中没有被任何相片或成员头像引用的文件，释放磁盘空间。</p>
          </div>
          <button
            type="button"
            className="adm-button adm-button--danger"
            disabled={cleanBusy || running}
            onClick={() => void handleCleanImages()}
          >
            {cleanBusy ? <><Spinner size={16} /> 清理中…</> : <><Icon name="trash" size={16} /> 清理无引用图片</>}
          </button>
        </div>
      </div>

    </div>
  )
}
