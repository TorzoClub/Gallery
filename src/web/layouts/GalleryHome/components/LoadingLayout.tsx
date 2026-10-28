import React from 'react'
import Spinner from 'components/Spinner'

export default function LoadingLayout() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        // height: '100vh',
        height: 'calc(100dvh + env(safe-area-inset-bottom))',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          lineHeight: 0,
          padding: '20px 36px',
          borderRadius: '8px',
          boxShadow: '0 0 1px grey, 0 4px 12px -4px hsl(0 0% 70% / 1)',
        }}
      >
        <Spinner sweepSpeed={30} decay={.9} />
      </div>
    </div>
  )
}
