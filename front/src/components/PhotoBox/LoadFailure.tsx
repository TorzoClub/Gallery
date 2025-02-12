import React from 'react'
import SkeuomorphismButton from 'components/SkeuomorphismButton'

export default (props: { onClick(): void }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ marginBottom: '0.618em' }}>读取失败</div>
      <SkeuomorphismButton onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        props.onClick()
      }}>重试</SkeuomorphismButton>
    </div>
  )
}
