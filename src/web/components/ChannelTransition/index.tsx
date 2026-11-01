import React, { useEffect, useRef, useState } from 'react'

import ChannelAfterglow from '../ChannelAfterglow'
import ChannelOsd, { type ChannelOsdName } from '../ChannelOsd'
import ChannelSwitch from '../ChannelSwitch'
import { playChannelSwitchSound } from '../../utils/crt-audio'

const AFTERGLOW_DURATION = 2400
const OSD_DURATION = 3000

type AfterglowState = {
  id: number
  startVh: number
}

export type ChannelTransitionProps = {
  channel: ChannelOsdName
  targets: readonly React.RefObject<HTMLElement | null>[]
  onSwitched(): void
  onFinished(): void
}

export default function ChannelTransition({
  channel,
  targets,
  onSwitched,
  onFinished,
}: ChannelTransitionProps) {
  const [switching, setSwitching] = useState(true)
  const [osd_visible, setOsdVisible] = useState(true)
  const [afterglow, setAfterglow] = useState<AfterglowState | null>(null)
  const next_afterglow_id = useRef(0)
  const played_sound = useRef(false)
  const on_switched_ref = useRef(onSwitched)
  const on_finished_ref = useRef(onFinished)

  useEffect(() => {
    on_switched_ref.current = onSwitched
    on_finished_ref.current = onFinished
  }, [onFinished, onSwitched])

  useEffect(() => {
    if (played_sound.current) {
      return
    }
    played_sound.current = true
    playChannelSwitchSound()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setOsdVisible(false), OSD_DURATION)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!switching) {
      return
    }

    const active_targets = targets
      .map(target => target.current)
      .filter((target): target is HTMLElement => target !== null)

    if (active_targets.length === 0) {
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

      for (const target of active_targets) {
        target.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        target.style.filter = 'contrast(1.08) saturate(1.15)'
      }
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame)
      for (const target of active_targets) {
        target.style.transform = ''
        target.style.filter = ''
      }
    }
  }, [switching, targets])

  useEffect(() => {
    if (afterglow === null) {
      return
    }

    const timer = window.setTimeout(() => {
      setAfterglow(null)
      on_finished_ref.current()
    }, AFTERGLOW_DURATION)

    return () => window.clearTimeout(timer)
  }, [afterglow])

  const handleSwitchDone = () => {
    setSwitching(false)
    on_switched_ref.current()
    setAfterglow({
      id: ++next_afterglow_id.current,
      startVh: 30 + Math.random() * 30,
    })
  }

  return (
    <>
      {afterglow && (
        <ChannelAfterglow
          key={`afterglow-${afterglow.id}`}
          startVh={afterglow.startVh}
        />
      )}
      {osd_visible && <ChannelOsd name={channel} />}
      {switching && <ChannelSwitch onDone={handleSwitchDone} />}
    </>
  )
}
