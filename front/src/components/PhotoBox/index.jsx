import React from 'react'

import Loading from 'components/Loading'

import style from './index.scss'

import heartIMG from 'assets/heart.png'
import heartHighlightIMG from 'assets/heart-highlight.png'

import HomeContext from 'layouts/GalleryHome/context'

class ImageBox extends React.Component {
  static contextType = HomeContext;

  constructor(props) {
    super(props)
    this.state = {
      loaded: false,
      downloading: false
    }
  }

  loadImage() {
    this.setState({
      downloading: true
    })
    const xhr = new XMLHttpRequest()
    xhr.onprogress = e => {
      // const percent = parseFloat((e.loaded / e.total).toFixed(2))
    }
    xhr.onload = e => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200 || xhr.status === 304) {
          // const blobObject = new Blob([xhr.response], { type: xhr.getResponseHeader('content-type') })
          this.interval = Date.now() - this.start_time
          this.props.toDetail && this.props.toDetail({
            ...this.props,
            imageData: xhr.response
          })
        }
      }
    }
    xhr.onerror = e => {
      console.error(e, xhr)
    }
    xhr.onloadend = e => {
      this.setState({
        downloading: false
      })
    }
    xhr.onloadstart = e => {
      this.start_time = Date.now()
    }
    xhr.open('GET', this.props.url)
    xhr.responseType = 'blob'
    xhr.send()
  }

  handleClick = e => {
    this.loadImage()
  }

  handleClickVote = (e, photo) => {
    e.preventDefault()
    e.stopPropagation()

    this.context.handleVotePhoto(photo)
  }

  handleImageLoaded = e => {
    this.setState({ loaded: true })
  }

  render() {
    const { props, state } = this
    const { photo } = props
    const { member } = photo

    const ratio = (props.height / props.width).toFixed(4)
    const height = `calc((${props.boxWidth} - ${style['avatar-size']} / 2) * ${ ratio })`
    console.info('height', height)

    const coverFrameStyle = {
      height,
      background: state.loaded ? 'white': ''
    }

    const isHighlight = photo.is_voted

    return (
      <div className="image-box-wrapper">
        <div className="image-box" onClick={ this.handleClick }>
          <div className="cover-frame" style={ coverFrameStyle }>
            {
              state.downloading && <div className="box-loading-frame">
                <Loading
                  style={ {
                    opacity: Number(state.downloading)
                  } }
                />
              </div>
            }
            <img
              className="cover"
              alt="img"
              src={photo.thumb}
              style={{ opacity: state.loaded ? 100 : 0 }}
              onLoad={this.handleImageLoaded}
            />

            {/* <div className="highlight"></div> */}
          </div>
          <div className="bottom-area">
            <div className="back-bottom">
              <div className="block-wrapper" onClick={ e => this.handleClickVote(e, photo) }>
                {
                  isHighlight ?
                  <div className="block highlight">
                    <div className="heart" style={{ backgroundImage: `url(${heartHighlightIMG})` }} />
                  </div>
                  :
                  <div className="block">
                    <div className="heart" style={{ backgroundImage: `url(${heartIMG})` }} />
                  </div>
                }
              </div>
            </div>

            <div className="bottom-block">
              <div className="avatar-wrapper">
                <div className="avatar" alt={ member.name } style={{ backgroundImage: `url(${member.avatar_thumb})` }}></div>
              </div>

              <div className="member-name"><div className="avatar-float"></div>{ member.name }</div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default ImageBox
