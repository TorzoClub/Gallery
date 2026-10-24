import React from 'react'
import s from './index.module.scss'

export default function SkeuomorphismButton(
  props: React.PropsWithChildren<{
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    inputProps?: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>
  }>
) {
  const { inputProps = {} } = props
  return (
    <div {...inputProps} className={`${s.ButtonContainer} ${inputProps?.className ?? ''}`}>
      <button
        className={s.ButtonBefore}
        onClick={props.onClick}
        type="button"
      >{props.children}</button>
    </div>
  )
}
