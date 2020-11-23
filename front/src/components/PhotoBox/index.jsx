import vait from 'vait'
import React, { useState, useContext } from 'react'

import Loading from 'components/Loading'

import style from './index.scss'

import heartIMG from 'assets/heart.png'
import heartHighlightIMG from 'assets/heart-highlight.png'

import HomeContext from 'layouts/GalleryHome/context'

const loadImage = (url) => {
  const v = vait()

  const xhr = new XMLHttpRequest()
  xhr.onprogress = e => {
    // const percent = parseFloat((e.loaded / e.total).toFixed(2))
  }
  xhr.onload = e => {
    if (xhr.readyState === 4) {
      if (xhr.status === 200 || xhr.status === 304) {
        // const blobObject = new Blob([xhr.response], { type: xhr.getResponseHeader('content-type') })
        v.pass(xhr.response)
      }
    }
  }
  xhr.onerror = e => {
    console.error(e, xhr)
    v.fail(e)
  }
  xhr.onloadend = e => {
  }
  xhr.onloadstart = e => {
  }
  xhr.open('GET', url)
  xhr.responseType = 'blob'
  xhr.send()

  return v
}

export default (props) => {
  const context = useContext(HomeContext)
  const [loaded, setLoaded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const { screen, gutter, gallery, photo } = props
  const { member } = photo

  const ratio = (props.height / props.width).toFixed(4)

  const isMobile = screen === 'mobile'

  let height
  if (isMobile) {
    height = `calc((${props.boxWidth} - ${gutter} / 2) * ${ratio})`
  } else {
    height = `calc((${props.boxWidth} - ${style['avatar-size']} / 2) * ${ratio})`
  }
  console.info('height', height)

  const coverFrameStyle = {
    height,
    background: loaded ? 'white' : ''
  }

  const { selectedGalleryId, selectedIdList } = context
  const isChoosed = (selectedGalleryId === photo.gallery_id) && (selectedIdList.indexOf(photo.id) !== -1)
  const isHighlight = gallery.vote_submitted ? photo.is_voted : isChoosed

  return (
    <div className={`image-box-wrapper ${screen}`}>
      <div className="image-box">
        <div className="cover-frame" style={coverFrameStyle} onClick={async () => {
          try {
            setDownloading(true)

            const res = await loadImage(photo.src)

            context.toDetail && context.toDetail({
              imageUrl: URL.createObjectURL(res)
            })
          } finally {
            setDownloading(false)
          }
        }}>
          {
            downloading && <div className="box-loading-frame">
              <Loading style={{ opacity: Number(downloading) }} />
            </div>
          }
          <img
            className="cover"
            alt="img"
            src={photo.thumb}
            style={{ opacity: loaded ? 100 : 0 }}
            onLoad={() => {
              setLoaded(true)
            }}
          />

          {/* <div className="highlight"></div> */}
        </div>
        <div className="bottom-area">
          <div className="bottom-block">
            <div className="avatar-wrapper">
              <div className="avatar" alt={member.name} style={{ backgroundImage: `url(${member.avatar_thumb})` }}></div>
            </div>

            <div className="member-name"><div className="avatar-float"></div><span className="name-label">{member.name}</span></div>
          </div>

          {
            gallery.is_expired || (
              <div className="back-bottom-wrapper">
                <div className="back-bottom">
                  <div className="block-wrapper" onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()

                    context.handleClickVote(gallery, photo)
                  }}>
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
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}
