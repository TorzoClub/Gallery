import { useCallback, useRef, useState } from 'react'

// 来自于 @uidotdev/usehooks，直接导入这个模块不知道为什么会报错
export default function useMeasure() {
  const [dimensions, setDimensions] = useState<{
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
  }, [])

  return [customRef, dimensions] as const
}
