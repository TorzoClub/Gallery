import React, { CSSProperties, HTMLAttributes, StyleHTMLAttributes, useCallback, useEffect, useRef, useState } from 'react'
import s from './index.module.css'

const isDev = process.env.NODE_ENV === 'development'
const PREFIX = isDev ? 'http://10.0.0.5:7001/static/test_pics/' : 'https://pache.blog/test_pics/'
const photos = [
  { src: '1.png', width: 1576, height: 2158 },
  { src: '99-imac_flowershot.jpg', width: 1360, height: 1313 },
  { src: '2.jpg', width: 1263, height: 1684 },
  { src: '3.jpg', width: 1000, height: 998 },
  { src: '4.jpg', width: 550, height: 859 },
  { src: '5.jpg', width: 675, height: 873 },
  { src: '6.jpg', width: 1920, height: 1080 },
  { src: '7.png', width: 1920, height: 1080 },
  { src: '8.png', width: 1920, height: 1080 },
  { src: 'FUCKPROGRAMMING.jpg', width: 240, height: 240 },
  { src: 'ART.jpg', width: 960, height: 1129 },
  { src: '5oQc.gif', width: 636, height: 357 },
  { src: 'METROID.gif', width: 500, height: 460 }
]

const getCenter = (totalLength: number, length: number) => (totalLength / 2) - (length / 2)

type ImageSize = {
  height: number
  width: number
}

const IMAGE_PADDING = 50
const MAX_FRAME_WIDTH = 500
const MAX_FRAME_HEIGHT = 500
const calcImageSize = (
  { width: imgW, height: imgH }: { width: number, height: number },
  GLOBAL = window
): ImageSize => {
  const { innerWidth, innerHeight } = GLOBAL
  const imageProportion = imgH / imgW

  const newImgW = innerWidth
  const newImgH = innerWidth * imageProportion

  // if (newImgH > innerHeight) {
  //   // 缩放的图的高度大于窗口高度
  //   // console.error('>', newImgH, innerHeight)
  //   const height = innerHeight - (IMAGE_PADDING * 2)
  //   const width = height / imageProportion

  //   return {
  //     width,
  //     height,
  //   }
  // } else {
  //   // 缩放的图的高度小于等于窗口高度
  //   // console.error('<=', newImgH, innerHeight)

  //   if (newImgH / innerHeight > 0.80) {
  //     // 图片是否较长，是的话就适当留空白
  //     const width = newImgW - (IMAGE_PADDING * 2)
  //     const height = width * imageProportion
  //     return {
  //       width,
  //       height,
  //     }
  //   } else {
  //     const width = newImgW
  //     const height = width * imageProportion
  //     return {
  //       width,
  //       height,
  //     }
  //   }
  // }

  const width = newImgW > 768 ? 768 : newImgW
  const height = width * imageProportion
  return {
    width,
    height,
  }
}

const inRange = (
  value: number,
  min: number,
  max: number
) => (value >= min) && (value <= max)

type AbsPos = undefined | {
  direction: 'BOTTOM' | 'TOP' | 'NONE'
  height: CSSProperties['height']
  shadowOffset: number
}
export default () => {
  const ImageFrameElements = useRef<HTMLDivElement[]>([])
  const [PosList, setPosList] = useState<AbsPos[]>([])

  const calcPos = useCallback(() => {
    setPosList(() => {
      const eles = ImageFrameElements.current
      return eles.map((ele) => {
        const { scrollY } = window
        const visibleHeight = window.innerHeight
        const scrollYBottom = scrollY + visibleHeight

        const { offsetTop, offsetHeight } = ele
        const offsetTopBottom = offsetTop + offsetHeight

        const overVisibleHeight = offsetHeight > visibleHeight

        if (overVisibleHeight) {
          return {
            direction: 'NONE',
            height: '',
            shadowOffset: 0
          }
        } else if (inRange(scrollYBottom, offsetTop, offsetTopBottom)) {
          const height = scrollYBottom - offsetTop
          return {
            direction: 'TOP',
            height: `${height}px`,
            shadowOffset: 28 - 28 * (height / offsetHeight)
          }
        } else if (inRange(scrollY, offsetTop, offsetTopBottom)) {
          const height = offsetTopBottom - scrollY
          return {
            direction: 'BOTTOM',
            height: `${height}px`,
            shadowOffset: (28 - 28 * (height / offsetHeight)) * -1
          }
        } else {
          return {
            direction: 'NONE',
            height: '',
            shadowOffset: 0
          }
        }
      })
    })
  }, [])

  useEffect(() => {
    calcPos()
    window.addEventListener('resize', calcPos)
    window.addEventListener('scroll', calcPos)
    return () => {
      window.removeEventListener('resize', calcPos)
      window.removeEventListener('scroll', calcPos)
    }
  }, [calcPos])

  const calcImageInnerStyle = useCallback<(idx: number) => CSSProperties>((idx) => {
    const pos = PosList[idx]
    if (!pos) {
      return {}
    } else {
      const { direction, height } = pos
      if (direction === 'BOTTOM') {
        return { height, position: 'absolute', left: 0, bottom: 0 }
      } else if (direction === 'TOP') {
        return { height, position: 'absolute', left: 0, top: 0 }
      } else {
        return { height }
      }
    }
  }, [PosList])

  const insetShadow = useCallback((index: number) => {
    const offset = PosList[index]?.shadowOffset ?? 0
    return `inset 0 ${offset}px 28px 0px rgba(0, 0, 0, 0.3)`
  }, [PosList])

  return (
    <div className={s.CoverScroller}>
      {photos.map((photo, index) => (
        <div key={photo.src} className={s.PhotoFrame}>
          <div
            key={photo.src}
            className={s.ImgFrameWrapper}
            style={{...calcImageSize(photo)}}
            ref={el => {
              if (el) {
                ImageFrameElements.current[index] = el
              }
            }}
          >
            <div
              className={`${s.ImgFrame}`}
              style={{
                backgroundImage: `url(${PREFIX}${photo.src})`,
                ...calcImageInnerStyle(index)
              }}
            ></div>
            <div className={s.insetShadow} style={{
              boxShadow: insetShadow(index)
            }}></div>
          </div>
          <div>{photo.src}</div>
        </div>
      ))}
    </div>
  )
}
