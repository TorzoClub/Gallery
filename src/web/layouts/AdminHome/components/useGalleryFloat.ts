import { useEffect, useRef } from 'react'
import type React from 'react'

export type FloatTarget = {
  ref: React.RefObject<HTMLElement | SVGGElement | null>
  svg?: boolean
  linked_refs?: readonly React.RefObject<HTMLElement | SVGGElement | null>[]
  rotate_center?: { x: number; y: number }
}

type FloatMotion = {
  amplitude: number
  angle_phase: number
  angle_speed: number
  angle_wobble_phase: number
  radius_phase: number
  radius_speed: number
  rotation_amplitude: number
  rotation_phase: number
  rotation_speed: number
}

type Offset = {
  x: number
  y: number
  rotate: number
}

const ENTER_DURATION = 420
const RETURN_DURATION = 260

function createMotion(): FloatMotion {
  return {
    amplitude: 2 + Math.random() * 3,
    angle_phase: Math.random() * Math.PI * 2,
    angle_speed: 0.18 + Math.random() * 0.24,
    angle_wobble_phase: Math.random() * Math.PI * 2,
    radius_phase: Math.random() * Math.PI * 2,
    radius_speed: 0.35 + Math.random() * 0.35,
    rotation_amplitude: 2 + Math.random() * 6,
    rotation_phase: Math.random() * Math.PI * 2,
    rotation_speed: 0.06 + Math.random() * 0.12,
  }
}

function applyTransform(target: FloatTarget, x: number, y: number, rotate: number) {
  const rotation = rotate === 0
    ? ''
    : target.rotate_center === undefined
      ? ` rotate(${rotate.toFixed(2)})`
      : ` rotate(${rotate.toFixed(2)} ${target.rotate_center.x} ${target.rotate_center.y})`
  for (const ref of [target.ref, ...(target.linked_refs ?? [])]) {
    const element = ref.current
    if (element === null) {
      continue
    }
    if (target.svg) {
      element.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})${rotation}`)
    } else {
      (element as HTMLElement).style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rotate.toFixed(2)}deg)`
    }
  }
}

function clearTarget(target: FloatTarget) {
  for (const ref of [target.ref, ...(target.linked_refs ?? [])]) {
    const element = ref.current
    if (element === null) {
      continue
    }
    if (target.svg) {
      element.setAttribute('transform', 'translate(0 0)')
    } else {
      (element as HTMLElement).style.transform = ''
    }
  }
}

export default function useGalleryFloat(targets: readonly FloatTarget[], enabled: boolean) {
  const offsets = useRef(new Map<FloatTarget, Offset>())

  useEffect(() => {
    const active_targets = targets.filter(target => target.ref.current !== null)

    if (!enabled) {
      const starts = active_targets.map(target => ({
        target,
        from: offsets.current.get(target) ?? { x: 0, y: 0, rotate: 0 },
      }))
      const has_motion = starts.some(({ from }) => (
        from.x !== 0 || from.y !== 0 || from.rotate !== 0
      ))

      if (!has_motion) {
        active_targets.forEach(clearTarget)
        offsets.current.clear()
        return
      }

      const start = performance.now()
      let frame = 0
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / RETURN_DURATION)
        const eased = 1 - Math.pow(1 - progress, 3)
        for (const { target, from } of starts) {
          const x = from.x * (1 - eased)
          const y = from.y * (1 - eased)
          const rotate = from.rotate * (1 - eased)
          applyTransform(target, x, y, rotate)
          offsets.current.set(target, { x, y, rotate })
        }
        if (progress < 1) {
          frame = window.requestAnimationFrame(tick)
        } else {
          starts.forEach(({ target }) => clearTarget(target))
          offsets.current.clear()
        }
      }

      frame = window.requestAnimationFrame(tick)
      return () => window.cancelAnimationFrame(frame)
    }

    active_targets.forEach(target => {
      applyTransform(target, 0, 0, 0)
      offsets.current.set(target, { x: 0, y: 0, rotate: 0 })
    })

    const entries = active_targets.map(target => ({ target, motion: createMotion() }))
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const raw_progress = Math.min(1, (now - start) / ENTER_DURATION)
      const ramp = raw_progress * raw_progress * (3 - 2 * raw_progress)
      const time = now / 1000
      for (const { target, motion } of entries) {
        const breath = 0.5 + 0.5 * Math.sin(time * motion.radius_speed + motion.radius_phase)
        const radius = motion.amplitude * (0.2 + 0.8 * breath) * ramp
        const angle = (
          motion.angle_phase
          + time * motion.angle_speed
          + 0.35 * Math.sin(time * 0.17 + motion.angle_wobble_phase)
        )
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        const rotate = (
          motion.rotation_amplitude
          * Math.sin(time * motion.rotation_speed + motion.rotation_phase)
          * ramp
        )
        applyTransform(target, x, y, rotate)
        offsets.current.set(target, { x, y, rotate })
      }
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [enabled, targets])
}
