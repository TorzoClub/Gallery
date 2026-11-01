import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import BehindApp from './BehindApp'
import ChannelAfterglow from './components/ChannelAfterglow'
import ChannelOsd, { type ChannelOsdName } from './components/ChannelOsd'
import ChannelSwitch from './components/ChannelSwitch'
import HomeApp from './HomeApp'
import CancelSubmissionApp from './layouts/CancelSubmission'
import { isAdminPath, isBehindPath, isCancelSubmissionPath, isExplorePath } from './routes'
import styles from './PublicRoot.module.scss'
import { playChannelSwitchSound, primeChannelAudio } from './utils/crt-audio'
import { primeTextAudio } from './utils/text-audio'

const AdminHome = lazy(() => import('./layouts/AdminHome'))

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Channel = 'explore' | 'behind' | 'cancel' | 'admin'

type SwitchState = {
  id: number
  target: Channel
}

const CHANNEL_OSD: Record<Channel, ChannelOsdName> = {
  explore: 'CH. Explore',
  behind: 'CH. Behind',
  cancel: 'CH. cancelSubmission',
  admin: 'CH. Admin',
}

type OsdState = {
  id: number
  name: ChannelOsdName
}

type AfterglowState = {
  id: number
  startVh: number
}

const activeStageStyle: React.CSSProperties = {
  position: 'relative',
}

export default function PublicRoot() {
  const location = useLocation()
  const behind = isBehindPath(location.pathname)
  const explore = isExplorePath(location.pathname)
  const cancel = isCancelSubmissionPath(location.pathname)
  const admin = isAdminPath(location.pathname)
  const routeChannel: Channel | null = admin
    ? 'admin'
    : cancel
      ? 'cancel'
      : behind
        ? 'behind'
        : explore
          ? 'explore'
          : null
  const previousChannel = useRef<Channel>(routeChannel ?? 'explore')
  const nextSwitchId = useRef(0)
  const nextOsdId = useRef(0)
  const homeStageRef = useRef<HTMLDivElement>(null)
  const behindStageRef = useRef<HTMLDivElement>(null)
  const cancelStageRef = useRef<HTMLDivElement>(null)
  const adminStageRef = useRef<HTMLDivElement>(null)
  const [activeChannel, setActiveChannel] = useState<Channel>(routeChannel ?? 'explore')
  const [switchState, setSwitchState] = useState<SwitchState | null>(null)
  const [osd, setOsd] = useState<OsdState | null>(null)
  const [afterglow, setAfterglow] = useState<AfterglowState | null>(null)

  useEffect(() => {
    const prime = () => {
      primeChannelAudio()
      primeTextAudio()
    }
    window.addEventListener('pointerdown', prime, { once: true, capture: true })
    window.addEventListener('keydown', prime, { once: true, capture: true })
    return () => {
      window.removeEventListener('pointerdown', prime, true)
      window.removeEventListener('keydown', prime, true)
    }
  }, [])

  useLayoutEffect(() => {
    if (routeChannel === null || previousChannel.current === routeChannel) {
      return
    }

    previousChannel.current = routeChannel
    setAfterglow(null)
    setOsd({
      id: ++nextOsdId.current,
      name: CHANNEL_OSD[routeChannel],
    })

    if (prefersReducedMotion()) {
      setActiveChannel(routeChannel)
      return
    }

    playChannelSwitchSound()
    nextSwitchId.current += 1
    setSwitchState({
      id: nextSwitchId.current,
      target: routeChannel,
    })
  }, [routeChannel])

  const finishSwitch = useCallback((state: SwitchState) => {
    setActiveChannel(state.target)
    setSwitchState(current => (current?.id === state.id ? null : current))

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
    const targets = [homeStageRef.current, behindStageRef.current, cancelStageRef.current, adminStageRef.current]
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

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeChannel])

  if (!behind && !explore && !cancel && !admin) {
    return <Navigate to='/explore' replace />
  }

  return (
    <>
      {activeChannel === 'behind' && (
        <div
          ref={behindStageRef}
          className={styles.pageStage}
          style={activeStageStyle}
        >
          <BehindApp thisIsDisplay />
        </div>
      )}
      {activeChannel === 'explore' && (
        <div
          ref={homeStageRef}
          className={styles.pageStage}
          style={activeStageStyle}
        >
          <HomeApp />
        </div>
      )}
      {activeChannel === 'cancel' && (
        <div
          ref={cancelStageRef}
          className={styles.pageStage}
          style={activeStageStyle}
        >
          <CancelSubmissionApp thisIsDisplay />
        </div>
      )}
      {activeChannel === 'admin' && (
        <div
          ref={adminStageRef}
          className={styles.pageStage}
          style={activeStageStyle}
        >
          <Suspense fallback={null}>
            <AdminHome thisIsDisplay />
          </Suspense>
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
