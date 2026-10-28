import { type CSSProperties, type FunctionComponent } from 'react'

import Spinner from '../Spinner'
import style from './index.module.scss'

export const LoadingMask: FunctionComponent<{
  opacity?: CSSProperties['opacity']
}> = props => (
  <div className={style['loading-mask']} style={{ ...props }}>
    <Spinner audioVolume={.8} sweepSpeed={10} />
  </div>
)
