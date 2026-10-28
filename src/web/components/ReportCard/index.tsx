import React, { useLayoutEffect, useMemo, useRef } from 'react'

import styles from './index.module.scss'

export type ReportCardConfig = {
  stamp: {
    x: number
    y: number
    angle: number
  }
  paper: {
    color: string
    roughness: number
    grain: number
    mottle: number
  }
  ink: {
    missing: number
  }
  creases: number
}

export type ReportCardConfigInput = {
  stamp?: Partial<ReportCardConfig['stamp']>
  paper?: Partial<ReportCardConfig['paper']>
  ink?: Partial<ReportCardConfig['ink']>
  creases?: number
}

export type ReportCardRow = readonly [string, string] | {
  name: string
  value: string
}

export type ReportCardBuild = {
  date: string
  hash: string
}

export const DEFAULT_REPORT_CARD_CONFIG: ReportCardConfig = {
  stamp: {
    x: 18,
    y: 34,
    angle: -9,
  },
  paper: {
    color: '#f2d663',
    roughness: 0.35,
    grain: 0.8,
    mottle: 0,
  },
  ink: {
    missing: 0.5,
  },
  creases: 0.45,
}

export const DEFAULT_REPORT_CARD_ROWS: readonly ReportCardRow[] = [
  ['Version', 'v4.0.0-preview'],
  ['Uptime', '4y2m1d'],
  ['Submissions', '245'],
  ['Votes', '2189'],
  ['API prefix', '/'],
  ['Base path', '/'],
]

export const DEFAULT_REPORT_CARD_BUILD: ReportCardBuild = {
  date: '2026-10-27',
  hash: '2fa24f9',
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function resolveConfig(input?: ReportCardConfigInput): ReportCardConfig {
  return {
    stamp: { ...DEFAULT_REPORT_CARD_CONFIG.stamp, ...(input?.stamp ?? {}) },
    paper: { ...DEFAULT_REPORT_CARD_CONFIG.paper, ...(input?.paper ?? {}) },
    ink: { ...DEFAULT_REPORT_CARD_CONFIG.ink, ...(input?.ink ?? {}) },
    creases: input?.creases ?? DEFAULT_REPORT_CARD_CONFIG.creases,
  }
}

function shade(hex: string, amount: number): string {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized, 16)
  const target = amount > 0 ? 255 : 0
  const weight = Math.abs(amount)
  const channels = [value >> 16, (value >> 8) & 255, value & 255]
    .map(channel => Math.round(channel + (target - channel) * weight))
  return `rgb(${channels[0]},${channels[1]},${channels[2]})`
}

function noiseImage(size: number, id: string, filterBody: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
    `<filter id='${id}' color-interpolation-filters='sRGB' x='0' y='0' width='100%' height='100%'>${filterBody}</filter>` +
    `<rect width='${size}' height='${size}' filter='url(#${id})'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function holes(slope: number, threshold: number): string {
  return `<feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${slope} 0 0 0 ${(-slope * threshold).toFixed(3)}'/>`
}

function applyConfig(element: HTMLDivElement, config: ReportCardConfig): void {
  const set = (name: string, value: string) => {
    element.style.setProperty(name, value)
  }
  const paper = config.paper
  const missing = clamp(config.ink.missing)

  // set('--paper-a', shade(paper.color, 0.16))
  // set('--paper-b', shade(paper.color, -0.05))

  const frequency = (0.35 + clamp(paper.grain) * 0.8).toFixed(3)
  set('--bump', noiseImage(240, 'report-card-paper-bump',
    `<feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='3' seed='2' stitchTiles='stitch' result='t'/>` +
    `<feDiffuseLighting in='t' lighting-color='#fff' surfaceScale='${(clamp(paper.roughness) * 1.2).toFixed(2)}'>` +
    `<feDistantLight azimuth='45' elevation='80'/></feDiffuseLighting>`))

  const mottle = clamp(paper.mottle)
  set('--mottle', noiseImage(600, 'report-card-paper-mottle',
    `<feTurbulence type='fractalNoise' baseFrequency='.004 .006' numOctaves='2' seed='7' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 .5 0 0 0 0 .35 0 0 0 0 .1 ${mottle} 0 0 0 ${(-mottle * 0.35).toFixed(3)}'/>`))

  set('--ink-grain', noiseImage(220, 'report-card-ink',
    `<feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' seed='3' stitchTiles='stitch'/>` +
    holes(8, missing * 0.5)))
  set('--stamp-grain', noiseImage(200, 'report-card-stamp',
    `<feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='11' stitchTiles='stitch'/>` +
    holes(6, missing * 0.4)))
  set('--stamp-blotch', noiseImage(260, 'report-card-stamp-blotch',
    `<feTurbulence type='fractalNoise' baseFrequency='.035' numOctaves='3' seed='4' stitchTiles='stitch'/>` +
    holes(4, missing * 0.4)))

  set('--crease', String(clamp(config.creases)))
  set('--stamp-x', `${config.stamp.x}px`)
  set('--stamp-y', `${config.stamp.y}px`)
  set('--stamp-angle', `${config.stamp.angle}deg`)
}

