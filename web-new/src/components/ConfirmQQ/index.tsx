import React, { useMemo } from 'react'
import './index.scss'

import DialogLayout, { Props as DialogLayoutProps } from 'components/DialogLayout'

import Article from './Article'
import WaitingInputFrame from './WaitingInputFrame'
import Loading, { LoadingMask } from 'components/Loading'
import { SubmitButton } from 'layouts/GalleryHome/components/ActivityLayout'

export type ConfirmQQState = Pick<DialogLayoutProps, 'in'> & {
  isLoading: boolean
  disabled: boolean
  isFailure: Error | null
}
export type ConfirmQQEvent = {
  handleInputChange: (s: string) => void
  handlesubmitDetect: (s: string) => void
}
export type Props = ConfirmQQState & ConfirmQQEvent

export default (props: Props) => {
  const { in: inProp, isFailure } = props

  const wifNode = useMemo(() => {
    return (
      <div className="qq-input-frame">
        <WaitingInputFrame
          isFailure={Boolean(isFailure)}
          disabled={props.disabled}
          handleInputChange={props.handleInputChange}
          handlesubmitDetect={props.handlesubmitDetect}
          placeholder="QQ Number"
        />
      </div>
    )
  }, [isFailure, props.disabled, props.handleInputChange, props.handlesubmitDetect])

  return (
    <DialogLayout in={Boolean(inProp)}>
      <Article />

      <div className="prompt-text">{isFailure ? isFailure.message : '以上便是我对大家的期待'}</div>

      <div style={{ position: 'relative' }}>
        { wifNode }
        { props.isLoading && <LoadingMask backgroundOpacity={1} /> }
      </div>
    </DialogLayout>
  )
}
