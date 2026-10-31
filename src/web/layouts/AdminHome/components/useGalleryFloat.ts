import { useEffect } from 'react'
import type React from 'react'

export type FloatTarget = {
  ref: React.RefObject<HTMLElement | SVGGElement | null>
  svg?: boolean
  linked_refs?: readonly React.RefObject<HTMLElement | SVGGElement | null>[]
}

type FloatMotion = {
  amplitude: number
  angle_phase: number
  angle_speed: number
  angle_wobble_phase: number
  radius_phase: number
  radius_speed: number
}

function createMotion(): FloatMotion {
  return {
    amplitude: 2 + Math.random() * 3,
    angle_phase: Math.random() * Math.PI * 2,
    angle_speed: 0.18 + Math.random() * 0.24,
    angle_wobble_phase: Math.random() * Math.PI * 2,
    radius_phase: Math.random() * Math.PI * 2,
    radius_speed: 0.35 + Math.random() * 0.35,
  }
}

function clearElement(target: FloatTarget, element: HTMLElement | SVGGElement) {
  if (target.svg) {
    element.setAttribute('transform', 'translate(0 0)')
  } else {
    (element as HTMLElement).style.transform = ''
  }
}

function clearTarget(target: FloatTarget) {
  for (const ref of [target.ref, ...(target.linked_refs ?? [])]) {
    const element = ref.current
    if (element !== null) {
      clearElement(target, element)
    }
  }
}

export default function useGalleryFloat(targets: readonly FloatTarget[], enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      targets.forEach(clearTarget)
      return
    }

    const entries = targets
      .map(target => ({ target, motion: createMotion() }))
      .filter(entry => entry.target.ref.current !== null)

    let frame = 0
    const tick = (now: number) => {
      const time = now / 1000
      for (const { target, motion } of entries) {
        const breath = 0.5 + 0.5 * Math.sin(time * motion.radius_speed + motion.radius_phase)
        const radius = motion.amplitude * (0.2 + 0.8 * breath)
        const angle = (
          motion.angle_phase
          + time * motion.angle_speed
          + 0.35 * Math.sin(time * 0.17 + motion.angle_wobble_phase)
        )
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        for (const ref of [target.ref, ...(target.linked_refs ?? [])]) {
          const element = ref.current
          if (element === null) {
            continue
          }
          if (target.svg) {
            element.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
          } else {
            (element as HTMLElement).style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
          }
        }
      }
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame)
      entries.forEach(entry => clearTarget(entry.target))
    }
  }, [enabled, targets])
}
