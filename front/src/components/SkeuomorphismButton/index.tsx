import React from 'react'
import s from './index.module.scss'

export default function SkeuomorphismButton(
  props: React.PropsWithChildren<{
    onClick?: React.MouseEventHandler<HTMLButtonElement>
  }>
) {
  return (
    <div className={s.ButtonContainer}>
      <button
        className={s.ButtonBefore}
        onClick={props.onClick}
        type="button"
      >{props.children}</button>
    </div>
  )
}
