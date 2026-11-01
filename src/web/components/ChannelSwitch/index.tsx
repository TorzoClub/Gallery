import React, { useEffect, useRef } from 'react'

import styles from './index.module.scss'

const MOSAIC_COLORS = ['#ff236f', '#1ff5ff', '#ffe600', '#39ff74', '#7b4dff', '#ff7a00']

export default function ChannelSwitch({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  const noiseCanvasRef = useRef<HTMLCanvasElement>(null)
  const mosaicCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const noiseCanvas = noiseCanvasRef.current
    const mosaicCanvas = mosaicCanvasRef.current
    const noiseContext = noiseCanvas?.getContext('2d')
    const mosaicContext = mosaicCanvas?.getContext('2d')
    if (noiseCanvas === null || mosaicCanvas === null || !noiseContext || !mosaicContext) {
      return
    }

    const width = 180
    const height = 110
    noiseCanvas.width = width
    noiseCanvas.height = height
    mosaicCanvas.width = width
    mosaicCanvas.height = height

    let frame = 0
    let lastDraw = 0
    const draw = (time: number) => {
      if (time - lastDraw >= 55) {
        lastDraw = time

        const image = noiseContext.createImageData(width, height)
        for (let index = 0; index < image.data.length; index += 4) {
          const value = Math.random() * 255
          image.data[index] = value
          image.data[index + 1] = value
          image.data[index + 2] = value
          image.data[index + 3] = 255
        }
        noiseContext.putImageData(image, 0, 0)

        mosaicContext.clearRect(0, 0, width, height)
        for (let index = 0; index < 32; index += 1) {
          mosaicContext.fillStyle = MOSAIC_COLORS[Math.floor(Math.random() * MOSAIC_COLORS.length)] ?? '#fff'
          mosaicContext.globalAlpha = 0.55 + Math.random() * 0.45
          mosaicContext.fillRect(
            Math.random() * width,
            Math.random() * height,
            2 + Math.random() * 16,
            1 + Math.random() * 7,
          )
        }
        mosaicContext.globalAlpha = 1
      }

      frame = window.requestAnimationFrame(draw)
    }

    frame = window.requestAnimationFrame(draw)
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (doneRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      if (doneRef.current) {
        return
      }
      doneRef.current = true
      onDoneRef.current()
    }, 900)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div className={styles.overlay} aria-hidden="true">
      <div className={styles.screen} />
      <canvas ref={noiseCanvasRef} className={styles.noiseCanvas} />
      <canvas ref={mosaicCanvasRef} className={styles.mosaicCanvas} />
      <div className={styles.scanlines} />
      <div className={styles.noise} />
      <div className={styles.roll} />
      <div className={styles.flash} />
    </div>
  )
}
