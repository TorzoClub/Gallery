import React, { ReactNode, useEffect, useRef, useState } from 'react'

import './index.scss'
import useDisableScroll from 'hooks/useDisableScroll'

// 与 index.scss 中的 $AnimationDuration + $BodyDelayTiming 保持一致。
export const TotalAnimationDuration = 1100

type TransitionState = 'entering' | 'entered' | 'exiting' | 'exited'

export type Props = {
  children: ReactNode
  in: boolean
  onClickAnyWhere?: () => void
}

export default function DialogLayout(props: Props) {
  const { in: inProp, onClickAnyWhere } = props

  const [rendered, setRendered] = useState(Boolean(inProp))
  const [state, setState] = useState<TransitionState>(inProp ? 'entered' : 'exited')
  const previousIn = useRef(Boolean(inProp))

  useDisableScroll(Boolean(inProp))

  useEffect(() => {
    if (previousIn.current === inProp) {
      return
    }
    previousIn.current = inProp

    let timer: ReturnType<typeof setTimeout> | undefined

    if (inProp) {
      setRendered(true)
      setState('entering')
      timer = setTimeout(() => setState('entered'), TotalAnimationDuration)
    } else {
      setState('exiting')
      timer = setTimeout(() => {
        setState('exited')
        setRendered(false)
      }, TotalAnimationDuration)
    }

    return () => {
      if (timer !== undefined) {
        clearTimeout(timer)
      }
    }
  }, [inProp])

  if (!rendered) {
    return null
  }

  return (
    <div className={`fullscreen-layout-wrapper ${state}`} onClick={() => onClickAnyWhere && onClickAnyWhere()}>
      <div className="fullscreen-layout">
        <div className="bg"></div>
        <div className="fs-body">
          {props.children}
        </div>
      </div>
    </div>
  )
}
