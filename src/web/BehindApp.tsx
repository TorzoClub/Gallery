import pkg from '../../package.json'
import { Link } from 'react-router-dom'

import './BehindApp.css'

export default function BehindApp() {
  return (
    <section className='behind-app' aria-label='关于同装相册'>
      <div className='behind-app__inner'>
        <Link className='behind-app__back' to='/' autoFocus>
          ← 回到相册
        </Link>
        <p className='behind-app__eyebrow'>BEHIND TEST</p>
        <h1 className='behind-app__title'>About</h1>
        <p className='behind-app__version'>同装相册 v{pkg.version}</p>
      </div>
    </section>
  )
}
