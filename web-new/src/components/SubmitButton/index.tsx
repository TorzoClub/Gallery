import { CSSProperties } from 'react'

import './index.scss'

export default ({ className = '', style = {}, mode, clickButton }: {
  className?: string
  style?: CSSProperties
  mode: string
  clickButton?: () => void
}) => {
  return (
    <div
      className={`button-frame ${mode} ${className}`}
      onClick={clickButton}
      style={{ ...style }}
    >
      <div className="button-loop">
        <div className="loop"></div>
      </div>
      <div className="button-click">
        <span className="text-label">提交</span>
      </div>
    </div>
  )
}
