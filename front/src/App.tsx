import React, { Component, useEffect } from 'react'
import { Signal } from 'new-vait'

import GalleryHome from './layouts/GalleryHome'
// import CoverScroller from './layouts/CoverScroller'
import BgImageUrl from 'assets/bg.png'
import { useFailureLayout } from './components/FailureLayout'

import './App.css'

const err_sig = Signal<string>()

export const AppCriticalError = err_sig.trigger

export default function App() {
  const [ showFailure, hasFailure, failure_layout ] = useFailureLayout()

  useEffect(() => {
    err_sig.receive(showFailure)
    return () => err_sig.unReceive(showFailure)
  }, [showFailure])

  return (
    <div className="app">
      {
        process.env.REACT_APP_BUILD_DESCRIPTION && process.env.REACT_APP_BUILD_DESCRIPTION.length && (
          <pre className="build-description">
            <code>{ process.env.REACT_APP_BUILD_DESCRIPTION }</code>
          </pre>
        )
      }

      {hasFailure ? failure_layout : <GalleryHome />}

      <style>{`
        .app {
          background-image: url(${BgImageUrl});
          background-repeat: repeat;
        }
        .build-description {
          color: grey;
          font-size: 12px;
          padding: 0;
          margin: 0;
        }
      `}</style>
    </div>
  )
}
