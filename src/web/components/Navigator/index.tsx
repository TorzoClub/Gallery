import { useMemo, type ReactNode } from 'react'
import './index.css'
import PushButton from './PushButton'

export default function Navigator({ scene, onClickPushButton, onClickAdmin, onClickStaff, indicator }: {
  scene: 'explore' | 'behind' | 'admin' | 'staff'
  onClickPushButton(): void
  /** 传了才显示“D”按钮（Staff 页入口），放在左上角、标题前面 */
  onClickStaff?(): void
  /** 传了才显示“A”按钮（后台入口），放在换台按钮左边 */
  onClickAdmin?(): void
  /** 按钮左边的状态灯位（如后台的“登录”灯）；显示 / 隐藏由传入元素自己的样式决定 */
  indicator?: ReactNode
}) {
  const title_slot_node = useMemo(() => {
    const common_node = (
      <span className='navigator-title-normal'>
        <span className="navigator-title-word">TORZO</span>
        <span className="navigator-title-space"> </span>
        <span className="navigator-title-word">GΛLLERY</span>
      </span>
    )
    if (scene === 'behind' || scene === 'staff') {
      return ''
    } else if (scene === 'admin') {
      return <>
        {common_node}
        <span className="navigator-title-admin">
          <span className="navigator-title-admin-icon">🚧</span>
          <span className="navigator-title-admin-word">Admin</span>
        </span>
      </>
    } else {
      return common_node
    }
  }, [scene])

  return (
    <div className="navigator">
      <div className="navigator-left">
        {onClickStaff !== undefined && (
          <PushButton
            className='navigator-staff-button'
            diameter={34}
            capDiameter={28}
            label='D'
            aria-label='Staff 留言'
            title='Staff 留言'
            onClick={onClickStaff}
          />
        )}
        <div className="navigator-title">{title_slot_node}</div>
      </div>
      <div className="navigator-button-slot">
        {indicator !== undefined && <div className="navigator-indicator">{indicator}</div>}
        {onClickAdmin !== undefined && (
          <PushButton
            className='navigator-admin-button'
            diameter={34}
            capDiameter={28}
            label='A'
            aria-label='进入后台'
            title='进入后台'
            onClick={onClickAdmin}
          />
        )}
        <PushButton
          diameter={34}
          capDiameter={28}
          onClick={onClickPushButton}
        />
      </div>
    </div>
  )
}
