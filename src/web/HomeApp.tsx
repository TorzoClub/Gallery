import React from 'react'
import { Memo } from 'vait'

import ExplorePage from './layouts/Explore'
// import CoverScroller from './layouts/CoverScroller'
// import BgImageUrl from 'assets/bg.png'

import './HomeApp.css'
import { Link, useNavigate } from 'react-router-dom'
import Navigator from './components/Navigator'


export const appInitInfomation = Memo({
  picutre_support: { avif: false, webp: false }
})

export default function AppHome() {
  const navigate = useNavigate()

  return (
    <div className="app">
      <Navigator
        scene='explore'
        onClickPushButton={() => {
          navigate('/behind', {
            replace: true,
          })
        }}
      />
      <ExplorePage />
    </div>
  )
}
