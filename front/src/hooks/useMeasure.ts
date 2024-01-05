import { useCallback, useEffect, useRef, useState } from 'react'
import { ResizeObserver } from '@juggle/resize-observer'
import useSafeState from './useSafeState'

type Dim = Record<'width' | 'height', null | number>

// 来自于 @uidotdev/usehooks，不知道为什么直接导入这个模块会报错
export default function useMeasure(onchange?: (d: Dim) => void) {
  const [dimensions, setDimensions] = useSafeState<Dim>({ width: null, height: null })

  const previousObserver = useRef<ResizeObserver | null>(null)

  const customRef = useCallback((node) => {
    if (previousObserver.current) {
      previousObserver.current.disconnect()
      previousObserver.current = null
    }

    if (node?.nodeType === Node.ELEMENT_NODE) {
      const observer = new ResizeObserver(([entry]) => {
        if (entry && entry.borderBoxSize) {
          const [{ inlineSize: width, blockSize: height }] = entry.borderBoxSize
          if (onchange) {
            onchange({ width, height })
          } else {
            if ((dimensions.width !== width) || (dimensions.height !== height)) {
              setDimensions(() => ({ width, height }))
            }
          }
        }
      })

      observer.observe(node)
      previousObserver.current = observer
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [customRef, dimensions] as const
}
