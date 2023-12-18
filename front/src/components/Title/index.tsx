import React, { ReactNode, useEffect, useRef, useState } from 'react'
import './index.scss'

export default (p: { title: string | number } & SlitProps) => (
  <div className="title-split-line-wrapper">
    <SplitLineTitle>{ p.title }</SplitLineTitle>
    <Slit open={p.open}>{ p.children }</Slit>
    <div className="title-split-line-bottom-wrapper">
      <SplitLineTitle>{ p.title }</SplitLineTitle>
    </div>
  </div>
)

const SplitLineTitle = (p: { children: ReactNode }) => (
  <div className="title-split-line">
    <div className="title-split-line-body">{ p.children }</div>
  </div>
)

type SlitProps = { open?: boolean, children?: ReactNode }
function Slit(p: SlitProps) {
  const slit_wrapper_ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const slit_wrapper_el = slit_wrapper_ref.current
    if (slit_wrapper_el) {
      const { scrollHeight } = slit_wrapper_el
      if (p.open) {
        slit_wrapper_el.style.height = `${scrollHeight}px`
      } else {
        slit_wrapper_el.style.height = '0px'
      }
      return () => {
        slit_wrapper_el.style.transition = 'height ease 360ms'
      }
    }
  }, [p.open])

  return (
    <div className="slit-wrapper" ref={ slit_wrapper_ref }>
      <div className="slit">{ p.children }</div>
    </div>
  )
}
