import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import BehindApp from './BehindApp'
import ChannelAfterglow from './components/ChannelAfterglow'
import ChannelOsd, { type ChannelOsdName } from './components/ChannelOsd'
import ChannelSwitch from './components/ChannelSwitch'
import HomeApp from './HomeApp'
import styles from './PublicRoot.module.scss'
import { playChannelSwitchSound, primeChannelAudio } from './utils/crt-audio'

export function isBehindPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return normalized === '/behind' || normalized.startsWith('/behind/')
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type SwitchState = {
  id: number
  target: 'behind' | 'home'
}

type OsdState = {
  id: number
  name: ChannelOsdName
}

type AfterglowState = {
  id: number
  startVh: number
}

export default function PublicRoot() {
  const location = useLocation()
  const behind = isBehindPath(location.pathname)
  const previousBehind = useRef(behind)
  const nextSwitchId = useRef(0)
  const nextOsdId = useRef(0)
  const homeStageRef = useRef<HTMLDivElement>(null)
  const behindStageRef = useRef<HTMLDivElement>(null)
  const [behindVisible, setBehindVisible] = useState(behind)
  const [switchState, setSwitchState] = useState<SwitchState | null>(null)
  const [osd, setOsd] = useState<OsdState | null>(null)
  const [afterglow, setAfterglow] = useState<AfterglowState | null>(null)

  useEffect(() => {
    const prime = () => primeChannelAudio()
    window.addEventListener('pointerdown', prime, { once: true, capture: true })
    window.addEventListener('keydown', prime, { once: true, capture: true })
    return () => {
      window.removeEventListener('pointerdown', prime, true)
      window.removeEventListener('keydown', prime, true)
    }
  }, [])

  useLayoutEffect(() => {
    if (previousBehind.current === behind) {
      return
    }

    previousBehind.current = behind
    setOsd(null)
    setAfterglow(null)

    if (prefersReducedMotion()) {
      setBehindVisible(behind)
      if (behind) {
        setOsd({ id: ++nextOsdId.current, name: 'Behind' })
      }
      return
    }

    if (behind) {
      // 换台完成前只让 Home 抖动，不提前露出 Behind。
      setBehindVisible(false)
    }

    playChannelSwitchSound()
    nextSwitchId.current += 1
    setSwitchState({
      id: nextSwitchId.current,
      target: behind ? 'behind' : 'home',
    })
  }, [behind])

  const finishSwitch = useCallback((state: SwitchState) => {
    setBehindVisible(state.target === 'behind')
    setSwitchState(current => (current?.id === state.id ? null : current))

    nextOsdId.current += 1
    setOsd({
      id: nextOsdId.current,
      name: state.target === 'behind' ? 'Behind' : 'Home',
    })
    setAfterglow({
      id: state.id,
      startVh: 30 + Math.random() * 30,
    })
  }, [])

  useEffect(() => {
    if (!osd) {
      return
    }

    const timer = window.setTimeout(() => {
      setOsd(current => (current?.id === osd.id ? null : current))
    }, 3000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [osd])

  useEffect(() => {
    if (afterglow === null) {
      return
    }

    const timer = window.setTimeout(() => {
      setAfterglow(current => (current?.id === afterglow.id ? null : current))
    }, 2400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [afterglow])

  useEffect(() => {
    const targets = [homeStageRef.current, behindStageRef.current]
      .filter((target): target is HTMLDivElement => target !== null)

    if (targets.length === 0 || switchState === null) {
      for (const target of targets) {
        target.style.transform = ''
        target.style.filter = ''
      }
      return
    }

    let frame = 0
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const tick = () => {
      const xDirection = Math.random() < 0.5 ? -1 : 1
      const yDirection = Math.random() < 0.5 ? -1 : 1
      const x = xDirection * viewportWidth * (0.3 + Math.random() * 0.4)
      const y = yDirection * viewportHeight * (0.3 + Math.random() * 0.4)

      for (const target of targets) {
        target.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        target.style.filter = 'contrast(1.08) saturate(1.15)'
      }
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame)
      for (const target of targets) {
        target.style.transform = ''
        target.style.filter = ''
      }
    }
  }, [switchState])

  const lockScroll = behind || switchState !== null
  useEffect(() => {
    if (!lockScroll) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [lockScroll])

  return (
    <>
      <div ref={homeStageRef} className={styles.channelBackground}>
        <HomeApp />
      </div>
      {behindVisible && (
        <div ref={behindStageRef} className={styles.channelBehind}>
          <BehindApp />
        </div>
      )}
      {afterglow && (
        <ChannelAfterglow
          key={`afterglow-${afterglow.id}`}
          startVh={afterglow.startVh}
        />
      )}
      {osd && <ChannelOsd key={`osd-${osd.id}`} name={osd.name} />}
      {switchState && (
        <ChannelSwitch
          key={`switch-${switchState.id}`}
          onDone={() => finishSwitch(switchState)}
        />
      )}
    </>
  )
}
