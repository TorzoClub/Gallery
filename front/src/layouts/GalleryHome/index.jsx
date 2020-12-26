import React, { useState, useEffect } from 'react'

import vait from 'vait'

import { confirmQQNum } from 'api/member'
import { fetchList, fetchListWithQQNum, vote } from 'api/photo'

import Loading from 'components/Loading'

import Gallery from 'components/Gallery'

// import BgImageUrl from 'assets/bg.png'

import HomeContext from './context'

import Fade from 'components/Fade'
import ConfirmQQ from 'components/ConfirmQQ'

import PhotoDetail from 'components/Detail'
import SubmitButton from 'components/SubmitButton'

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
  const [submiting, setSubmiting] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [list, setList] = useState([])
  const [submittedPool, setSubmittedPool] = useState({})

  const [showDetail, setShowDetail] = useState(false)
  const [detailImageUrl, setDetailImageUrl] = useState('')
  const [currentQQNum, setCurrentQQNum] = useState(0)
  const [confirmState, setConfirmState] = useStateObject({
    in: false,
    isDone: false,
    isLoading: false,
    isFailure: null,
    disableInput: false
  })

  useEffect(() => {
    fetchList().then(list => {
      setList(list)
      setLoaded(true)

      const inActivityTiming = !list.every(item => item.is_expired)
      if (!inActivityTiming) {
        // 没活动？那没事了
        return
      }

      if (!currentQQNum) {
        // 没扣号的话就来个弹窗
        setConfirmState({ in: true })
      } else {
        // 有的话就用这个扣号获取已投的照片列表
        setConfirmState({ isLoading: true })
        fetchListWithQQNum(Number(currentQQNum)).then(list => {
          setList(list)
          setConfirmState({ in: false })
        }).catch(err => {
          alert(`获取投票信息失败: ${err.message}`)
        })
      }
    }).catch(err => {
      alert(`获取相册信息失败: ${err.message}`)
    })
  }, [currentQQNum])

  const ConfirmQQLayout = (
    <ConfirmQQ
      {...confirmState}
      handleInputChange={() => {
        setConfirmState({
          isFailure: null
        })
      }}
      handlesubmitDetect={async qq_num => {
        try {
          setConfirmState({ isLoading: true })

          const [exist] = await Promise.all([confirmQQNum(qq_num), vait.timeout(1500)])

          if (exist) {
            setConfirmState({
              isLoading: false,
              isDone: true
            })
            vait.timeout(500).then(() => {
              setCurrentQQNum(qq_num)
            })
          } else {
            setConfirmState({
              isLoading: false,
              isFailure: new Error('朋友，你这个Q号不对，再看看？')
            })
          }
        } catch (err) {
          console.error('handlesubmitDetect error', err)
          setConfirmState({ isLoading: false, isFailure: err })
        }
      }}
    />
  )

  const handleClickSubmit = async () => {
    try {
      setSubmiting(true)

      if (!currentQQNum) {
        // 未缓存 Q 号
        return setConfirmState({
          in: true,
          isLoading: false,
          isFailure: false
        })
      } else {
        await vote({
          gallery_id: selectedGalleryId,
          photo_id_list: selectedIdList,
          qq_num: Number(currentQQNum)
        })

        setSubmittedPool({
          submittedPool,
          [selectedGalleryId]: true
        })
      }
    } catch (err) {
      if (err.status === 403 && /已过投票截止时间/.test(err.message)) {
        alert('已经过了投票时间了，朋友，下一年一定支持')
        return
      }

      console.error(err.message)
      alert(err.message)
    } finally {
      setSubmiting(false)
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
          !loaded ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                minHeight: '100vh'
              }}
            >
              <Loading />


            </div>
          ) : (
            <div className="body">
              {
                list.map(gallery => {
                  const showSubmitButton = !gallery.vote_submitted
                  let isSubmitted = submittedPool[gallery.id]
                  // isSubmitted = true

                  let buttonMode = ''

                  if (isSubmitted) {
                    buttonMode = 'done'
                  } else if (confirmState.in) {
                    buttonMode = 'blue'
                  } else if (selectedIdList.length) {
                    buttonMode = 'blue ring'
                  }

                  return (
                    <div className="gallery-wrapper" key={gallery.id}>
                      <Gallery gallery={gallery} />

                      {
                        !gallery.is_expired && showSubmitButton &&
                        <div className="submit-button-wrapper">
                          {(() => {
                            if (submiting) {
                              return <Loading />
                            } else if (isSubmitted) {
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

                                  if (submiting) {
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
                  )
                })
              }

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
          )
        }

        {ConfirmQQLayout}

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