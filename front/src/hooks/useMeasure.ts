import { useCallback, useEffect, useRef, useState } from 'react'
import { ResizeObserver } from '@juggle/resize-observer'
import useSafeState from './useSafeState'

// 来自于 @uidotdev/usehooks，不知道为什么直接导入这个模块会报错
export default function useMeasure() {
  const [dimensions, setDimensions] = useSafeState<{
    width: null | number, height: null | number,
  }>({ width: null, height: null })

  const previousObserver = useRef<ResizeObserver | null>(null)

  const customRef = useCallback((node) => {
    if (previousObserver.current) {
      previousObserver.current.disconnect()
      previousObserver.current = null
    }

    if (node?.nodeType === Node.ELEMENT_NODE) {
      const observer = new ResizeObserver(([entry]) => {
        // 原版的程序中会出现“ResizeObserver loop completed with undelivered”的错误
        // 在这里使用了 requestAnimationFrame 来回避这种错误
        // ref: https://stackoverflow.com/questions/76187282/react-resizeobserver-loop-completed-with-undelivered-notifications
        // 因为使用了 requestAnimationFrame，这里是一个异步的操作
        // 在这个异步的情况下可能组件已经 unmount 了，为了避免 unmount 的情况下还 setState，所以要进行一个判断吧
        // 这里使用了 useSafeState，它只会在组件 mount 的情况下才会执行 setState，可回避上述的问题
        requestAnimationFrame(() => {
          if (entry && entry.borderBoxSize) {
            const [{ inlineSize: width, blockSize: height }] = entry.borderBoxSize
            setDimensions({ width, height })
          }
        })
      })

      observer.observe(node)
      previousObserver.current = observer
    }
  }, [setDimensions])

  return [customRef, dimensions] as const
}
