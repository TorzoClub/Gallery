import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { getMemberVoteList } from '../api/gallery'
import { setRetryVote } from '../api/member'
import { listPhotos } from '../api/photo'
import type { MemberVote, Photo } from '../api/types'
import { useConfirm } from '../components/ConfirmProvider'
import DataTable, { Column } from '../components/DataTable'
import { PageHeader } from '../components/Feedback'
import Icon from '../components/Icon'
import ImageThumb from '../components/ImageThumb'
import { useToast } from '../components/ToastProvider'
import { getApiErrorMessage } from '../utils/errors'
import { formatQQ } from '../utils/format'

type VoteFilter = 'all' | 'voted' | 'not_voted'

export default function PhotoMemberVotePage() {
  const { gallery_id: galleryIDParam } = useParams<{ gallery_id: string }>()
  const galleryID = Number(galleryIDParam)
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [memberVotes, setMemberVotes] = useState<MemberVote[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<VoteFilter>('all')
  const [busyMemberID, setBusyMemberID] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!Number.isInteger(galleryID) || galleryID <= 0) {
      setLoadError('无效的相册 ID')
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError('')
    try {
      const [photoList, voteList] = await Promise.all([
        listPhotos(galleryID),
        getMemberVoteList(galleryID),
      ])
      setPhotos(Array.isArray(photoList) ? photoList : [])
      setMemberVotes(Array.isArray(voteList) ? voteList : [])
    } catch (err) {
      setLoadError(getApiErrorMessage(err, '获取成员投票情况失败'))
    } finally {
      setLoading(false)
    }
  }, [galleryID])

  useEffect(() => {
    void load()
  }, [load])

  const photoMap = useMemo(() => {
    const map = new Map<number, Photo>()
    photos.forEach(photo => map.set(photo.id, photo))
    return map
  }, [photos])

  const votedCount = useMemo(
    () => memberVotes.filter(member => (member.votes?.length ?? 0) > 0).length,
    [memberVotes],
  )
  const notVotedCount = memberVotes.length - votedCount

  const rows = useMemo(() => {
    if (filter === 'voted') {
      return memberVotes.filter(member => (member.votes?.length ?? 0) > 0)
    }
    if (filter === 'not_voted') {
      return memberVotes.filter(member => (member.votes?.length ?? 0) === 0)
    }
    return memberVotes
  }, [filter, memberVotes])

  const handleRetryVote = async (member: MemberVote) => {
    if (busyMemberID !== null) {
      return
    }

    const confirmed = await confirm({
      title: '设置重新投票',
      message: `你确定要让【${member.name}】重新投票吗？该成员在当前相册的投票记录会被清除。`,
      confirmText: '设置重投',
      danger: true,
    })
    if (!confirmed) {
      return
    }

    setBusyMemberID(member.id)
    try {
      await setRetryVote({ id: member.id, gallery_id: galleryID })
      toast.success(`【${member.name}】已经可以重新投票`)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err, '设置重投失败'))
    } finally {
      setBusyMemberID(null)
    }
  }

  const columns: Column<MemberVote>[] = [
    {
      key: 'id',
      title: '成员 ID',
      width: 88,
      align: 'right',
      render: member => member.id,
    },
    {
      key: 'name',
      title: '名称',
      width: 160,
      render: member => (
        <Link className="adm-text-link" to={`/admin/member/${member.id}`}>
          {member.name}
        </Link>
      ),
    },
    {
      key: 'qq_num',
      title: 'QQ 号',
      width: 130,
      render: member => <code className="adm-code">{formatQQ(member.qq_num)}</code>,
    },
    {
      key: 'votes',
      title: '投票状况',
      sortValue: member => member.votes?.length ?? 0,
      render: member => {
        const votes = member.votes ?? []
        if (votes.length === 0) {
          return <span className="adm-muted">未投</span>
        }

        return (
          <div className="adm-vote-thumbs">
            {votes.map(vote => {
              const photo = photoMap.get(vote.photo_id)
              if (!photo) {
                return <span key={vote.id} className="adm-muted">照片不存在</span>
              }
              return (
                <ImageThumb
                  key={vote.id}
                  src={photo.thumb_url}
                  alt={`相片 ${photo.id}`}
                  onClick={() => navigate(`/admin/gallery/${galleryID}/photo/${photo.id}`)}
                />
              )
            })}
          </div>
        )
      },
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      align: 'right',
      render: member => (
        <button
          type="button"
          className="adm-button adm-button--small adm-button--danger"
          disabled={busyMemberID !== null}
          onClick={() => void handleRetryVote(member)}
        >
          <Icon name="refresh" size={14} />
          {busyMemberID === member.id ? '处理中…' : '设置重投'}
        </button>
      ),
    },
  ]

  return (
    <div className="adm-page">
      <PageHeader
        title="成员投票情况"
        subtitle={`相册 ID：${Number.isInteger(galleryID) ? galleryID : '—'}`}
        backTo={`/admin/gallery/${galleryID}/photo/list`}
        backLabel="返回相片列表"
        actions={(
          <button type="button" className="adm-button" disabled={loading} onClick={() => void load()}>
            <Icon name="refresh" size={16} />
            刷新
          </button>
        )}
      />

      <div className="adm-summary-row">
        <span className="adm-summary-chip">总人数 {memberVotes.length}</span>
        <span className="adm-summary-chip adm-summary-chip--success">已投 {votedCount}</span>
        <span className="adm-summary-chip adm-summary-chip--warning">未投 {notVotedCount}</span>
      </div>

      <div className="adm-filter-row" role="group" aria-label="投票状态筛选">
        {([
          ['all', '全部'],
          ['voted', '已投'],
          ['not_voted', '未投'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'adm-filter-button adm-filter-button--active' : 'adm-filter-button'}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

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
        rowKey={member => member.id}
        loading={loading}
        emptyText="没有符合条件的成员"
      />
    </div>
  )
}
