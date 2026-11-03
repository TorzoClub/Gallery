import React from 'react'
import type { Member } from './AdminConsole'
import Popover from '../../../components/Popover'
import { MemberForm } from './MemberForm'

type Props = {
  mode: 'create' | 'edit'
  member?: Member
  trigger: React.ReactNode
  canDelete?: boolean
  onSaved(): void | Promise<void>
}

/** 相片卡片上点头像时的就地编辑。名单簿里的成员详情改用二级页面，不再用它 */
export default function MemberPopover({ mode, member, trigger, canDelete = false, onSaved }: Props) {
  return (
    <Popover
      trigger={trigger}
      label={mode === 'create' ? '新增成员' : '修改成员'}
      content={(close) => (
        <MemberForm
          mode={mode}
          member={member}
          canDelete={canDelete}
          onClose={close}
          onSaved={onSaved}
        />
      )}
    />
  )
}
