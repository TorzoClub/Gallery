import React, { Activity, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { type Location, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import BehindApp from './BehindApp'
import ChannelTransition from './components/ChannelTransition'
import type { ChannelOsdName } from './components/ChannelOsd'
import HomeApp from './HomeApp'
import CancelSubmissionApp from './layouts/CancelSubmission'
import { isAdminPath, isBehindPath, isCancelSubmissionPath, isExplorePath, isLegacyCancelSubmissionPath, isMemberPath, isStaffPath } from './routes'
import styles from './PublicRoot.module.scss'
import { primeChannelAudio } from './utils/crt-audio'
import { primeTextAudio } from './utils/text-audio'

const AdminHome = lazy(() => import('./layouts/AdminHome'))
const MemberBookApp = lazy(() => import('./layouts/MemberBook'))
const StaffApp = lazy(() => import('./layouts/Staff'))

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Channel = 'explore' | 'behind' | 'admin' | 'member' | 'staff'

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
  staff: 'CH. Staff',
}

const activeStageStyle: React.CSSProperties = {
  position: 'relative',
}

/** 渲染顺序照旧：behind、explore、admin、member、staff */
const STAGE_ORDER: readonly Channel[] = ['behind', 'explore', 'admin', 'member', 'staff']

type ScrollMemo = { pathname: string; y: number }

/**
 * 一个频道的舞台。去过的频道一直挂着，换台只是用 <Activity> 把它藏起来：
 * - 藏起来时 display: none，effect 全部清理（计时器、rAF、监听都停），但组件状态和 DOM 留着
 * - 再显示时 effect 重新跑，页面回到离开时的样子
 * 舞台里的 useLocation 读的是 location：本频道当前的路由，或者离开时的那一条（冻结）。
 * 不冻结的话，藏起来的页面会读到别的频道的路由，比如成员页读到 /explore 会把自己渲染成 <Navigate>，状态就丢了
 */
function ChannelStage({ visible, location, stageRef, children }: {
  visible: boolean
  location: Location
  stageRef: React.RefObject<HTMLDivElement | null>
  children: React.ReactNode
}) {
  return (
    <Activity mode={visible ? 'visible' : 'hidden'}>
      <div ref={stageRef} className={styles.pageStage} style={activeStageStyle}>
        <Routes location={location}>
          <Route path='*' element={children} />
        </Routes>
      </div>
    </Activity>
  )
}

export default function PublicRoot() {
  const location = useLocation()
  const behind = isBehindPath(location.pathname)
  const explore = isExplorePath(location.pathname)
  const cancel = isCancelSubmissionPath(location.pathname)
  const legacy_cancel = isLegacyCancelSubmissionPath(location.pathname)
  const admin = isAdminPath(location.pathname)
  const member = isMemberPath(location.pathname)
  const staff = isStaffPath(location.pathname)
  const routeChannel: Channel | null = admin
    ? 'admin'
    : staff
      ? 'staff'
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
  const staffStageRef = useRef<HTMLDivElement>(null)
  const cancelStageRef = useRef<HTMLDivElement>(null)
  const stage_targets = useMemo(
    () => [homeStageRef, behindStageRef, adminStageRef, memberStageRef, staffStageRef],
    [],
  )
  // 碎纸机页挂在 body 上，但换台时要和 Explore 一起抖
  const home_targets = useMemo(() => [homeStageRef, cancelStageRef], [])
  const [activeChannel, setActiveChannel] = useState<Channel>(routeChannel ?? 'explore')
  // 去过的频道：第一次换台进来才挂载，之后一直留着
  const [visited, setVisited] = useState<ReadonlySet<Channel>>(() => new Set([activeChannel]))
  // 每个频道最后一次是当前路由时的 location；离开后舞台继续读这一条
  const [stage_locations, setStageLocations] = useState<Partial<Record<Channel, Location>>>(
    () => (routeChannel === null ? {} : { [routeChannel]: location }),
  )
  // 每个频道离开时的滚动位置；pathname 不同（比如换了另一位成员）就不还原
  const scroll_memo = useRef<Partial<Record<Channel, ScrollMemo>>>({})
  const scroll_channel = useRef<Channel>(activeChannel)
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

  useLayoutEffect(() => {
    if (routeChannel === null) {
      return
    }
    setStageLocations(current => (
      current[routeChannel] === location ? current : { ...current, [routeChannel]: location }
    ))
  }, [routeChannel, location])

  useEffect(() => {
    setVisited(current => (current.has(activeChannel) ? current : new Set([...current, activeChannel])))
  }, [activeChannel])

  const stageLocation = (channel: Channel): Location => (
    channel === routeChannel ? location : stage_locations[channel] ?? location
  )

  // 页面滚动时记下当前频道的位置。旧页面藏起来后文档变短、浏览器把 scrollY 夹小，那次 scroll 事件
  // 要等到下一帧才派发，那时 scroll_channel 已经是新频道、位置也已还原，不会把夹小的值记到旧频道上
  useEffect(() => {
    const record = () => {
      const channel = scroll_channel.current
      scroll_memo.current[channel] = { pathname: stageLocation(channel).pathname, y: window.scrollY }
    }
    window.addEventListener('scroll', record, { passive: true })
    return () => window.removeEventListener('scroll', record)
  })

  // 换台后还原新频道离开时的滚动位置（第一次来、或路由不同就回顶部）。layout effect：新页面显示后、绘制前就滚好
  useLayoutEffect(() => {
    scroll_channel.current = activeChannel
    const memo = scroll_memo.current[activeChannel]
    const pathname = (activeChannel === routeChannel ? location : stage_locations[activeChannel] ?? location).pathname
    window.scrollTo(0, memo !== undefined && memo.pathname === pathname ? memo.y : 0)
    // 只在换台时还原
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel])

  const STAGE_REFS: Record<Channel, React.RefObject<HTMLDivElement | null>> = {
    behind: behindStageRef,
    explore: homeStageRef,
    admin: adminStageRef,
    member: memberStageRef,
    staff: staffStageRef,
  }

  const stageContent = (channel: Channel): React.ReactNode => {
    switch (channel) {
      case 'behind':
        // 只有当前频道才是 true：BehindApp 靠它在离开时卸掉 System Reports、回来再晚 500ms 挂上
        return <BehindApp thisIsDisplay={activeChannel === 'behind'} />
      case 'explore':
        return <HomeApp />
      case 'admin':
        return (
          <Suspense fallback={null}>
            <AdminHome thisIsDisplay />
          </Suspense>
        )
      case 'member':
        return (
          <Suspense fallback={null}>
            <MemberBookApp />
          </Suspense>
        )
      case 'staff':
        return (
          <Suspense fallback={null}>
            <StaffApp />
          </Suspense>
        )
    }
  }

  if (legacy_cancel) {
    return <Navigate to='/explore/cancelSubmission' replace state={location.state} />
  }

  if (!behind && !explore && !cancel && !admin && !member && !staff) {
    return <Navigate to='/explore' replace />
  }

  return (
    <>
      {/*
        去过的频道一直挂着，换台只藏不卸（见 ChannelStage），回来时页面状态和滚动位置都还在。
        碎纸机页仍然跟着 Explore 的显示走，离开 Explore 就卸掉
      */}
      {STAGE_ORDER.filter(channel => channel === activeChannel || visited.has(channel)).map(channel => (
        <ChannelStage
          key={channel}
          visible={channel === activeChannel}
          location={stageLocation(channel)}
          stageRef={STAGE_REFS[channel]}
        >
          {stageContent(channel)}
        </ChannelStage>
      ))}
      {/* 舞台带常驻 transform，会让内部的 fixed 相对舞台定位、随滚动错位；所以碎纸机页挂到 body 上，直接盖住整个视口 */}
      {activeChannel === 'explore' && cancel_visible && createPortal(
        <div ref={cancelStageRef} className={styles.cancelStage}>
          <CancelSubmissionApp thisIsDisplay />
        </div>,
        document.body,
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
