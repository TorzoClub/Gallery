import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getInstanceConfig, updateInstanceConfig } from '../api/config'
import { cleanUnusedImages, getAvailablePhotos, refreshAvatar, refreshThumb } from '../api/image'
import { listMembers } from '../api/member'
import { getStatistic } from '../api/statistic'
import type { InstanceConfig, Statistic } from '../api/types'
import { useConfirm } from '../components/ConfirmProvider'
import Field from '../components/Field'
import { PageHeader, Spinner } from '../components/Feedback'
import Icon from '../components/Icon'
import { useToast } from '../components/ToastProvider'
import { ApiError } from '../../api/dispatch'
import { getApiErrorMessage } from '../utils/errors'

type ThumbTask = {
  key: string
  name: string
  kind: 'photo' | 'avatar'
  id: number
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

type ConfigForm = {
  avatar_thumb_size: string
  image_thumb_size: string
  image_thumb_quality: string
  image_thumb_effort: string
  max_image_dimension: string
  max_upload_mb: string
}

type ConfigErrors = Partial<Record<keyof ConfigForm, string>>

const EMPTY_CONFIG_FORM: ConfigForm = {
  avatar_thumb_size: '',
  image_thumb_size: '',
  image_thumb_quality: '',
  image_thumb_effort: '',
  max_image_dimension: '',
  max_upload_mb: '',
}

function configFormFrom(config: InstanceConfig): ConfigForm {
  return {
    avatar_thumb_size: String(config.avatar_thumb_size),
    image_thumb_size: String(config.image_thumb_size),
    image_thumb_quality: String(config.image_thumb_quality),
    image_thumb_effort: String(config.image_thumb_effort),
    max_image_dimension: String(config.max_image_dimension),
    max_upload_mb: String(Math.round(config.max_upload_bytes / (1024 * 1024))),
  }
}

function parseIntegerField(
  value: string,
  min: number,
  max: number,
  label: string,
): { value: number | null; error?: string } {
  if (!/^\d+$/.test(value.trim())) {
    return { value: null, error: `${label}需要是整数` }
  }
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    return { value: null, error: `${label}需要在 ${min}–${max} 之间` }
  }
  return { value: number }
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
  const [config, setConfig] = useState<InstanceConfig | null>(null)
  const [configForm, setConfigForm] = useState<ConfigForm>(EMPTY_CONFIG_FORM)
  const [configErrors, setConfigErrors] = useState<ConfigErrors>({})
  const [configLoading, setConfigLoading] = useState(true)
  const [configSaving, setConfigSaving] = useState(false)
  const [configLoadError, setConfigLoadError] = useState('')

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

  const loadConfig = useCallback(async (showErrorToast = false) => {
    setConfigLoading(true)
    setConfigLoadError('')
    try {
      const data = await getInstanceConfig()
      if (mountedRef.current) {
        setConfig(data)
        setConfigForm(configFormFrom(data))
        setConfigErrors({})
      }
    } catch (err) {
      if (!mountedRef.current) {
        return
      }
      const message = getApiErrorMessage(err, '获取运行期配置失败')
      setConfigLoadError(message)
      if (showErrorToast) {
        toast.error(message)
      }
    } finally {
      if (mountedRef.current) {
        setConfigLoading(false)
      }
    }
  }, [toast])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const setConfigField = (key: keyof ConfigForm, value: string) => {
    setConfigForm(current => ({ ...current, [key]: value }))
    setConfigErrors(current => ({ ...current, [key]: undefined }))
  }

  const validateConfig = (): { payload: Parameters<typeof updateInstanceConfig>[0] | null } => {
    const errors: ConfigErrors = {}
    const avatar = parseIntegerField(configForm.avatar_thumb_size, 16, 2048, '头像缩略图尺寸')
    const image = parseIntegerField(configForm.image_thumb_size, 32, 4096, '相片缩略图尺寸')
    const quality = parseIntegerField(configForm.image_thumb_quality, 1, 100, '缩略图质量')
    const effort = parseIntegerField(configForm.image_thumb_effort, 0, 9, '缩略图 effort')
    const dimension = parseIntegerField(configForm.max_image_dimension, 256, 16384, '最大图片尺寸')
    const upload_mb = parseIntegerField(configForm.max_upload_mb, 1, 1024, '最大上传大小')

    if (avatar.error) errors.avatar_thumb_size = avatar.error
    if (image.error) errors.image_thumb_size = image.error
    if (quality.error) errors.image_thumb_quality = quality.error
    if (effort.error) errors.image_thumb_effort = effort.error
    if (dimension.error) errors.max_image_dimension = dimension.error
    if (upload_mb.error) errors.max_upload_mb = upload_mb.error

    if (Object.keys(errors).length > 0) {
      setConfigErrors(errors)
      return { payload: null }
    }

    return {
      payload: {
        avatar_thumb_size: avatar.value as number,
        image_thumb_size: image.value as number,
        image_thumb_quality: quality.value as number,
        image_thumb_effort: effort.value as number,
        max_image_dimension: dimension.value as number,
        max_upload_bytes: (upload_mb.value as number) * 1024 * 1024,
      },
    }
  }

  const handleSaveConfig = async () => {
    if (configSaving) {
      return
    }
    const { payload } = validateConfig()
    if (payload === null) {
      return
    }

    setConfigSaving(true)
    try {
      const next = await updateInstanceConfig(payload)
      setConfig(next)
      setConfigForm(configFormFrom(next))
      setConfigErrors({})
      toast.success('运行期配置已保存')
    } catch (err) {
      toast.error(getApiErrorMessage(err, '保存运行期配置失败'))
    } finally {
      if (mountedRef.current) {
        setConfigSaving(false)
      }
    }
  }

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
        if (task.kind === 'photo') {
          await refreshThumb({ photo_id: task.id })
        } else {
          await refreshAvatar({ member_id: task.id })
        }
      } catch (err) {
        if (!mountedRef.current) {
          return
        }

        if (err instanceof ApiError && err.status === 401) {
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
        kind: 'photo',
        id: photo.id,
      })),
      ...members.map<ThumbTask>(member => ({
        key: `m-${member.id}`,
        name: `成员头像(id=${member.id})`,
        kind: 'avatar',
        id: member.id,
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
          <div className="adm-stat-card__label">相片总数</div>
          <div className="adm-stat-card__value">
            {statsLoading && !statistic ? <Spinner size={22} /> : (statistic?.photo_count ?? '—')}
          </div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-card__icon"><Icon name="heart" size={22} /></div>
          <div className="adm-stat-card__label">相册总数</div>
          <div className="adm-stat-card__value">
            {statsLoading && !statistic ? <Spinner size={22} /> : (statistic?.gallery_count ?? '—')}
          </div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-card__icon"><Icon name="dashboard" size={22} /></div>
          <div className="adm-stat-card__label">投票总数</div>
          <div className="adm-stat-card__value">
            {statsLoading && !statistic ? <Spinner size={22} /> : (statistic?.vote_count ?? '—')}
          </div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-card__icon"><Icon name="users" size={22} /></div>
          <div className="adm-stat-card__label">成员总数</div>
          <div className="adm-stat-card__value">
            {statsLoading && !statistic ? <Spinner size={22} /> : (statistic?.member_count ?? '—')}
          </div>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card__header">
          <div>
            <h2>运行期配置</h2>
            <p>这些配置保存在 storage 中，修改后对之后的上传和缩略图生成生效，不会自动重做已有图片。</p>
          </div>
          <button
            type="button"
            className="adm-button"
            disabled={configLoading || configSaving}
            onClick={() => void loadConfig(true)}
          >
            <Icon name="refresh" size={16} />
            重新读取
          </button>
        </div>

        {configLoadError && (
          <div className="adm-inline-error" role="alert">
            <span>{configLoadError}</span>
            <button type="button" className="adm-button adm-button--small" onClick={() => void loadConfig(true)}>
              重试
            </button>
          </div>
        )}

        {configLoading && config === null ? (
          <div className="adm-inline-loading"><Spinner size={18} /> 正在读取配置…</div>
        ) : (
          <form onSubmit={event => { event.preventDefault(); void handleSaveConfig() }}>
            <div className="adm-form-grid">
              <Field label="头像缩略图尺寸" htmlFor="config-avatar-size" error={configErrors.avatar_thumb_size} hint="16–2048 px">
                <input
                  id="config-avatar-size"
                  className="adm-input"
                  type="number"
                  min={16}
                  max={2048}
                  value={configForm.avatar_thumb_size}
                  onChange={event => setConfigField('avatar_thumb_size', event.target.value)}
                />
              </Field>
              <Field label="相片缩略图尺寸" htmlFor="config-image-size" error={configErrors.image_thumb_size} hint="32–4096 px">
                <input
                  id="config-image-size"
                  className="adm-input"
                  type="number"
                  min={32}
                  max={4096}
                  value={configForm.image_thumb_size}
                  onChange={event => setConfigField('image_thumb_size', event.target.value)}
                />
              </Field>
              <Field label="缩略图质量" htmlFor="config-quality" error={configErrors.image_thumb_quality} hint="1–100">
                <input
                  id="config-quality"
                  className="adm-input"
                  type="number"
                  min={1}
                  max={100}
                  value={configForm.image_thumb_quality}
                  onChange={event => setConfigField('image_thumb_quality', event.target.value)}
                />
              </Field>
              <Field label="缩略图 effort" htmlFor="config-effort" error={configErrors.image_thumb_effort} hint="0–9">
                <input
                  id="config-effort"
                  className="adm-input"
                  type="number"
                  min={0}
                  max={9}
                  value={configForm.image_thumb_effort}
                  onChange={event => setConfigField('image_thumb_effort', event.target.value)}
                />
              </Field>
              <Field label="最大图片尺寸" htmlFor="config-dimension" error={configErrors.max_image_dimension} hint="256–16384 px">
                <input
                  id="config-dimension"
                  className="adm-input"
                  type="number"
                  min={256}
                  max={16384}
                  value={configForm.max_image_dimension}
                  onChange={event => setConfigField('max_image_dimension', event.target.value)}
                />
              </Field>
              <Field label="最大上传大小" htmlFor="config-upload" error={configErrors.max_upload_mb} hint="1–1024 MB">
                <input
                  id="config-upload"
                  className="adm-input"
                  type="number"
                  min={1}
                  max={1024}
                  value={configForm.max_upload_mb}
                  onChange={event => setConfigField('max_upload_mb', event.target.value)}
                />
              </Field>
            </div>

            <div className="adm-form-actions">
              <button type="submit" className="adm-button adm-button--primary" disabled={configSaving}>
                {configSaving ? <><Spinner size={16} /> 保存中…</> : <><Icon name="check" size={16} /> 保存配置</>}
              </button>
            </div>
          </form>
        )}
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
