import React, { Component, useEffect, useState } from 'react'
import { Signal } from 'new-vait'

import GalleryHome from './layouts/GalleryHome'
// import CoverScroller from './layouts/CoverScroller'
// import BgImageUrl from 'assets/bg.png'
import { useFailureLayout } from './components/FailureLayout'

import './App.css'

const err_sig = Signal<string>()

export const AppCriticalError = err_sig.trigger

export default function App() {
  const [ showFailure, , failure_layout ] = useFailureLayout(<AppInner />)

  useEffect(() => {
    err_sig.receive(showFailure)
    return () => err_sig.cancelReceive(showFailure)
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
