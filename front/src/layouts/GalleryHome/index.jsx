import React, { Component } from 'react'
import { observer } from 'mobx-react'
// import store from 'store'
import Loading from 'components/Loading'
import { fetchList, fetchListWithQQNum, vote } from 'api/photo'

import Gallery from 'components/Gallery'

// import BgImageUrl from 'assets/bg.png'

import HomeContext from './context'

import { validQQNum, getMyQQNum, setMyQQNum } from 'utils/qq-num'

@observer
class GalleryHome extends Component {
  state = {
    loaded: false,

    list: []
  }

  constructor(props) {
    super(props)

    this.managerRef = React.createRef()
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
      console.error('加载错误', err)
      alert(`加载错误: ${err.message}`)
      this.setState({ loaded: false })
    }
  }

  componentDidMount() {
    this.refresh()
  }

  handleVotePhoto = async photo => {
    console.warn('handleVotePhoto', photo)

    let qq_num = getMyQQNum()

    if (!qq_num) {
      // 未缓存 Q 号
      let receiveQQ = prompt('请输入你的 Q 号')

      if (receiveQQ === null) {
        return
      }

      if (receiveQQ === '') {
        alert('你别鄙视人了👎')
        return
      }

      receiveQQ = Number(receiveQQ)
      if (!validQQNum(receiveQQ)) {
        if (!this.errorCount) {
          this.errorCount = 1
        } else {
          ++this.errorCount
        }

        if (this.errorCount >= 4) {
          alert('朋友，这个输入 Q 号的地方 Vec 调了很久了，你怎么搞都不会搞出问题的，别试了')
        } else {
          alert('朋友，我先善意地理解你只是测 bug 好了，你要输入格式正确的 QQ 号')
        }

        return this.handleVotePhoto(photo)
      }

      qq_num = receiveQQ
    }

    try {
      await vote({
        gallery_id: photo.gallery_id,
        photo_id: photo.id,
        qq_num
      })

      photo.is_voted = true

      if (getMyQQNum()) {
        this.setState({
          list: [...this.state.list]
        })
      } else {
        // 首次输入 Q 号进入

        setMyQQNum(qq_num)
        this.refresh()
      }


    } catch(err) {
      console.error('vote error', err)
      if (err.status === 409) {
        // 已经投过票了
        photo.is_voted = true

        if (getMyQQNum()) {
          this.setState({
            list: [...this.state.list]
          })
        } else {
          // 首次输入 Q 号进入

          setMyQQNum(qq_num)
          this.refresh()
        }

        return
      }

      if (err.status === 403 && /票数/.test(err.message)) {
        alert('你已经没票了，朋友，明年再来吧')
        return
      }

      if (err.status === 404 && /成员/.test(err.message)) {
        alert('朋友，你提供的这个 Q 号是不存在的，检查一下你有没有输错，如果你是故意的话……那就再输入一次，我是没有感情的程序，不会鄙视你的')
        return this.handleVotePhoto(photo)
      }
    }
  }

  render() {
    console.log('render', this.state.list, this.state.list.map)
    // const { firstLoaded, firstLoading, firstLoadingError } = this.state

    return <HomeContext.Provider value={{
      handleVotePhoto: this.handleVotePhoto
    }}>
      <div className={ `gallery-home` }>
        {
          (() => {
            if (this.state.loaded) {
              return <div className="body">
                {
                  this.state.list.map(gallery => {
                    return <Gallery
                      key={ gallery.id }
                      gallery={ gallery }
                    />
                  })
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
          }
        `}</style>
      </div>
    </HomeContext.Provider>
  }
}

export default GalleryHome
