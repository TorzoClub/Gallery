import { Link, useNavigate } from "react-router-dom"
import './index.css'
import PushButton, { PushButtonProps } from "./PushButton"

export default function Navigator(props: {
  showTitle: boolean
  pressed?: PushButtonProps['pressed']
  onClickPushButton(): void
}) {
  return (
    <div className="navigator">
      <div className="navigator-title">
        {props.showTitle ? (<>
          <span className="navigator-title-word">TORZO</span>
          <span className="navigator-title-space"> </span>
          <span className="navigator-title-word">GΛLLERY</span>
        </>) : ''}
      </div>
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
