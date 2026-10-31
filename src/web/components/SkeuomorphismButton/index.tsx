import React from 'react'
import s from './index.module.scss'

export default function SkeuomorphismButton(
  props: React.PropsWithChildren<{
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    inputProps?: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>
  }>
) {
  const { inputProps = {} } = props
  return (
    <div {...inputProps} className={`${s.ButtonContainer} ${inputProps?.className ?? ''}`}>
      <button
        className={s.ButtonBefore}
        onClick={props.onClick}
        disabled={props.disabled}
        type="button"
      >{props.children}</button>
    </div>
  )
}
