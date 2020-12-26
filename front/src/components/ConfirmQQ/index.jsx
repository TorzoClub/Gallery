import React, { useEffect, useRef } from 'react'
import { Transition } from 'react-transition-group';

import Loading from 'components/Loading'
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
              <div className="prompt-richtext">
                <p style={{ textAlign: "center" }}>朋友们，感谢参与投票环节</p>

                <p>不过，在投票之前，希望各位能自觉秉承以下的条件来维护「公平公正」与「独立自主」</p>

                <ul>
                  <li>按照自己的喜好投票。不要因为对谁有好感/坏感、对方要求而投票。</li>
                  <li>按照自己的审美投票。不要因为大家说A好，B不好，就选了A。</li>
                </ul>

                <p>以上便是我对大家的期待。</p>
              </div>

              <div className="prompt-text">{isFailure ? isFailure.message : '那么，输入自己的QQ号来进入投票环节吧:'}</div>

              {(() => {
                if (isDone) {
                  return <div className="prompt-text">{'👍已提交'}</div>
                } else {
                  return <>
                    <WaitingInputFrame
                      isFailure={isFailure}
                      disabled={props.disabled}
                      handleInputChange={props.handleInputChange}
                      handlesubmitDetect={props.handlesubmitDetect}
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
