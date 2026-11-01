import React, { useEffect, useRef } from 'react'

import styles from './index.module.scss'

export type SpinnerProps = {
  size?: number
  audioVolume?: number
  blockLineWidth?: number
  blockLineLength?: number
  blockLineRadius?: number
  blockLineDistance?: number
  blockLineCount?: number
  sweepSpeed?: number
  highlightColor?: string
  decay?: number
  decayColor?: string
  className?: string
}

const DEFAULT_BLOCK_LINE_WIDTH = 3
const DEFAULT_BLOCK_LINE_LENGTH = 9
const DEFAULT_BLOCK_LINE_RADIUS = 1.5
const DEFAULT_BLOCK_LINE_DISTANCE = 6
const DEFAULT_BLOCK_LINE_COUNT = 12
const DEFAULT_SWEEP_SPEED = 1000 / 75
const DEFAULT_HIGHLIGHT_COLOR = '#000'
const DEFAULT_DECAY = 0.9
const DEFAULT_DECAY_COLOR = '#e7e7e7'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const tickNoiseBuffers = new WeakMap<AudioContext, AudioBuffer>()

function getTickNoise(context: AudioContext): AudioBuffer {
  const cached = tickNoiseBuffers.get(context)
  if (cached !== undefined) {
    return cached
  }

  const duration = 0.04
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  )
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }
  tickNoiseBuffers.set(context, buffer)
  return buffer
}

function playTick(context: AudioContext, volume: number, tick: boolean): void {
  const now = context.currentTime
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  source.buffer = getTickNoise(context)
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(tick ? 2450 : 1750, now)
  filter.Q.value = 1.8

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, volume * 0.55), now + 0.0015)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(context.destination)
  source.start(now)
  source.stop(now + 0.04)
}

export default function Spinner({
  size,
  audioVolume = 0,
  blockLineWidth = DEFAULT_BLOCK_LINE_WIDTH,
  blockLineLength = DEFAULT_BLOCK_LINE_LENGTH,
  blockLineRadius = DEFAULT_BLOCK_LINE_RADIUS,
  blockLineDistance = DEFAULT_BLOCK_LINE_DISTANCE,
  blockLineCount = DEFAULT_BLOCK_LINE_COUNT,
  sweepSpeed = DEFAULT_SWEEP_SPEED,
  highlightColor = DEFAULT_HIGHLIGHT_COLOR,
  decay = DEFAULT_DECAY,
  decayColor = DEFAULT_DECAY_COLOR,
  className,
}: SpinnerProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const lineWidth = Math.max(1, blockLineWidth)
  const lineLength = Math.max(1, blockLineLength)
  const lineDistance = Math.max(0, blockLineDistance)
  const lineRadius = clamp(blockLineRadius, 0, Math.min(lineWidth / 2, lineLength / 2))
  const lineCount = Math.max(1, Math.floor(blockLineCount))
  const resolvedSize = Math.max(1, size ?? 2 * (lineDistance + lineLength))
  const resolvedSpeed = Math.max(0, sweepSpeed)
  const resolvedDecay = clamp(decay, 0, 1)
  const resolvedVolume = clamp(audioVolume, 0, 1)
  const center = resolvedSize / 2
  const lineY = center - lineDistance - lineLength
  const rootClassName = [styles.spinner, className].filter(Boolean).join(' ')

  useEffect(() => {
    const svg = svgRef.current
    if (svg === null) {
      return
    }

    const highlights = Array.from(svg.querySelectorAll<SVGRectElement>('[data-spinner-glow]'))
    if (highlights.length === 0) {
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      for (const highlight of highlights) {
        highlight.setAttribute('opacity', '0')
      }
      return
    }

    const count = highlights.length
    const intensities = new Float32Array(count)
    const speed = Math.max(0, sweepSpeed)
    const decayPerFrame = clamp(decay, 0, 1)
    const volume = clamp(audioVolume, 0, 1)
    let audioContext: AudioContext | null = null
    let frame = 0
    let lastTime: number | null = null
    let accumulator = 0
    let cursor = -1

    const getAudioContext = (): AudioContext | null => {
      if (volume <= 0) {
        return null
      }

      if (audioContext === null) {
        if (typeof window.AudioContext !== 'function') {
          return null
        }
        try {
          audioContext = new window.AudioContext()
        } catch {
          return null
        }
      }

      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => undefined)
        return null
      }

      if (audioContext.state !== 'running') {
        return null
      }

      return audioContext
    }

    const tickAudio = (tick: boolean) => {
      const context = getAudioContext()
      if (context === null) {
        return
      }
      try {
        playTick(context, volume, tick)
      } catch {
        // 音频不可用时静默降级，不影响动画。
      }
    }

    const resumeAudio = () => {
      if (audioContext !== null && audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => undefined)
      }
    }

    if (volume > 0) {
      window.addEventListener('pointerdown', resumeAudio, true)
      window.addEventListener('keydown', resumeAudio, true)
    }

    const animate = (now: number) => {
      if (lastTime === null) {
        lastTime = now
      }

      const dt = Math.min(100, Math.max(0, now - lastTime))
      lastTime = now

      if (speed > 0) {
        accumulator += (dt / 1000) * speed
        while (accumulator >= 1) {
          accumulator -= 1
          cursor = (cursor + 1) % count
          intensities[cursor] = 1
          tickAudio(cursor % 2 === 0)
        }
      }

      const decayFactor = Math.pow(decayPerFrame, dt / (1000 / 60))
      for (let index = 0; index < count; index += 1) {
        const intensity = intensities[index] ?? 0
        const nextIntensity = intensity * decayFactor
        intensities[index] = nextIntensity < 0.002 ? 0 : nextIntensity
        const highlight = highlights[index]
        if (highlight !== undefined) {
          highlight.setAttribute('opacity', (intensities[index] ?? 0).toFixed(3))
        }
      }

      frame = window.requestAnimationFrame(animate)
    }

    frame = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('pointerdown', resumeAudio, true)
      window.removeEventListener('keydown', resumeAudio, true)
      if (audioContext !== null && audioContext.state !== 'closed') {
        void audioContext.close().catch(() => undefined)
      }
    }
  }, [audioVolume, blockLineCount, decay, sweepSpeed])

  return (
    <svg
      ref={svgRef}
      className={rootClassName}
      width={resolvedSize}
      height={resolvedSize}
      viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}
      role='status'
      aria-label='加载中'
      focusable='false'
      style={{ overflow: 'visible' }}
    >
      {Array.from({ length: lineCount }, (_, index) => {
        const angle = (360 / lineCount) * index
        return (
          <g
            key={index}
            transform={`rotate(${angle} ${center} ${center})`}
            data-spinner-line={index}
          >
            <rect
              x={center - lineWidth / 2}
              y={lineY}
              width={lineWidth}
              height={lineLength}
              rx={lineRadius}
              ry={lineRadius}
              fill={decayColor}
            />
            <rect
              data-spinner-glow
              x={center - lineWidth / 2}
              y={lineY}
              width={lineWidth}
              height={lineLength}
              rx={lineRadius}
              ry={lineRadius}
              fill={highlightColor}
              opacity={0}
            />
          </g>
        )
      })}
    </svg>
  )
}
