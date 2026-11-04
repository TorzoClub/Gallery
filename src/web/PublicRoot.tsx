import React, { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useLocation } from 'react-router-dom'

import BehindApp from './BehindApp'
import ChannelTransition from './components/ChannelTransition'
import type { ChannelOsdName } from './components/ChannelOsd'
import HomeApp from './HomeApp'
import CancelSubmissionApp from './layouts/CancelSubmission'
import { isAdminPath, isBehindPath, isCancelSubmissionPath, isExplorePath, isLegacyCancelSubmissionPath, isMemberPath } from './routes'
import styles from './PublicRoot.module.scss'
import { primeChannelAudio } from './utils/crt-audio'
import { primeTextAudio } from './utils/text-audio'

const AdminHome = lazy(() => import('./layouts/AdminHome'))
const MemberBookApp = lazy(() => import('./layouts/MemberBook'))

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Channel = 'explore' | 'behind' | 'admin' | 'member'

type ChannelTransitionState = {
  id: number
  channel: ChannelOsdName
  target: Channel
}

type CancelTransitionState = {
  id: number
  target_visible: boolean
}

const CHANNEL_OSD: Record<Channel, ChannelOsdName> = {
  explore: 'CH. Explore',
  behind: 'CH. Behind',
  admin: 'CH. Admin',
  member: 'CH. Member',
}

const activeStageStyle: React.CSSProperties = {
  position: 'relative',
}

export default function PublicRoot() {
  const location = useLocation()
  const behind = isBehindPath(location.pathname)
  const explore = isExplorePath(location.pathname)
  const cancel = isCancelSubmissionPath(location.pathname)
  const legacy_cancel = isLegacyCancelSubmissionPath(location.pathname)
  const admin = isAdminPath(location.pathname)
  const member = isMemberPath(location.pathname)
  const routeChannel: Channel | null = admin
    ? 'admin'
    : member
      ? 'member'
    : behind
      ? 'behind'
      : explore
        ? 'explore'
        : null
  const previousChannel = useRef<Channel>(routeChannel ?? 'explore')
  const nextSwitchId = useRef(0)
  const nextCancelId = useRef(0)
  const homeStageRef = useRef<HTMLDivElement>(null)
  const behindStageRef = useRef<HTMLDivElement>(null)
  const adminStageRef = useRef<HTMLDivElement>(null)
  const memberStageRef = useRef<HTMLDivElement>(null)
  const cancelStageRef = useRef<HTMLDivElement>(null)
  const stage_targets = useMemo(
    () => [homeStageRef, behindStageRef, adminStageRef, memberStageRef],
    [],
  )
  // 碎纸机页挂在 body 上，但换台时要和 Explore 一起抖
  const home_targets = useMemo(() => [homeStageRef, cancelStageRef], [])
  const [activeChannel, setActiveChannel] = useState<Channel>(routeChannel ?? 'explore')
  const [channel_transition, setChannelTransition] = useState<ChannelTransitionState | null>(null)
  const previous_cancel_visible = useRef(false)
  const [cancel_visible, setCancelVisible] = useState(false)
  const [cancel_transition, setCancelTransition] = useState<CancelTransitionState | null>(null)

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

    if (prefersReducedMotion()) {
      setActiveChannel(routeChannel)
      return
    }

    nextSwitchId.current += 1
    setChannelTransition({
      id: nextSwitchId.current,
      channel: CHANNEL_OSD[routeChannel],
      target: routeChannel,
    })
  }, [routeChannel])

  useEffect(() => {
    const should_show = cancel && activeChannel === 'explore'
    if (should_show === previous_cancel_visible.current) {
      return
    }
    previous_cancel_visible.current = should_show

    if (should_show === cancel_visible) {
      setCancelTransition(null)
      return
    }

    if (!should_show && !cancel_visible) {
      setCancelTransition(null)
      return
    }

    if (!should_show && !explore) {
      setCancelVisible(false)
      setCancelTransition(null)
      return
    }

    if (prefersReducedMotion()) {
      setCancelVisible(should_show)
      setCancelTransition(null)
      return
    }

    nextCancelId.current += 1
    setCancelTransition({
      id: nextCancelId.current,
      target_visible: should_show,
    })
  }, [activeChannel, cancel, cancel_visible, explore])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeChannel])

  if (legacy_cancel) {
    return <Navigate to='/explore/cancelSubmission' replace state={location.state} />
  }

  if (!behind && !explore && !cancel && !admin && !member) {
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
      {/* 舞台带常驻 transform，会让内部的 fixed 相对舞台定位、随滚动错位；所以碎纸机页挂到 body 上，直接盖住整个视口 */}
      {activeChannel === 'explore' && cancel_visible && createPortal(
        <div ref={cancelStageRef} className={styles.cancelStage}>
          <CancelSubmissionApp thisIsDisplay />
        </div>,
        document.body,
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
      {activeChannel === 'member' && (
        <div
          ref={memberStageRef}
          className={styles.pageStage}
          style={activeStageStyle}
        >
          <Suspense fallback={null}>
            <MemberBookApp />
          </Suspense>
        </div>
      )}
      {channel_transition && (
        <ChannelTransition
          key={`channel-transition-${channel_transition.id}`}
          channel={channel_transition.channel}
          targets={stage_targets}
          onSwitched={() => setActiveChannel(channel_transition.target)}
          onFinished={() => setChannelTransition(current => (
            current?.id === channel_transition.id ? null : current
          ))}
        />
      )}
      {cancel_transition && (
        <ChannelTransition
          key={`cancel-transition-${cancel_transition.id}`}
          channel={cancel_transition.target_visible ? 'CH. cancelSubmission' : 'CH. Explore'}
          targets={home_targets}
          onSwitched={() => setCancelVisible(cancel_transition.target_visible)}
          onFinished={() => setCancelTransition(current => (
            current?.id === cancel_transition.id ? null : current
          ))}
        />
      )}
    </>
  )
}
