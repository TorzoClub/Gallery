import React from 'react'

import styles from './index.module.scss'

export type ChannelOsdName = 'Explore' | 'Behind' | 'Admin' | `CH. ${'Explore' | 'Behind' | 'Admin' | 'Member' | 'Staff' | 'cancelSubmission'}`

export default function ChannelOsd({ name }: { name: ChannelOsdName }) {
  return (
    <div className={styles.osd} aria-live='polite'>
      {name}
    </div>
  )
}
