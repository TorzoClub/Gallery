import React, { useRef, useEffect, useState } from 'react'

import s from './index.module.scss'

export default ({ showArrow = true, animatedTickTock, children }) => {
  const WrapperEl = useRef(null)
  const [pos, setPos] = useState(null)
  const [showAnimated, setAnimated] = useState(false)
  const [reserveAnimated, setReserveAnimated] = useState(false)
  
  useEffect(() => {
    const el = WrapperEl.current
    if (!el) {
      return
    }

    const handler = () => {
      const { availHeight } = window.screen
      const { top: elTop, height: elHeight } = el.getBoundingClientRect()

      if ((elTop - availHeight) > 0) {
        setPos('below')
      } else if ((elTop + elHeight) < 0) {
        setPos('above')
      } else {
        setPos(null)
      }
    }

    handler()
    window.addEventListener('scroll', handler)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
    }
  }, [WrapperEl.current])

  useEffect(() => {
    if (animatedTickTock < 0) {
      // 设定反向播放
      setReserveAnimated(true)
    }

    setAnimated(true)
    const timer = setTimeout(() => {
      setAnimated(false)
      setReserveAnimated(false)
    }, 382)
    return () => {
      setAnimated(false)
      setReserveAnimated(false)
      clearTimeout(timer)
    }
  }, [animatedTickTock])

  const classShow = showArrow ? s.GuideLayoutShow : s.GuideLayoutHide

  const showNode = (
    <div
      className={`${s.GuideLayout} ${classShow} ${s[`GuideLayout-${pos}`]} ${showAnimated ? s.animate : ''} ${reserveAnimated ? s.reserve : ''}`}
    >
      <div className={s.shadow}>
        <div className={`${s.Arrow} ${s.Arrow0}`}>
          <div className={`${s.Line} ${s.Line1}`}></div>
          <div className={`${s.Line} ${s.Line2}`}></div>
        </div>
        <div className={`${s.Arrow} ${s.Arrow1}`}>
          <div className={`${s.Line} ${s.Line1}`}></div>
          <div className={`${s.Line} ${s.Line2}`}></div>
        </div>
        <div className={`${s.Arrow} ${s.Arrow2}`}>
          <div className={`${s.Line} ${s.Line1}`}></div>
          <div className={`${s.Line} ${s.Line2}`}></div>
        </div>
        <div className={`${s.Arrow} ${s.Arrow3}`}>
          <div className={`${s.Line} ${s.Line1}`}></div>
          <div className={`${s.Line} ${s.Line2}`}></div>
        </div>
      </div>
      <div className={s.body}>
        <div className={`${s.Arrow} ${s.Arrow0}`}>
          <div className={`${s.Line} ${s.Line1}`}></div>
          <div className={`${s.Line} ${s.Line2}`}></div>
        </div>
        <div className={`${s.Arrow} ${s.Arrow1}`}>
          <div className={`${s.Line} ${s.Line1}`}></div>
          <div className={`${s.Line} ${s.Line2}`}></div>
        </div>
        <div className={`${s.Arrow} ${s.Arrow2}`}>
          <div className={`${s.Line} ${s.Line1}`}></div>
          <div className={`${s.Line} ${s.Line2}`}></div>
        </div>
        <div className={`${s.Arrow} ${s.Arrow3}`}>
          <div className={`${s.Line} ${s.Line1}`}></div>
          <div className={`${s.Line} ${s.Line2}`}></div>
        </div>
      </div>
    </div>
  )

  return (
    <div ref={WrapperEl} className={s.GuideLayoutWrapper}>
      {children}
      {showNode}
    </div>
  )
}
