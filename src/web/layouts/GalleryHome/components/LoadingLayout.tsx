import React from 'react'
import Loading from 'components/Loading'

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
        height: '100vh'
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
        <Loading />
      </div>
    </div>
  )
}
