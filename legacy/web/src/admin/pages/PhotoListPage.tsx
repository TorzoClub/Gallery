import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { getGallery } from '../api/gallery'
import { listPhotos, removePhoto, sortPhotosByVoteCount } from '../api/photo'
import type { Gallery, Photo } from '../api/types'
import { useConfirm } from '../components/ConfirmProvider'
import DataTable, { Column } from '../components/DataTable'
import { PageHeader, Spinner } from '../components/Feedback'
import GalleryEditorModal from '../components/GalleryEditorModal'
import Icon from '../components/Icon'
import ImageThumb from '../components/ImageThumb'
import { useToast } from '../components/ToastProvider'
import { formatDateTime } from '../utils/date'
import { getApiErrorMessage } from '../utils/errors'
import { memberDisplayName } from '../utils/format'

export default function PhotoListPage() {
  const { gallery_id: galleryIDParam } = useParams<{ gallery_id: string }>()
  const galleryID = Number(galleryIDParam)
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sortBusy, setSortBusy] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isInteger(galleryID) || galleryID <= 0) {
      setLoadError('无效的相册 ID')
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError('')
    try {
      const [list, galleryDetail] = await Promise.all([
        listPhotos(galleryID),
        getGallery(galleryID),
      ])
      setPhotos(Array.isArray(list) ? list : [])
      setGallery(galleryDetail)
    } catch (err) {
      setLoadError(getApiErrorMessage(err, '获取相册或相片列表失败'))
    } finally {
      setLoading(false)
    }
  }, [galleryID])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(
    () => [...photos].sort((left, right) => left.index - right.index || left.id - right.id),
    [photos],
  )

  const handleDelete = async (photo: Photo) => {
    const confirmed = await confirm({
      title: '删除相片',
      message: `你确定要删除这张由【${memberDisplayName(photo.member)}】上传的相片吗？`,
      confirmText: '删除',
      danger: true,
    })
    if (!confirmed) {
      return
    }

    try {
      await removePhoto(photo.id)
      toast.success('相片已删除')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err, '删除相片失败'))
    }
  }

  const handleSortByVotes = async () => {
    if (sortBusy) {
      return
    }

    const confirmed = await confirm({
      title: '按投票数排序',
      message: '将按当前票数重新排列图库中的相片。票数越高，排序越靠前。',
      confirmText: '开始排序',
    })
    if (!confirmed) {
      return
    }

    setSortBusy(true)
    try {
      await sortPhotosByVoteCount(galleryID)
      toast.success('已按投票数排序')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err, '排序失败'))
    } finally {
      setSortBusy(false)
    }
  }

  const columns: Column<Photo>[] = [
    {
      key: 'id',
      title: 'ID',
      width: 68,
      align: 'right',
      render: photo => photo.id,
    },
    {
      key: 'index',
      title: '排序',
      width: 82,
      align: 'center',
      sortValue: photo => photo.index,
      render: photo => photo.index,
    },
    {
      key: 'thumb',
      title: '预览',
      width: 92,
      align: 'center',
      render: photo => (
        <ImageThumb
          src={photo.thumb_url}
          alt={`相片 ${photo.id}`}
          onClick={() => navigate(`/admin/gallery/${galleryID}/photo/${photo.id}`)}
        />
      ),
    },
    {
      key: 'author',
      title: '作者',
      width: 150,
      render: photo => memberDisplayName(photo.member),
    },
    {
      key: 'vote_count',
      title: '票数',
      width: 84,
      align: 'center',
      sortValue: photo => photo.vote_count,
      render: photo => <span className="adm-vote-count">{photo.vote_count}</span>,
    },
    {
      key: 'created_at',
      title: '创建时间',
      width: 160,
      render: photo => formatDateTime(photo.created_at),
    },
    {
      key: 'updated_at',
      title: '修改时间',
      width: 160,
      render: photo => formatDateTime(photo.updated_at),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      align: 'right',
      render: photo => (
        <div className="adm-actions">
          <button type="button" className="adm-button adm-button--small adm-button--danger" onClick={() => void handleDelete(photo)}>
            <Icon name="trash" size={14} />
            删除
          </button>
          <Link className="adm-button adm-button--small" to={`/admin/gallery/${galleryID}/photo/${photo.id}`}>
            <Icon name="edit" size={14} />
            查看
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="adm-page">
      <PageHeader
        title="相片列表"
        subtitle={`相册 ID：${Number.isInteger(galleryID) ? galleryID : '—'} · 共 ${photos.length} 张投稿`}
        backTo="/admin/gallery"
        backLabel="返回相册列表"
        actions={(
          <>
            <button type="button" className="adm-button" disabled={loading} onClick={() => void load()}>
              <Icon name="refresh" size={16} />
              刷新
            </button>
            <Link className="adm-button" to={`/admin/gallery/${galleryID}/photo/member`}>
              <Icon name="users" size={16} />
              成员投票
            </Link>
            <button type="button" className="adm-button" disabled={sortBusy || loading} onClick={() => void handleSortByVotes()}>
              {sortBusy ? <><Spinner size={16} /> 排序中…</> : <><Icon name="sort" size={16} /> 按票数排序</>}
            </button>
            <button type="button" className="adm-button" disabled={!gallery || loading} onClick={() => setEditorOpen(true)}>
              <Icon name="edit" size={16} />
              编辑相册
            </button>
            <Link className="adm-button adm-button--primary" to={`/admin/gallery/${galleryID}/photo/new`}>
              <Icon name="plus" size={16} />
              创建相片
            </Link>
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
        rowKey={photo => photo.id}
        loading={loading}
        emptyText="这个相册还没有相片"
      />

      <GalleryEditorModal
        open={editorOpen}
        gallery={gallery}
        galleries={gallery ? [gallery] : []}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { void load() }}
      />
    </div>
  )
}
