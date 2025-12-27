import React, { useEffect } from 'react'
import { Memo } from 'new-vait'

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

function AppInner() {
  return (
    <div className="app">
    {
      process.env.REACT_APP_BUILD_DESCRIPTION && process.env.REACT_APP_BUILD_DESCRIPTION.length && (
        <pre className="build-description">
          <code>{ process.env.REACT_APP_BUILD_DESCRIPTION }</code>
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
