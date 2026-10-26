import React from 'react'

import styles from './index.module.scss'

export default function ChannelAfterglow({ startVh }: { startVh: number }) {
  return (
    <div className={styles.afterglow} aria-hidden='true'>
      <span
        className={styles.wave}
        style={{ top: `${startVh}vh` }}
      />
    </div>
  )
}
