import React from 'react'

import styles from './index.module.css'

export default function ReportLogo({ className = '' }: { className?: string }) {
  return <span className={`${styles.logo} ${className}`} aria-hidden='true' />
}
