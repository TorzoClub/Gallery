import React, { useEffect } from 'react'
import { Memo } from 'vait'

import GalleryHome from './layouts/GalleryHome'
// import CoverScroller from './layouts/CoverScroller'
// import BgImageUrl from 'assets/bg.png'
import { useFailureLayout } from './components/FailureLayout'

import './App.css'
import { signal_critical_error } from './signals'

export const appInitInfomation = Memo({
  picutre_support: { avif: false, webp: false }
})

export default function App() {
  const [ showFailure, , failure_layout ] = useFailureLayout(<AppInner />)

  useEffect(() => {
    signal_critical_error.receive(showFailure)
    return () => signal_critical_error.cancelReceive(showFailure)
  }, [showFailure])

  return <>{failure_layout}</>
}

const buildDescription = import.meta.env.VITE_BUILD_DESCRIPTION

function AppInner() {
  return (
    <div className="app">
    {
      buildDescription && buildDescription.length && (
        <pre className="build-description">
          <code>{ buildDescription }</code>
        </pre>
      )
    }

    <GalleryHome />

    <style>{`
      .app {
        background-repeat: repeat;
      }
      .build-description {
        color: grey;
        font-size: 12px;
        padding: 0;
        margin: 0;
        line-height: 1em;
        max-width: 100vw;
        word-break: break-all;
        display: inline-block;
        white-space: break-spaces;
      }
    `}</style>
  </div>
  )
}
