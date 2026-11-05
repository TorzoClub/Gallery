import React from 'react'
import styles from './index.module.scss'

const NORMAL_CENTERS = [55, 145, 235, 325, 415] as const
const BLOCKED_CENTER = 505
const BROWSER_TOP = 220
const SERVER_X = 280
const SERVER_BOTTOM = 58

/** 第六个网页的断点：沿服务器到浏览器的斜线取中点附近 */
const BROKEN_ANGLE_RAD = Math.atan2(
  BROWSER_TOP - SERVER_BOTTOM,
  BLOCKED_CENTER - SERVER_X,
)
const BROKEN = {
  x: SERVER_X + (BLOCKED_CENTER - SERVER_X) * 0.56,
  y: SERVER_BOTTOM + (BROWSER_TOP - SERVER_BOTTOM) * 0.56,
  angle: BROKEN_ANGLE_RAD * 180 / Math.PI,
  unit_x: Math.cos(BROKEN_ANGLE_RAD),
  unit_y: Math.sin(BROKEN_ANGLE_RAD),
}
/** 从断点中心到两侧线段端点的距离；链环本身占 ±17px */
const BROKEN_LINE_GAP = 19

function BrowserIcon({ center, blocked = false }: { center: number; blocked?: boolean }) {
  const stroke = blocked ? '#b36a5d' : '#8d8c87'
  const top = blocked ? '#f3ddd7' : '#e9e5d7'
  const paper = blocked ? '#fff8f4' : '#fffdf6'

  return (
    <g transform={`translate(${center - 24} ${BROWSER_TOP})`}>
      <rect width='48' height='38' rx='4' fill={paper} stroke={stroke} />
      <path d='M0 11 H48' stroke={stroke} strokeWidth='0.8' />
      <circle cx='6' cy='5.5' r='1.3' fill={stroke} />
      <circle cx='10.5' cy='5.5' r='1.3' fill={stroke} />
      <circle cx='15' cy='5.5' r='1.3' fill={stroke} />
      <rect x='8' y='17' width='32' height='13' rx='1.5' fill={top} stroke='none' />
      {blocked && (
        <g stroke='#b36a5d' strokeWidth='1.4' strokeLinecap='round'>
          <path d='M20 18 L28 29' />
          <path d='M28 18 L20 29' />
        </g>
      )}
    </g>
  )
}

function ServerIcon() {
  return (
    <g transform='translate(252 14)'>
      <rect width='56' height='20' rx='3' fill='#fffdf6' stroke='#5b666b' />
      <rect y='24' width='56' height='20' rx='3' fill='#fffdf6' stroke='#5b666b' />
      <circle cx='10' cy='10' r='2' fill='#5b666b' />
      <circle cx='10' cy='34' r='2' fill='#5b666b' />
      <path d='M18 10 H45' stroke='#b9b3a4' strokeWidth='1.2' />
      <path d='M18 34 H45' stroke='#b9b3a4' strokeWidth='1.2' />
      <path d='M42 7 V13 M46 7 V13' stroke='#8d8c87' strokeWidth='1.4' />
      <path d='M42 31 V37 M46 31 V37' stroke='#8d8c87' strokeWidth='1.4' />
    </g>
  )
}

/**
 * OverRunning 的示意图：
 * 服务器在顶端，五条线向下发散到五个网页；第六个网页的连线在途中断开。
 */
export default function TooManyTabsIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 560 300'
      role='img'
      aria-label='服务器连接到五个网页，第六个网页的连接已经断开'
      className={`${styles.icon} ${className}`.trim()}
    >
      <g fill='none' strokeLinecap='round' strokeLinejoin='round'>
        <ServerIcon />
        <circle cx={SERVER_X} cy={SERVER_BOTTOM} r='2.2' fill='#5b666b' stroke='none' />

        {/* 五条发散连接 */}
        {NORMAL_CENTERS.map(center => (
          <g key={center}>
            <path
              d={`M${SERVER_X} ${SERVER_BOTTOM} L${center} ${BROWSER_TOP}`}
              stroke='#8d8c87'
              strokeWidth='1.2'
            />
            <circle cx={center} cy={BROWSER_TOP} r='2' fill='#5b666b' stroke='none' />
            <BrowserIcon center={center} />
          </g>
        ))}

        {/* 第六个：连接在途中被扯断。两条线段停在链环外侧，中间只留链环和标签 */}
        <g stroke='#b36a5d' strokeWidth='1.2'>
          <path
            d={`M${SERVER_X} ${SERVER_BOTTOM} L${BROKEN.x - BROKEN.unit_x * BROKEN_LINE_GAP} ${BROKEN.y - BROKEN.unit_y * BROKEN_LINE_GAP}`}
          />
          <path
            d={`M${BROKEN.x + BROKEN.unit_x * BROKEN_LINE_GAP} ${BROKEN.y + BROKEN.unit_y * BROKEN_LINE_GAP} L${BLOCKED_CENTER} ${BROWSER_TOP}`}
          />
          <circle cx={BLOCKED_CENTER} cy={BROWSER_TOP} r='2' fill='#b36a5d' stroke='none' />
        </g>
        <BrowserIcon center={BLOCKED_CENTER} blocked />

        <g
          transform={`translate(${BROKEN.x} ${BROKEN.y}) rotate(${BROKEN.angle})`}
          stroke='#b36a5d'
          strokeWidth='1.4'
        >
          <rect x='-17' y='-4' width='12' height='8' rx='4' />
          <rect x='5' y='-4' width='12' height='8' rx='4' />
        </g>
        <text
          className={styles.cannot}
          x={BROKEN.x + 20}
          y={BROKEN.y - 5}
          fill='#b36a5d'
          fontFamily='Courier New, Courier, monospace'
          fontSize='10'
          fontWeight='700'
          letterSpacing='1.8'
          textAnchor='start'
        >
          CANNOT
        </text>
      </g>
    </svg>
  )
}
