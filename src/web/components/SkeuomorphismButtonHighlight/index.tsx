import React from 'react'
import styles from './index.module.scss'

type Props = React.PropsWithChildren<{
  active?: boolean
  className?: string
}>

export default function SkeuomorphismButtonHighlight({ active = false, className, children }: Props) {
  const classes = [
    active ? styles.active : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return <div className={classes}>{children}</div>
}
