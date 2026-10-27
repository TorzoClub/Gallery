import React, { FunctionComponent, useEffect, useState } from 'react'
import style from './index.module.scss'
import Spinner from '../Spinner'

export const LoadingMask: FunctionComponent<{
  backgroundOpacity?: number | string
}> = ({
  backgroundOpacity = 1
}) => (
  <div className={style['loading-mask']} style={{
    backgroundColor: `rgba(255, 255, 255, ${backgroundOpacity})`,
  }}>
    <Spinner audioVolume={.8} sweepSpeed={10} />
  </div>
)
