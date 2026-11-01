import { useMemo, type ReactNode } from 'react'
import './index.css'
import PushButton, { PushButtonProps } from './PushButton'

export default function Navigator(props: {
  showTitle: boolean
  isAdminTitle: boolean
  pressed?: PushButtonProps['pressed']
  onClickPushButton(): void
}) {
  const title_slot_node = useMemo(() => {
    if (!props.showTitle) {
      return ''
    } else if (props.isAdminTitle) {
      return <>
        <span className='navigator-title-normal'>
          <span className="navigator-title-word">TORZO</span>
          <span className="navigator-title-space"> </span>
          <span className="navigator-title-word">GΛLLERY</span>
        </span>
        <span className="navigator-title-admin">
          <span className="navigator-title-admin-icon">🚧</span>
          <span className="navigator-title-admin-word">Admin</span>
        </span>
      </>
    } else {
      return <>
        <span className="navigator-title-word">TORZO</span>
        <span className="navigator-title-space"> </span>
        <span className="navigator-title-word">GΛLLERY</span>
      </>
    }
  }, [props.showTitle, props.isAdminTitle])

  return (
    <div className="navigator">
      {props.isAdminTitle}
      <div className="navigator-title">{title_slot_node}</div>
      <div className="navigator-button-slot">
        <PushButton
          pressed={props.pressed}
          diameter={34}
          capDiameter={28}
          onClick={props.onClickPushButton}
        />
      </div>
    </div>
  )
}