function rowParts(row: ReportCardRow): [string, string] {
  if (Array.isArray(row)) {
    return [row[0], row[1]]
  }
  const named = row as { name: string, value: string }
  return [named.name, named.value]
}

export default function ReportCard({
  config: configInput,
  report = DEFAULT_REPORT_CARD_ROWS,
  build = DEFAULT_REPORT_CARD_BUILD,
  className,
}: {
  config?: ReportCardConfigInput
  report?: readonly ReportCardRow[]
  build?: ReportCardBuild
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const config = useMemo(() => resolveConfig(configInput), [configInput])

  useLayoutEffect(() => {
    if (rootRef.current !== null) {
      applyConfig(rootRef.current, config)
    }
  }, [config])

  const rootClassName = [styles.reportPage, className].filter(Boolean).join(' ')

  return (
    <div ref={rootRef} className={rootClassName}>
      <div className={styles.sheet}>
        <section className={styles.card} aria-label='App Environment Reports'>
          <div className={styles.ink}>
            <h1 className={styles.title}>App Environment<br />Reports</h1>
            <div className={`${styles.row} ${styles.cols}`}>
              <div>NAME</div>
              <div>VALUE</div>
            </div>
            <div>
              {report.map((row, index) => {
                const [name, value] = rowParts(row)
                return (
                  <div className={styles.row} key={`${name}-${index}`}>
                    <div className={styles.k}>{name}</div>
                    <div className={styles.v}>{value}</div>
                  </div>
                )
              })}
            </div>
            <div className={`${styles.row} ${styles.blank}`}><div /><div /></div>
            <div className={`${styles.row} ${styles.blank}`}><div /><div /></div>
            <div className={`${styles.row} ${styles.blank}`}><div /><div /></div>
          </div>

          <svg className={styles.creases} viewBox='0 0 360 470' preserveAspectRatio='none' aria-hidden='true'>
            <filter id='report-card-wob' filterUnits='userSpaceOnUse' x='0' y='0' width='360' height='470'>
              <feTurbulence type='fractalNoise' baseFrequency='.035' numOctaves='2' seed='8' result='n' />
              <feDisplacementMap in='SourceGraphic' in2='n' scale='6' xChannelSelector='R' yChannelSelector='G' />
              <feGaussianBlur stdDeviation='.55' />
            </filter>
            <g filter='url(#report-card-wob)' fill='none' strokeLinecap='round'>
              <path d='M200 10 L207 240 L199 455' stroke='rgba(100,62,0,.34)' strokeWidth='1.3' />
              <path d='M202 10 L209 240 L201 455' stroke='rgba(255,255,255,.38)' strokeWidth='1.2' />
              <path d='M8 168 L175 176 L352 170' stroke='rgba(100,62,0,.30)' strokeWidth='1.3' />
              <path d='M8 170.2 L175 178.2 L352 172.2' stroke='rgba(255,255,255,.34)' strokeWidth='1.2' />
              <path d='M0 322 L110 300 L168 296' stroke='rgba(100,62,0,.24)' strokeWidth='1.1' />
              <path d='M0 323.8 L110 301.8 L168 297.8' stroke='rgba(255,255,255,.3)' strokeWidth='1' />
              <path d='M262 470 L318 428 L360 388' stroke='rgba(100,62,0,.30)' strokeWidth='1.2' />
              <path d='M263.5 471 L319.5 429 L360 390' stroke='rgba(255,255,255,.3)' strokeWidth='1' />
              <path d='M296 70 L318 118' stroke='rgba(100,62,0,.18)' strokeWidth='1' />
            </g>
          </svg>
        </section>

        <div className={styles.stamp} aria-label='build info'>
          <i className={styles.logo} />
          <div>
            <div>构建日期: {build.date}</div>
            <div>githash: {build.hash}</div>
          </div>
        </div>
      </div>

      <svg width='0' height='0' style={{ position: 'absolute' }} aria-hidden='true'>
        <filter id='report-card-press' x='-2%' y='-2%' width='104%' height='104%'>
          <feTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='2' seed='5' result='n' />
          <feDisplacementMap in='SourceGraphic' in2='n' scale='1.8' xChannelSelector='R' yChannelSelector='G' />
          <feGaussianBlur stdDeviation='.45' />
          <feComponentTransfer><feFuncA type='linear' slope='2.6' intercept='-.5' /></feComponentTransfer>
        </filter>
        <filter id='report-card-stamp-press' x='-3%' y='-3%' width='106%' height='106%'>
          <feTurbulence type='fractalNoise' baseFrequency='.6' numOctaves='2' seed='9' result='n' />
          <feDisplacementMap in='SourceGraphic' in2='n' scale='1.5' xChannelSelector='R' yChannelSelector='G' />
          <feGaussianBlur stdDeviation='.35' />
          <feComponentTransfer><feFuncA type='linear' slope='2.2' intercept='-.4' /></feComponentTransfer>
        </filter>
      </svg>
    </div>
  )
}
