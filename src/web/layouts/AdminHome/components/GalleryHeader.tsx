import React, { useId, type ReactNode } from 'react'
import styles from './GalleryHeader.module.scss'

type Props = {
  name: string
  expanded: boolean
  controls?: string
  empty: boolean
  onToggle(): void
  renderName?(name: string, className: string): ReactNode
}

function GalleryIcon({ empty }: { empty: boolean }) {
  const gradient_id = `gallery-icon-sky-${useId().replace(/:/g, '')}`

  if (empty) {
    return (
      <svg
        className={styles.icon}
        viewBox='0 0 40 40'
        aria-hidden='true'
        focusable='false'
      >
        <g transform='rotate(-18 15 24)'>
          <rect
            x='4'
            y='13'
            width='18'
            height='24'
            rx='1.5'
            fill='none'
            stroke='#b9b3a4'
            strokeWidth='1'
            strokeDasharray='2.4 2.4'
            strokeLinecap='round'
          />
        </g>
        <g transform='rotate(16 27 23)'>
          <rect
            x='21'
            y='11'
            width='17'
            height='23'
            rx='1.5'
            fill='none'
            stroke='#b9b3a4'
            strokeWidth='1'
            strokeDasharray='2.4 2.4'
            strokeLinecap='round'
          />
        </g>
        <g transform='rotate(-4 22 20)'>
          <rect
            x='10'
            y='5'
            width='23'
            height='28'
            rx='1.5'
            fill='none'
            stroke='#a9a292'
            strokeWidth='1.1'
            strokeDasharray='2.4 2.4'
            strokeLinecap='round'
          />
        </g>
      </svg>
    )
  }

  return (
    <svg
      className={styles.icon}
      viewBox='0 0 40 40'
      aria-hidden='true'
      focusable='false'
    >
      <defs>
        <linearGradient id={gradient_id} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0' stopColor='#5cc9ff' />
          <stop offset='0.62' stopColor='#238de4' />
          <stop offset='1' stopColor='#bdeeff' />
        </linearGradient>
      </defs>

      <g transform='rotate(-18 15 24)'>
        <rect x='4' y='13' width='18' height='24' rx='1.5' fill='#fffdf6' stroke='#b9b3a4' strokeWidth='0.8' />
        <rect x='6' y='15' width='14' height='17' rx='0.5' fill='#e7a13e' />
        <path d='M6 27c3-4 6-1 8-5 2 3 4 2 6 4v5H6z' fill='#8f4a19' opacity='0.8' />
        <path d='M7 31h12' stroke='#d6cfbd' strokeWidth='1.4' />
      </g>

      <g transform='rotate(16 27 23)'>
        <rect x='21' y='11' width='17' height='23' rx='1.5' fill='#fffdf6' stroke='#b9b3a4' strokeWidth='0.8' />
        <rect x='23' y='13' width='13' height='14' rx='0.5' fill='#2f3038' />
        <path d='M23 24c2-3 4-2 6-4 2 1 3 3 7 4v4H23z' fill='#5a5146' />
        <path d='M24 30h11' stroke='#d6cfbd' strokeWidth='1.4' />
      </g>

      <g transform='rotate(-4 22 20)'>
        <rect x='10' y='5' width='23' height='28' rx='1.5' fill='#fffdf6' stroke='#a9a292' strokeWidth='0.9' />
        <rect x='12' y='7' width='19' height='19' rx='0.5' fill={`url(#${gradient_id})`} />
        <path d='M14 16c2-2 4-1 5 0 2-2 4-1 5 0 2-2 4-1 5 0v4c-3 1-6 2-10 0-2-1-3-1-5-1z' fill='#fff' opacity='0.82' />
        <path d='M13 22c4 2 8 1 11 0 3-1 5-1 7 0v3H13z' fill='#fff' opacity='0.5' />
        <rect x='13' y='28' width='17' height='2' rx='0.8' fill='#e4ddcd' />
      </g>
    </svg>
  )
}

export default function GalleryHeader({ name, expanded, controls, empty, onToggle, renderName }: Props) {
  return (
    <div className={styles.header}>
      <GalleryIcon empty={empty} />
      <button
        type='button'
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls={controls}
        aria-label={expanded ? `收起相册 ${name}` : `展开相册 ${name}`}
        onClick={onToggle}
      >
        <svg viewBox='0 0 16 16' aria-hidden='true' focusable='false'>
          {expanded
            ? <path d='M3 6l5 5 5-5' />
            : <path d='M6 3l5 5-5 5' />}
        </svg>
      </button>
      {renderName === undefined
        ? <h2 className={styles.name}>{name}</h2>
        : renderName(name, styles.name)}
    </div>
  )
}
