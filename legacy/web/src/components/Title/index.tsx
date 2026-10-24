import React, { ReactNode, useEffect, useRef } from 'react'
import { thunkify, curry, pipe } from 'ramda'
import { Memo } from 'new-vait'

import './index.scss'

const timer = pipe( setTimeout, thunkify(clearTimeout) )

export default (p: { title: string | number } & SlitProps) => (
  <div className="title-split-line-wrapper-wrapper">
    <div className="title-split-line-wrapper">
      <SplitLineTitle>{ p.title }</SplitLineTitle>
      <Slit {...p}>{ p.children }</Slit>
      <div className="title-split-line-bottom-wrapper">
        <SplitLineTitle>{ p.title }</SplitLineTitle>
      </div>
    </div>
  </div>
)

const SplitLineTitle = (p: { children: ReactNode }) => (
  <div className="title-split-line">
    <div className="title-split-line-body">{ p.children }</div>
  </div>
)

function setElementHeight(el: HTMLElement, height: CSSStyleDeclaration['height']) {
  el.style.height = height
}

function heightSync(parent: HTMLElement, child: HTMLElement) {
  const set_value = `${child.offsetHeight}px`
  if (set_value !== parent.style.height) setElementHeight(parent, set_value)
}

function setTransition(el: HTMLElement, value: CSSStyleDeclaration['transition']) {
  if (value !== el.style.transition) el.style.transition = value
}

const __OPENING_DURATION__ = 360
type SlitProps = {
  open?: boolean,
  keepTransition: boolean,
  children?: ReactNode
}
function Slit(p: SlitProps) {
  const slit_wrapper_ref = useRef<HTMLDivElement>(null)
  const slit_ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const slit_wrapper_el = slit_wrapper_ref.current
    const slit_el = slit_ref.current
    if (slit_el && slit_wrapper_el) {
      const slitWrapper = {
        syncHeight: thunkify(heightSync)(slit_wrapper_el, slit_el),
        clearHeight: thunkify(setElementHeight)(slit_wrapper_el, '0px'),
        transition: curry(setTransition)(slit_wrapper_el)
      }
      if (p.open) {
        slitWrapper.syncHeight()

        const [isPlaying, setPlaying] = Memo(true)
        const onPlayed = thunkify(setPlaying)(false)
        const cancelPlayedTimer = timer(onPlayed, __OPENING_DURATION__)

        const [getAnimeHandler, setAnimeHandler] = Memo(
          requestAnimationFrame(function animating() {
            if (!isPlaying()) {
              if (p.keepTransition) {
                slitWrapper.transition(`height ease ${__OPENING_DURATION__}ms`)
              } else {
                slitWrapper.transition('')
              }
              slitWrapper.syncHeight()
            }
            setAnimeHandler(requestAnimationFrame(animating))
          })
        )

        return () => {
          cancelAnimationFrame(getAnimeHandler())
          cancelPlayedTimer()
          onPlayed()
        }
      } else {
        slitWrapper.transition(`height ease ${__OPENING_DURATION__}ms`)
        slitWrapper.clearHeight()
      }
    }
  }, [p.keepTransition, p.open])

  return (
    <div className="slit-wrapper" ref={ slit_wrapper_ref }>
      <div className="slit" ref={ slit_ref }>
        <div className="slit-inner">
          { p.open ? p.children : null }
        </div>
      </div>
    </div>
  )
}
