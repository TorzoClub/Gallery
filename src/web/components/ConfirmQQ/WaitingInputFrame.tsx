import React, { useCallback, useEffect, useState } from 'react'
import { thunkify } from 'ramda'
import WaitingInput from './WaitingInput'

export const __INPUT_WAITTIME__ = 1200
export type WaitingInputFrameProps = {
  initFocus?: boolean
  isFailure: boolean
  disabled: boolean
  placeholder: string
  handleInputChange: (v: string) => void
  handlesubmitDetect: (v: string) => void
}
export default function WaitingInputFrame(props: WaitingInputFrameProps) {
  const [ is_focus, setFocus ] = useState(Boolean(props.initFocus))
  const [ input_text, setInputText ] = useState('')
  const [ submit_detectd, setDetected ] = useState(false)

  const submitDetect = useCallback(() => {
    setDetected(true)
    if (input_text && input_text.length) {
      // 空密码不会跳转的
      props.handlesubmitDetect(input_text)
      setFocus(false)
    }
  }, [props, input_text])

  useEffect(() => {
    if (input_text.length && !submit_detectd) {
      const timer = setTimeout(submitDetect, __INPUT_WAITTIME__)
      return () => clearTimeout(timer)
    }
  }, [input_text, submitDetect, submit_detectd])

  const handleInputChange = useCallback((new_input: string) => {
    setDetected(false)
    setInputText(new_input)
    props.handleInputChange(new_input)
  }, [props])

  return (
    <WaitingInput
      isFailure={ props.isFailure }
      disabled={ props.disabled }
      placeholder={ props.placeholder }
      value={ input_text }
      onChange={ handleInputChange }
      isFocus={ is_focus }
      onBlur={ thunkify(setFocus)(false) }
      onFocus={ thunkify(setFocus)(true) }
    />
  )
}
