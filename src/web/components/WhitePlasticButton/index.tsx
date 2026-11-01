import React, { useMemo, useState } from 'react';
import './index.css'

export interface WhitePlasticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * 控制按键是否处于按压状态（除了鼠标点击外，还可通过代码控制）
   */
  press?: boolean;
  retenion_time?: number
}

export const WhitePlasticButton: React.FC<WhitePlasticButtonProps> = ({
  press = false,
  onClick,
  children,
  className = '',
  disabled,
  retenion_time = 150,
  ...rest
}) => {
  const [button_deg, setButtonDeg] = useState(-0.5)
  const [retention, setRetention] = useState(false)
  const _press = useMemo(() => {
    if (retention) {
      return true
    } else {
      return press
    }
  }, [retention, press])

  return (
    <div className={`wpb-housing ${disabled ? 'wpb-disabled' : ''}`} style={{
      '--button-rotate': `${button_deg}deg`
    } as React.CSSProperties}>
      <button
        className={`wpb-button ${_press ? 'wpb-pressed' : ''} ${className}`}
        onClick={(e) => {
          setButtonDeg(
            (Math.floor(Math.random() * 11) - 5) / 10
          )
          if (!retention) {
            setRetention(true)
            setTimeout(() => {
              setRetention(false)
            }, retenion_time)
          }
          onClick && onClick(e)
        }}
        disabled={disabled}
        {...rest}
      >
        {children}
      </button>
    </div>
  )
}
