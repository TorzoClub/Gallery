import React from 'react'
import s from './index.module.css'

const a = s.Wrapper

export default () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '50px' }}>
      <div className={s.Wrapper}>
        <div className={s.Circle}></div>
      </div>
    </div>
  )
}
