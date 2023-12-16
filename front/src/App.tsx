import React, { Component } from 'react'

import GalleryHome from './layouts/GalleryHome'
// import CoverScroller from './layouts/CoverScroller'
import BgImageUrl from 'assets/bg.png'

import './App.css'

class App extends Component {
  render() {
    return (
      <div className="app">
        {
          process.env.REACT_APP_BUILD_DESCRIPTION && process.env.REACT_APP_BUILD_DESCRIPTION.length && (
            <pre className="build-description">
              <code>{ process.env.REACT_APP_BUILD_DESCRIPTION }</code>
            </pre>
          )
        }
        {/* <CoverScroller /> */}
        <GalleryHome/>
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
}

export default App
