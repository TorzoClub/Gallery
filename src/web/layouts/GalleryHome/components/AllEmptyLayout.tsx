import React, { useState } from 'react'

export default () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      color: '#888'
    }}>
      <p>羡慕，竟然是空的，没有创建任何的相册</p>
      <p>当然，也有可能是站长删库跑路了！</p>
    </div>
  )
}
