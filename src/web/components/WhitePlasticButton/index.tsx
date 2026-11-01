import React, { useEffect, useState } from 'react'

import './index.css'

export interface WhitePlasticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * 由外部强制按下，适合提交中等需要保持按压态的场景。
   */
  press?: boolean
}

export const WhitePlasticButton: React.FC<WhitePlasticButtonProps> = ({
  press = false,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDown,
  onKeyUp,
  onBlur,
  children,
  className = '',
  disabled,
  ...rest
}) => {
  const [is_pressed, setIsPressed] = useState(false)
  const [button_deg, setButtonDeg] = useState(-0.5)
  const is_press = press || is_pressed

  useEffect(() => {
    if (disabled) {
      setIsPressed(false)
    }
  }, [disabled])

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(event)
    if (disabled || event.defaultPrevented || event.button !== 0) {
      return
    }

    event.currentTarget.setPointerCapture?.(event.pointerId)
    setIsPressed(true)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    onPointerUp?.(event)
    setIsPressed(false)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    onPointerCancel?.(event)
    setIsPressed(false)
  }

  const handleLostPointerCapture = (event: React.PointerEvent<HTMLButtonElement>) => {
    onLostPointerCapture?.(event)
    setIsPressed(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event)
    if (disabled || event.defaultPrevented || event.repeat) {
      return
    }
    if (event.key === ' ' || event.key === 'Enter') {
      setIsPressed(true)
    }
  }

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyUp?.(event)
    if (event.key === ' ' || event.key === 'Enter') {
      setIsPressed(false)
    }
  }

  const handleBlur = (event: React.FocusEvent<HTMLButtonElement>) => {
    onBlur?.(event)
    setIsPressed(false)
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // 每次点击后换一个很小的倾角，模拟塑料按键的松垮感。
    setButtonDeg((Math.floor(Math.random() * 11) - 5) / 10)
    onClick?.(event)
  }

  return (
    <div
      className={`wpb-housing ${disabled ? 'wpb-disabled' : ''}`}
      style={{
        '--button-rotate': `${button_deg}deg`,
      } as React.CSSProperties}
    >
      <button
        {...rest}
        type={rest.type ?? 'button'}
        className={`wpb-button ${is_press ? 'wpb-pressed' : ''} ${className}`}
        disabled={disabled}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={handleBlur}
      >
        {children}
      </button>
    </div>
  )
}
