import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { listGalleries, removeGallery } from '../api/gallery'
import type { Gallery } from '../api/types'
import { useConfirm } from '../components/ConfirmProvider'
import DataTable, { Column } from '../components/DataTable'
import { PageHeader } from '../components/Feedback'
import GalleryEditorModal from '../components/GalleryEditorModal'
import Icon from '../components/Icon'
import { useToast } from '../components/ToastProvider'
import { formatDateTime } from '../utils/date'
import { getApiErrorMessage } from '../utils/errors'

export default function GalleryListPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingGallery, setEditingGallery] = useState<Gallery | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const list = await listGalleries()
      setGalleries(Array.isArray(list) ? list : [])
    } catch (err) {
      setLoadError(getApiErrorMessage(err, '获取相册列表失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(
    () => [...galleries].sort((left, right) => left.index - right.index || left.id - right.id),
    [galleries],
  )

  const openCreate = () => {
    setEditingGallery(null)
    setEditorOpen(true)
  }

  const openEdit = (gallery: Gallery) => {
    setEditingGallery(gallery)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
  }

  const handleDelete = async (gallery: Gallery) => {
    const confirmed = await confirm({
      title: '删除相册',
      message: `你确定要删除【${gallery.name}】吗？相册下的相片也会一并删除。`,
      confirmText: '删除',
      danger: true,
    })
    if (!confirmed) {
      return
    }

    try {
      await removeGallery(gallery.id)
      toast.success(`【${gallery.name}】已删除`)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err, '删除相册失败'))
    }
  }

  const columns: Column<Gallery>[] = [
    {
      key: 'id',
      title: 'ID',
      width: 70,
      align: 'right',
      render: gallery => gallery.id,
    },
    {
      key: 'name',
      title: '相册名',
      render: gallery => <span className="adm-table__strong">{gallery.name}</span>,
    },
    {
      key: 'vote_limit',
      title: '限制票数',
      width: 110,
      align: 'center',
      render: gallery => gallery.vote_limit === 0 ? '不限' : gallery.vote_limit,
    },
    {
      key: 'event_start',
      title: '开始时间',
      width: 160,
      render: gallery => formatDateTime(gallery.event_start),
    },
    {
      key: 'submission_expire',
      title: '投稿期限',
      width: 160,
      render: gallery => formatDateTime(gallery.submission_expire),
    },
    {
      key: 'event_end',
      title: '结束时间',
      width: 160,
      render: gallery => formatDateTime(gallery.event_end),
    },
    {
      key: 'actions',
      title: '操作',
      width: 260,
      align: 'right',
      render: gallery => (
        <div className="adm-actions">
          <button type="button" className="adm-button adm-button--small adm-button--danger" onClick={() => void handleDelete(gallery)}>
            <Icon name="trash" size={14} />
            删除
          </button>
          <button type="button" className="adm-button adm-button--small" onClick={() => openEdit(gallery)}>
            <Icon name="edit" size={14} />
            编辑
          </button>
          <Link className="adm-button adm-button--small adm-button--primary" to={`/admin-legacy/gallery/${gallery.id}/photo/list`}>
            <Icon name="gallery" size={14} />
            相片
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="adm-page">
      <PageHeader
        title="相册"
        subtitle="创建活动相册，设置活动时间与投票规则"
        actions={(
          <>
            <button type="button" className="adm-button" disabled={loading} onClick={() => void load()}>
              <Icon name="refresh" size={16} />
              刷新
            </button>
            <button type="button" className="adm-button adm-button--primary" onClick={openCreate}>
              <Icon name="plus" size={16} />
              创建相册
            </button>
          </>
        )}
      />

      {loadError && (
        <div className="adm-inline-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="adm-button adm-button--small" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={gallery => gallery.id}
        loading={loading}
        emptyText="还没有相册，先创建一个吧"
        initialSort={null}
      />

      <GalleryEditorModal
        open={editorOpen}
        gallery={editingGallery}
        galleries={galleries}
        onClose={closeEditor}
        onSaved={() => { void load() }}
      />
    </div>
  )
}
