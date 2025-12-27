import { nextTick, timeout } from 'new-vait'
import React, { useRef, useEffect, useState } from 'react'
import useDisableScroll from 'hooks/useDisableScroll'

import './style.scss'
import Loading from 'components/Loading'
import useMountState from 'hooks/useMountState'

const getCenter = (totalLength: number, length: number) => (totalLength / 2) - (length / 2)

type OptProperties<T> = {
  [K in keyof T]?: T[K]
}

type ImagePos = {
  height: number
  width: number
  left: number
  top: number
}
type TouchPos = { x: number; y: number}

const calcTouchDragPos = (touchStart: TouchPos, touchMove: TouchPos): TouchPos => {
  const x = 0
  let y = touchMove.y - touchStart.y

  const totalLength = window.innerHeight - (touchMove.y)
  let b = y / totalLength

  if (b > 1) {
    console.log('滑动到极限了')
    b = 1
  }

  y = b * 100

  return { x, y }
}

const IMAGE_PADDING = 50
const calcImageFullScreenPos = (
  { width: imgW, height: imgH }: { width: number, height: number },
  GLOBAL = window
): ImagePos => {
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
      height,
    }
  } else {
    // 缩放的图的高度小于等于窗口高度
    console.error('<=', newImgH, innerHeight)

    if (newImgH / innerHeight > 0.80) {
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

function usePictureLoading(source_url: string) {
  const [is_loading, setLoading] = useState(false)
  useEffect(() => {
    if (source_url.length) {
      setLoading(true)
    } else {
      setLoading(false)
    }
  }, [source_url.length])

  return [
    is_loading,
    function onLoad() {
      setLoading(false)
    }
  ] as const
}

export type Detail = {
  from: ImagePos
  thumb: string
  src: string
  height: number
  width: number
} | null
export default ({ detail, onCancel = () => undefined }: {
  detail: Detail
  onCancel: () => void
}) => {
  const isMounted = useMountState()
  const [isShow, setIsShow] = useState(false)
  const detailFrameEl = useRef<HTMLDivElement | null>(null)
  const imageFrameEl = useRef<HTMLDivElement | null>(null)

  const [opacity, setOpacity] = useState(0)
  const [sourceUrl, setSourceUrl] = useState('')
  const [thumbUrl, setThumbUrl] = useState('')
  const [fromPos, setFromPos] = useState<ImagePos | null>(null)
  const [toPos, setToPos] = useState<ImagePos | null>(null)
  const [imageFrameTransition, setImageFrameTransition] = useState(true)

  const [touchStart, setTouchStart] = useState<TouchPos | null>(null)
  const [touchMove, setTouchMove] = useState<TouchPos | null>(null)

  useEffect(() => {
    if (detail) {
      setImageFrameTransition(true)
      setThumbUrl(detail.thumb)
      setSourceUrl(detail.src)
      const { top, left, width, height } = detail.from
      setFromPos({
        top,
        left,
        width,
        height,
      })
      setIsShow(true)
    } else {
      setImageFrameTransition(true)
      setToPos(null)
      setTouchMove(null)
      setTouchStart(null)
      setOpacity(0)

      timeout(382).then(() => {
        if (isMounted()) {
          setThumbUrl('')
          setSourceUrl('')
          setFromPos(null)
          setToPos(null)
          setImageFrameTransition(false)
          return timeout(382)
        }
      }).then(() => {
        if (isMounted()) {
          setIsShow(false)
        }
      })
    }
  }, [detail, isMounted])

  useEffect(() => {
    if (isShow && fromPos && detail && imageFrameTransition) {
      window.requestAnimationFrame(() => {
        nextTick().then(() => {
          if (isMounted()) {
            setOpacity(1)
            setToPos({
              ...calcImageFullScreenPos({
                width: detail.width,
                height: detail.height,
              }),
            })

            timeout(382).then(() => {
              if (isMounted()) {
                setImageFrameTransition(false)
              }
            })
          }
        })
      })

      return () => {
        if (isMounted()) {
          setImageFrameTransition(false)
        }
      }
    }
  }, [isShow, detail, fromPos, imageFrameTransition, isMounted])

  useEffect(() => {
    const resizeHandle = () => {
      // console.log('resizeHandle', fromPos)
      if (!fromPos) {
        return
      }

      setImageFrameTransition(true)
      if (detail) {
        setToPos({
          ...calcImageFullScreenPos({
            width: detail.width,
            height: detail.height,
          }),
        })
      }
    }
    window.addEventListener('resize', resizeHandle)

    return () => {
      window.removeEventListener('resize', resizeHandle)
    }
  }, [detail, fromPos])

  useEffect(() => {
    const touchStartHandler: HTMLDivElement['ontouchstart'] = (e) => {
      const { touches } = e
      if (touches.length !== 1) {
        // 不是单指操作的情况
        return
      }

      e.stopPropagation()
      e.preventDefault()

      const touch = touches[0]

      setTouchStart({
        x: touch.clientX,
        y: touch.clientY,
      })
    }
    const touchMoveHandler: HTMLDivElement['ontouchmove'] = (e) => {
      const { touches } = e
      if (touches.length !== 1) {
        // 不是单指操作的情况
        return
      }

      e.stopPropagation()
      e.preventDefault()

      const { clientX, clientY } = touches[0]
      const willWrite = touchMove ? { ...touchMove } : { x: 0, y: 0 }
      if ((clientX >= 0) && (clientX < window.innerWidth)) {
        willWrite.x = clientX
      }
      if ((clientY >= 0) && (clientY < window.innerHeight)) {
        willWrite.y = clientY
      }
      setTouchMove(willWrite)
    }

    const touchEndHandler: HTMLDivElement['ontouchend'] = (e) => {
      const { changedTouches: touches } = e
      if (touches.length !== 1) {
        // 不是单指操作的情况
        return
      }

      e.stopPropagation()
      e.preventDefault()

      const touch = touches[0]

      if (!touchStart) {
        return
      }

      const diffY = touch.clientY - touchStart.y

      if (diffY > 100) {
        onCancel()
      } else if (!touchMove) {
        // 触屏点击的情况
        onCancel()
      } else {
        setImageFrameTransition(true)
        setTouchStart(null)
        setTouchMove(null)
        timeout(382).then(() => {
          if (isMounted()) {
            setImageFrameTransition(false)
          }
        })
      }
    }

    if (imageFrameEl.current) {
      const { current: el } = imageFrameEl

      el.addEventListener('touchstart', touchStartHandler)
      el.addEventListener('touchmove', touchMoveHandler)
      el.addEventListener('touchend', touchEndHandler)
      return () => {
        el.removeEventListener('touchstart', touchStartHandler)
        el.removeEventListener('touchmove', touchMoveHandler)
        el.removeEventListener('touchend', touchEndHandler)
      }
    }
    // isShow 控制着 imageFrameEl.current
    // 也就是说 isShow = true 的时候 imageFrameEl.current 才不至于是 null
  }, [isShow, onCancel, touchStart, touchMove, isMounted])

  useEffect(() => {
    if (detailFrameEl.current) {
      const { current: el } = detailFrameEl
      const touchMoveHandler: HTMLDivElement['ontouchmove'] = (e) => {
        if (detail) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
      el.addEventListener('touchmove', touchMoveHandler)

      return () => {
        el.removeEventListener('touchmove', touchMoveHandler)
      }
    }
    // isShow 控制着 detailFrameEl.current
    // 也就是说 isShow = true 的时候 detailFrameEl.current 才不至于是 null
  }, [isShow, detail])

  useDisableScroll(Boolean(detail))

  const [ is_loading, onLoad ] = usePictureLoading(sourceUrl)

  if (!isShow) {
    return null
  }

  const pos: OptProperties<ImagePos & { transform: string }> = {
    ...(toPos || fromPos || {})
  }
  if (touchStart && touchMove) {
    const dPos = calcTouchDragPos(touchStart, touchMove)
    pos.transform = `translate(${dPos.x}px, ${dPos.y}px)`
  }

  return (
    <div
      ref={detailFrameEl}
      className="detail-frame"
      onClick={onCancel}
    >
      <div className="bgMask" style={{ opacity }}></div>
      <div
        ref={imageFrameEl}
        className={`imageFrame ${imageFrameTransition ? 'transition' : ''}`}
        style={{ ...pos, opacity: toPos ? 1 : 0 }}
      >
        <img className="thumb" src={thumbUrl} alt="" />
        <img className="source" src={sourceUrl} alt="" onLoad={onLoad} />
        { is_loading ? <div className='imgLoading'><Loading /> <span style={{ marginLeft: '4px' }}>加载中</span></div> : '' }
      </div>
    </div>
  )
}
