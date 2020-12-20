import React, { useState, useEffect } from 'react'

import vait from 'vait'
// import store from 'store'
import Loading from 'components/Loading'
import { fetchList, fetchListWithQQNum, vote } from 'api/photo'

import Gallery from 'components/Gallery'

// import BgImageUrl from 'assets/bg.png'

import HomeContext from './context'

import { getMyQQNum, clearMyQQNum, setMyQQNum } from 'utils/qq-num'

import Fade from 'components/Fade'
import InputPrompt from 'components/InputPrompt'

import PhotoDetail from 'components/Detail'
import SubmitButton from 'components/SubmitButton'

function getData() {
  const qq_num = getMyQQNum()

  if (qq_num) {
    return fetchListWithQQNum(qq_num).catch(err => {
      if ((err.status === 404) && (err.message === '成员不存在')) {
        clearMyQQNum()
        return getData()
      }
    })
  } else {
    return fetchList()
  }
}

const useStateObject = (initObj) => {
  const [obj, setObj] = useState(initObj)
  
  let newObj = { ...obj }
  return [obj, (appendObj) => {
    newObj = { ...obj, ...newObj, ...appendObj }
    return setObj(newObj)
  }]
}

export default (props) => {
  const [selectedGalleryId, setSelectedGalleryId] = useState(null)
  const [selectedIdList, setSelectedIdList] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [list, setList] = useState([])
  const [submittedPool, setSubmittedPool] = useState({})

  const [showDetail, setShowDetail] = useState(false)
  const [detailImageUrl, setDetailImageUrl] = useState('')

  const [inputState, setInputState] = useStateObject({
    showInputPrompt: false,
    submitSuccess: false,
    submitLoading: false,
    submitError: null,
    disableInput: false,
  })

  const refresh = () => {
    // 获取相册数据
    getData().then(list => {
      setList(list)
      setLoaded(true)
    }).catch(err => {
      console.error('获取相册数据失败', err)
      alert(`获取相册数据失败: ${err.message}`)
      setLoaded(false)
    })
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleClickSubmit = async () => {
    try {
      setLoading(true)

      let qq_num = getMyQQNum()

      if (!qq_num) {
        // 未缓存 Q 号
        setInputState({
          showInputPrompt: {
            selectedGalleryId, selectedIdList
          }
        })
      } else {
        await vote({
          gallery_id: selectedGalleryId,
          photo_id_list: selectedIdList,
          qq_num: Number(qq_num)
        })

        setSubmittedPool({
          submittedPool,
          [selectedGalleryId]: true
        })
      }
    } catch (err) {
      console.error(err.message)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <HomeContext.Provider value={{
      selectedGalleryId,
      selectedIdList,
      handleClickVote: async (gallery, photo) => {
        console.warn('handleClickVote', gallery.vote_submitted, photo)

        const isSubmitted = submittedPool[gallery.id]

        if (isSubmitted) {
          return
        }

        if (gallery.is_expired) {
          return
        }

        if (gallery.vote_submitted) {
          return
        }

        const { id, gallery_id } = photo
  
        let newSelectedIdList = [...selectedIdList]
        let newSelectedGalleryId = selectedGalleryId

        if (selectedGalleryId && (gallery_id !== selectedGalleryId)) {
          return alert('different gallery_id')
        } else {
          newSelectedGalleryId = gallery_id
        }

        const idx = newSelectedIdList.indexOf(id)

        if (idx === -1) {
          if (gallery.vote_limit && (newSelectedIdList.length >= gallery.vote_limit)) {
            // alert('enough')
            return
          } else {
            newSelectedIdList.push(id)
          }
        } else {
          newSelectedIdList.splice(idx, 1)
        }

        setSelectedGalleryId(newSelectedGalleryId)
        setSelectedIdList(newSelectedIdList)
      },
      toDetail: ({ imageUrl: detailImageUrl }) => {
        setDetailImageUrl(detailImageUrl)
        setShowDetail(true)
      }
    }}>
      <div className={`gallery-home`}>
        {
          (() => {
            if (loaded) {
              return <div className="body">
                {
                  list.map(gallery => {
                    const showSubmitButton = !gallery.vote_submitted
                    let isSubmitted = submittedPool[gallery.id]
                    // isSubmitted = true

                    let buttonMode = ''

                    if (isSubmitted) {
                      buttonMode = 'done'
                    } else if (inputState.showInputPrompt) {
                      buttonMode = 'blue'
                    } else if (selectedIdList.length) {
                      buttonMode = 'blue ring'
                    }

                    return <div className="gallery-wrapper" key={gallery.id}>
                      <Gallery gallery={gallery} />

                      {
                        !gallery.is_expired && showSubmitButton &&
                        <div className="submit-button-wrapper">
                          {(() => {
                            if (isSubmitted) {
                              return <div className="submitted">感谢你的投票</div>
                            } else {
                              return <SubmitButton
                                mode={buttonMode}
                                clickButton={e => {
                                  if (!showSubmitButton) {
                                    return
                                  }

                                  if (isSubmitted) {
                                    return
                                  }

                                  if (!selectedIdList.length) {
                                    return
                                  }

                                  if (loading) {
                                    return
                                  }

                                  return handleClickSubmit()
                                }}
                              />
                            }
                          })()}
                        </div>
                      }
                    </div>
                  })
                }

                <InputPrompt
                  in={inputState.showInputPrompt}
                  isDone={inputState.submitSuccess}
                  isLoading={inputState.submitLoading}
                  isFailure={inputState.submitError}
                  disabled={inputState.disableInput}
                  handleInputChange={() => {
                    setInputState({
                      submitError: null
                    })
                  }}
                  handlesubmitDetect={async qq_num => {
                    console.error('inputState.submitSuccess', inputState.submitSuccess)

                    try {
                      setInputState({
                        submitLoading: true,
                        disableInput: true,
                      })

                      await vait.timeout(500)

                      const { selectedGalleryId: gallery_id, selectedIdList: photo_id_list } = inputState.showInputPrompt
                      await vote({
                        gallery_id,
                        photo_id_list,
                        qq_num: Number(qq_num)
                      })

                      setMyQQNum(Number(qq_num))

                      setInputState({
                        submitSuccess: true
                      })

                      setSubmittedPool({
                        ...submittedPool,
                        [gallery_id]: true
                      })

                      setTimeout(() => {
                        setInputState({
                          showInputPrompt: false
                        })
                      }, 1500)
                    } catch (err) {
                      if (err.status === 409) {
                        // 已经投过票了

                        if (!getMyQQNum()) {
                          // 首次输入 Q 号进入
                          setMyQQNum(Number(qq_num))
                        }

                        try {
                          await refresh()
                        } finally {
                          setInputState({
                            showInputPrompt: false
                          })
                        }

                        return
                      }

                      console.error('vote error', err)

                      if (err.status === 403 && /已过投票截止时间/.test(err.message)) {
                        alert('已经超时了，朋友，明年再来吧')
                        return
                      }

                      setInputState({
                        submitError: err
                      })
                    } finally {
                      setInputState({
                        submitLoading: false,
                        disableInput: false,
                      })
                    }
                  }}
                />

                {
                  <Fade
                    in={showDetail}
                    appendStyle={{
                      zIndex: 1000,
                      position: 'relative'
                    }}
                  >
                    <PhotoDetail imageUrl={detailImageUrl} onCancel={() => setShowDetail(false)} />
                  </Fade>
                }
              </div>
            } else {
              return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: '100vh' }}><Loading /></div>
            }
          })()
        }

        <style jsx>{`
          .gallery-home {
            min-height: 100vh;
            padding-bottom: 64px;
            box-sizing: border-box;
          }

          .submit-vote-button:active {
            box-shadow: inset 0 1px 1px hsla(199, 81%, 44%, 1);
          }

          .submit-vote-button:active .text {
            transform: translateY(-.5px);
          }

          .submit-button-wrapper {
            margin-top: 32px;

            height: 64px;
            width: 100%;

            display: flex;
            align-items: center;
            align-content: center;
            justify-content: center;
          }

          .submit-button-wrapper .submitted {
            color: #999999;
          }
        `}</style>
      </div>
    </HomeContext.Provider>
  )
}
