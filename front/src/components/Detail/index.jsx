import React, { useEffect, useState } from 'react'

import './style.scss'

const getCenter = (totalLength, length) => (totalLength / 2) - (length / 2)

const IMAGE_PADDING = 50
const calcImageFullScreenPos = ({ width: imgW, height: imgH }, GLOBAL = window) => {
  const { innerWidth, innerHeight } = GLOBAL
  const imageProportion = imgH / imgW

  const newImgW = innerWidth
  const newImgH = innerWidth * imageProportion

  if (newImgH > innerHeight) {
    // 缩放的图的高度大于窗口高度
    console.error('>', newImgH, innerHeight)
    const height = innerHeight - (IMAGE_PADDING * 2)
    const width = height / imageProportion

    return {
      top: IMAGE_PADDING,
      left: getCenter(innerWidth, width),
      width,
      height
    }
  } else {
    // 缩放的图的高度小于等于窗口高度
    console.error('<=', newImgH, innerHeight)
    

    if (newImgH / innerHeight > 0.75) {
      // 图片是否较长，是的话就适当留空白
      const width = newImgW - (IMAGE_PADDING * 2)
      const height = width * imageProportion
      return {
        top: getCenter(innerHeight, height),
        left: IMAGE_PADDING,
        width,
        height,
      }
    } else {
      const width = newImgW
      const height = width * imageProportion
      return {
        top: getCenter(innerHeight, height),
        left: 0,
        width,
        height,
      }
    }
  }
}

export default ({
  detail,
  onCancel = () => undefined
}) => {
  const [opacity, setOpacity] = useState(0);

  const [sourceUrl, setSourceUrl] = useState('')
  const [thumbUrl, setThumbUrl] = useState('')
  const [fromPos, setFromPos] = useState(null)
  const [toPos, setToPos] = useState(null)
  const [imageFrameTransition, setImageFrameTransition] = useState(false)

  useEffect(() => {
    if (detail) {
      setOpacity(1)

      setThumbUrl(detail.from.thumb)
      setSourceUrl(detail.src)

      const { top, left, width, height } = detail.from
      setFromPos({
        top,
        left,
        width,
        height,
      })

      return () => {
        setOpacity(0)
      }
    } else {
      setToPos(null)
      setThumbUrl('')
      setSourceUrl('')
      setFromPos(null)
      setToPos(null)
      setImageFrameTransition(false)
    }
  }, [detail])

  useEffect(() => {
    if (!fromPos) {
      return
    }

    setTimeout(() => {
      setImageFrameTransition(true)
      setToPos({
        ...calcImageFullScreenPos({
          width: detail.width,
          height: detail.height
        })
      })
    }, 100)

    return () => {}
  }, [fromPos])

  useEffect(() => {
    const resizeHandle = () => {
      console.log('resizeHandle', fromPos)
      if (!fromPos) {
        return
      }

      console.error('dd', window.innerWidth, window.innerHeight)

      setToPos({
        ...calcImageFullScreenPos({
          width: detail.width,
          height: detail.height
        })
      })
    }
    window.addEventListener('resize', resizeHandle)

    return () => {
      window.removeEventListener('resize', resizeHandle)
    }
  }, [fromPos])

  const handleClickFrame = (e) => {
    onCancel()
  }

  if (!detail) {
    return null
  }

  const pos = toPos || fromPos || {}

  return (
    <div
      className="detail-frame"
      style={{ opacity }}
      onClick={handleClickFrame}
    >
      <div
        className={`imageFrame ${imageFrameTransition ? 'transition' : ''}`}
        style={{ ...pos }}
      >
        <img className="thumb" src={thumbUrl} alt="" />
        <img className="source" src={sourceUrl} alt="" />
      </div>
    </div>
  )
}
