import { useMemo, type ReactNode } from 'react'
import './index.css'
import PushButton from './PushButton'

export default function Navigator({ scene, onClickPushButton }: {
  scene: 'explore' | 'behind' | 'admin'
  onClickPushButton(): void
}) {
  const title_slot_node = useMemo(() => {
    const common_node = (
      <span className='navigator-title-normal'>
        <span className="navigator-title-word">TORZO</span>
        <span className="navigator-title-space"> </span>
        <span className="navigator-title-word">GΛLLERY</span>
      </span>
    )
    if (scene === 'behind') {
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
      <div className="navigator-title">{title_slot_node}</div>
      <div className="navigator-button-slot">
        <PushButton
          diameter={34}
          capDiameter={28}
          onClick={onClickPushButton}
        />
      </div>
    </div>
  )
}
