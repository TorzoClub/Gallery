import React, { useEffect, useRef } from 'react'
import { Transition } from 'react-transition-group';

import Loading from 'components/Loading'
import Article from './Article'
import WaitingInputFrame from './WaitingInputFrame'
import style from './index.scss'

const duration = Number(style.totalAnimationDuration);

export default (props) => {
  const inputPromptEl = useRef(null)
  const bgEl = useRef(null)
  const bodyEl = useRef(null)

  const { in: inProp, isDone, isFailure } = props

  useEffect(() => {
    console.log('effect')
    // inputPromptEl.current.style.height = getComputedStyle(bodyEl.current).height
    // bgEl.current.style.height = inputPromptEl.current.style.height
  }, [inProp])

  return (
    <Transition in={ Boolean(inProp) } timeout={duration}>
      {state => (
        <div className={ `input-prompt-wrapper ${state}` }>
          <div className="input-prompt" ref={inputPromptEl}>
            <div className="bg" ref={bgEl}></div>
            <div className="ip-body" ref={bodyEl}>
              <Article />

              <div className="prompt-text">{isFailure ? isFailure.message : '以上便是我对大家的期待'}</div>

              {(() => {
                if (isDone) {
                  return <div className="prompt-text">{'👍收到'}</div>
                } else {
                  return <>
                    <WaitingInputFrame
                      isFailure={isFailure}
                      disabled={props.disabled}
                      handleInputChange={props.handleInputChange}
                      handlesubmitDetect={props.handlesubmitDetect}
                      placeholder="QQ Number"
                    />

                    {
                      props.isLoading && <div className="loading-wrapper">
                        <Loading />
                      </div>
                    }
                  </>
                }
              })()}
            </div>
          </div>
        </div>
      )}
    </Transition>
  )
}
