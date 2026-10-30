import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { listMembers, removeMember } from '../api/member'
import type { Member } from '../api/types'
import { useConfirm } from '../components/ConfirmProvider'
import DataTable, { Column } from '../components/DataTable'
import { PageHeader } from '../components/Feedback'
import Icon from '../components/Icon'
import ImageThumb from '../components/ImageThumb'
import { useToast } from '../components/ToastProvider'
import { formatDateTime } from '../utils/date'
import { getApiErrorMessage } from '../utils/errors'
import { formatQQ } from '../utils/format'

export default function MemberListPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const list = await listMembers()
      setMembers(Array.isArray(list) ? list : [])
    } catch (err) {
      setLoadError(getApiErrorMessage(err, '获取成员列表失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async (member: Member) => {
    const confirmed = await confirm({
      title: '删除成员',
      message: `你确定要删除【${member.name}】吗？如果成员有投稿或投票，服务端会拒绝删除。`,
      confirmText: '删除',
      danger: true,
    })
    if (!confirmed) {
      return
    }

    try {
      await removeMember(member.id)
      toast.success(`【${member.name}】已删除`)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err, '删除成员失败'))
    }
  }

  const columns: Column<Member>[] = [
    {
      key: 'id',
      title: 'ID',
      width: 70,
      align: 'right',
      render: member => member.id,
    },
    {
      key: 'avatar',
      title: '头像',
      width: 82,
      align: 'center',
      render: member => <ImageThumb src={member.avatar_thumb_url} variant="avatar" alt={`${member.name} 的头像`} />,
    },
    {
      key: 'name',
      title: '成员名',
      render: member => <span className="adm-table__strong">{member.name}</span>,
    },
    {
      key: 'qq_num',
      title: 'QQ 号',
      width: 140,
      render: member => <code className="adm-code">{formatQQ(member.qq_num)}</code>,
    },
    {
      key: 'created_at',
      title: '创建时间',
      width: 160,
      render: member => formatDateTime(member.created_at),
    },
    {
      key: 'updated_at',
      title: '修改时间',
      width: 160,
      render: member => formatDateTime(member.updated_at),
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      align: 'right',
      render: member => (
        <div className="adm-actions">
          <button type="button" className="adm-button adm-button--small adm-button--danger" onClick={() => void handleDelete(member)}>
            <Icon name="trash" size={14} />
            删除
          </button>
          <Link className="adm-button adm-button--small" to={`/admin-legacy/member/${member.id}`}>
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
        title="成员"
        subtitle="管理投稿作者与头像资料"
        actions={(
          <>
            <button type="button" className="adm-button" disabled={loading} onClick={() => void load()}>
              <Icon name="refresh" size={16} />
              刷新
            </button>
            <Link className="adm-button adm-button--primary" to="/admin-legacy/member/new">
              <Icon name="plus" size={16} />
              创建成员
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
        rows={members}
        columns={columns}
        rowKey={member => member.id}
        loading={loading}
        emptyText="还没有成员，先创建一个吧"
      />
    </div>
  )
}
