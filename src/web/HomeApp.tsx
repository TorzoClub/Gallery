import React from 'react'
import { Memo } from 'vait'

import ExplorePage from './layouts/Explore'
// import CoverScroller from './layouts/CoverScroller'
// import BgImageUrl from 'assets/bg.png'

import './HomeApp.css'
import { Link } from 'react-router-dom'


export const appInitInfomation = Memo({
  picutre_support: { avif: false, webp: false }
})

export default function AppHome() {
  return (
    <div className="app">
      <Link
        className='home-app__about'
        aria-label='关于同装相册'
        style={{ position: 'absolute', top: 0, right: '24px' }}
        to='/behind'
      >About</Link>

      <ExplorePage />
    </div>
  )
}
