import React, { Component } from 'react'
import { observer } from 'mobx-react'
import vait from 'vait'
// import store from 'store'
import Loading from 'components/Loading'
import { fetchList, fetchListWithQQNum, vote } from 'api/photo'

import Gallery from 'components/Gallery'

// import BgImageUrl from 'assets/bg.png'

import HomeContext from './context'

import { getMyQQNum, setMyQQNum } from 'utils/qq-num'

import Fade from 'components/Fade'
import InputPrompt from 'components/InputPrompt'

import PhotoDetail from 'components/Detail'
import SubmitButton from 'components/SubmitButton'

@observer
class GalleryHome extends Component {
  state = {
    loaded: false,
    loading: false,

    selectedGalleryId: null,
    selectedIdList: [],
    list: [],

    submittedPool: {},

    showInputPrompt: false,
    submitSuccess: false,
    submitLoading: false,
    submitError: null,
    disableInput: false,

    showDetail: false,
    detailImageUrl: 'http://localhost:7001/static/src/1575647894663.png'
  }

  constructor(props) {
    super(props)

    this.managerRef = React.createRef()
  }

  detectSubmit = async qq_num => {
    try {
      this.setState({
        submitLoading: true,
        disableInput: true,
      })

      await vait.timeout(500)

      const { selectedGalleryId: gallery_id, selectedIdList: photo_id_list } = this.state.showInputPrompt

      await vote({
        gallery_id,
        photo_id_list,
        qq_num: Number(qq_num)
      })

      setMyQQNum(Number(qq_num))

      this.setState({
        submittedPool: {
          ...this.state.submittedPool,
          [gallery_id]: true
        },

        submitSuccess: true
      })

      setTimeout(() => {
        this.setState({
          showInputPrompt: false
        })
      }, 1000)
    } catch (err) {
      if (err.status === 409) {
        // 已经投过票了

        if (!getMyQQNum()) {
          // 首次输入 Q 号进入
          setMyQQNum(Number(qq_num))
        }

        try {
          await this.refresh()
        } finally {
          this.setState({
            showInputPrompt: false
          })
        }

        return
      }

      console.error('vote error', err)

      if (err.status === 403 && /Ʊ��/.test(err.message)) {
        alert('你已经没票了，朋友，明年再来吧')
        return
      }

      this.setState({
        submitError: err
      })
    } finally {
      this.setState({
        submitLoading: false,
        disableInput: false,
      })
    }
  }

  fetchList() {
    const qq_num = getMyQQNum()

    if (qq_num) {
      return fetchListWithQQNum(qq_num)
    } else {
      return fetchList()
    }
  }

  refresh = async () => {
    console.warn('refresh')
    try {
      // this.setState({ loaded: false })
      const list = await this.fetchList()
      console.warn('list', list)
      this.setState({ loaded: true, list })
    } catch (err) {
      console.error('获取相册数据失败', err)
      alert(`获取相册数据失败: ${err.message}`)
      this.setState({ loaded: false })
    }
  }

  componentDidMount() {
    this.refresh()
  }

  handleClickSubmit = async () => {
    const { selectedGalleryId, selectedIdList } = this.state

    try {
      this.setState({
        loading: true
      })

      let qq_num = getMyQQNum()

      if (!qq_num) {
        // 未缓存 Q 号
        this.setState({
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

        this.setState({
          submittedPool: {
            ...this.state.submittedPool,
            [selectedGalleryId]: true
          }
        })
      }
    } catch (err) {
      console.error(err.message)
      alert(err.message)
    } finally {
      this.setState({
        loading: false
      })
    }
  }

  handleClickVote = async (gallery, photo) => {
    console.warn('handleClickVote', gallery.vote_submitted, photo)

    const isSubmitted = this.state.submittedPool[gallery.id]

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
    let { selectedGalleryId, selectedIdList } = this.state
    selectedIdList = [...selectedIdList]

    if (selectedGalleryId && (gallery_id !== selectedGalleryId)) {
      return alert('different gallery_id')
    } else {
      selectedGalleryId = gallery_id
    }

    const idx = selectedIdList.indexOf(id)

    if (idx === -1) {
      if (gallery.vote_limit && (selectedIdList.length >= gallery.vote_limit)) {
        // alert('enough')
        return
      } else {
        selectedIdList.push(id)
      }
    } else {
      selectedIdList.splice(idx, 1)
    }

    this.setState({
      selectedGalleryId,
      selectedIdList
    })
  }

  handleToDetail = ({ imageUrl: detailImageUrl }) => {
    console.warn('detailImageUrl', detailImageUrl)
    this.setState({
      showDetail: true,
      detailImageUrl
    })
  }

  render() {
    const { showDetail, detailImageUrl, selectedIdList, loading } = this.state

    console.log('render', this.state.list, this.state.list.map)
    // const { firstLoaded, firstLoading, firstLoadingError } = this.state

    return <HomeContext.Provider value={{
      selectedGalleryId: this.state.selectedGalleryId,
      selectedIdList,
      handleClickVote: this.handleClickVote,
      toDetail: this.handleToDetail
    }}>
      <div className={ `gallery-home` }>
        {
          (() => {
            if (this.state.loaded) {
              return <div className="body">
                {
                  this.state.list.map(gallery => {
                    const showSubmitButton = !gallery.vote_submitted
                    let isSubmitted = this.state.submittedPool[gallery.id]
                    // isSubmitted = true

                    let buttonMode = ''

                    if (isSubmitted) {
                      buttonMode = 'done'
                    } else if (this.state.showInputPrompt) {
                      buttonMode = 'blue'
                    } else if (this.state.selectedIdList.length) {
                      buttonMode = 'blue ring'
                    }

                    return <div className="gallery-wrapper" key={ gallery.id }>
                      <Gallery gallery={ gallery } />

                      {
                        !gallery.is_expired && showSubmitButton &&
                        <div className="submit-button-wrapper">
                          {(() => {
                            if (isSubmitted) {
                              return <div className="submitted">感谢你的投票</div>
                            } else {
                              return <SubmitButton
                                mode={ buttonMode }
                                clickButton={ e => {
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

                                  return this.handleClickSubmit(e)
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
                  in={ this.state.showInputPrompt }
                  isDone={ this.state.submitSuccess }
                  isLoading={ this.state.submitLoading }
                  isFailure={ this.state.submitError }
                  disabled={ this.state.disableInput }
                  handleInputChange={ () => {
                    this.setState({
                      submitError: null
                    })
                  } }
                  handlesubmitDetect={ this.detectSubmit }
                />

                {
                  <Fade in={ showDetail }>
                    <PhotoDetail imageUrl={ detailImageUrl } onCancel={ () => this.setState({ showDetail: false }) } />
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
  }
}

export default GalleryHome
