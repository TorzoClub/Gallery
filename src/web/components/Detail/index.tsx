import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useDisableScroll from 'hooks/useDisableScroll'
import Spinner from '../Spinner'
import { fitImage, INITIAL_VIEW, thumbnailTransform, viewTransform, type ThumbRect, type View } from './geometry'
import { createGestures } from './gestures'
import { downloadImage, prepareImage, type ImageDownload } from './image-loading'
import './style.scss'

type DetailInput = {
  from: ThumbRect
  thumb: string
  src: string
  height: number
  width: number
}
type DetailSession = DetailInput & { id: number; download: ImageDownload }
export type Detail = DetailSession | null
let nextSessionId = 0

export function prepareDetail(input: DetailInput): DetailSession {
  return { ...input, id: ++nextSessionId, download: downloadImage(input.src) }
}

export default function PhotoDetail({ detail, onCancel }: { detail: Detail; onCancel: () => void }) {
  const [visible, setVisible] = useState(detail)
  useLayoutEffect(() => {
    if (detail !== null) setVisible(detail)
  }, [detail])
  useDisableScroll(visible !== null)

  if (visible === null) return null
  return createPortal(
    <Viewer
      key={visible.id}
      detail={visible}
      closing={detail !== visible}
      onCancel={onCancel}
      onExited={() => setVisible(current => current === visible ? null : current)}
    />,
    document.body,
  )
}

type NativeGestureEvent = Event & { scale: number; clientX: number; clientY: number }
const IMAGE_DURATION = 382
const MASK_DURATION = 618

function Viewer({ detail, closing, onCancel, onExited }: {
  detail: DetailSession
  closing: boolean
  onCancel: () => void
  onExited: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const maskRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<() => void>(() => undefined)
  const retryRef = useRef<() => void>(() => undefined)
  const callbacks = useRef({ onCancel, onExited })
  const [entered, setEntered] = useState(false)
  const [loading, setLoading] = useState<'loading' | 'ready' | 'failed'>('loading')

  useLayoutEffect(() => { callbacks.current = { onCancel, onExited } })

  useLayoutEffect(() => {
    const root = rootRef.current!
    const mask = maskRef.current!
    const frame = frameRef.current!
    const source = sourceRef.current!
    const previousFocus = document.activeElement
    root.focus({ preventScroll: true })
    const lifetime = new AbortController()
    const urls = new Set<string>()
    const animations = new Set<Animation>()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let alive = true
    let isClosing = false
    let drawFrame = 0
    let view = { ...INITIAL_VIEW }
    let activeDownload = detail.download
    let viewport = { width: window.innerWidth, height: window.innerHeight }
    let fitted = fitImage(detail, viewport)
    let nativeGesture: { scale: number; point: { x: number; y: number } } | null = null

    function layout() {
      viewport = { width: window.innerWidth, height: window.innerHeight }
      fitted = fitImage(detail, viewport)
      Object.assign(frame.style, {
        width: `${fitted.width}px`, height: `${fitted.height}px`,
        left: `${fitted.left}px`, top: `${fitted.top}px`,
      })
    }
    function animate(element: HTMLElement, keyframes: Keyframe[], duration: number) {
      const animation = element.animate(keyframes, { duration: reducedMotion ? 0 : duration, easing: 'ease' })
      animations.add(animation)
      return animation
    }
    layout()
    frame.style.transform = viewTransform(view)
    const imageEntrance = animate(frame, [
      { transform: thumbnailTransform(detail.from, fitted), opacity: 0 },
      { transform: viewTransform(view), opacity: 1 },
    ], IMAGE_DURATION)
    const maskEntrance = animate(mask, [{ opacity: 0 }, { opacity: 1 }], MASK_DURATION)
    // Direct manipulation may interrupt the image flight. The mask still must finish.
    const entrance = Promise.all([
      imageEntrance.finished.catch(() => undefined),
      maskEntrance.finished.catch(() => undefined),
    ])
    void entrance.then(() => {
      if (!lifetime.signal.aborted) setEntered(true)
    })

    async function decode(blob: Blob) {
      const url = URL.createObjectURL(blob)
      urls.add(url)
      const image = new Image()
      image.className = 'source'
      image.alt = ''
      image.draggable = false
      image.decoding = 'async'
      image.src = url
      await image.decode()
      return image
    }
    function load(download: ImageDownload) {
      void prepareImage(download, entrance, decode, lifetime.signal).then(result => {
        if (lifetime.signal.aborted || download !== activeDownload) return
        if (result.status === 'ready') {
          // Insert the already-decoded element itself, not a second <img> with a new src.
          source.replaceChildren(result.image)
          setLoading('ready')
        } else if (result.status === 'failed') {
          setLoading('failed')
        }
      })
    }
    load(activeDownload)
    retryRef.current = () => {
      if (isClosing) return
      activeDownload.abort()
      activeDownload = downloadImage(detail.src)
      setLoading('loading')
      load(activeDownload)
    }

    function close() {
      if (isClosing || !alive) return
      isClosing = true
      lifetime.abort()
      activeDownload.abort()
      cancelAnimationFrame(drawFrame)
      const transform = getComputedStyle(frame).transform
      const imageOpacity = getComputedStyle(frame).opacity
      const maskOpacity = getComputedStyle(mask).opacity
      for (const animation of animations) animation.cancel()
      frame.style.transform = thumbnailTransform(detail.from, fitted)
      frame.style.opacity = '0'
      mask.style.opacity = '0'
      const imageExit = animate(frame, [
        { transform, opacity: imageOpacity },
        { transform: frame.style.transform, opacity: 0 },
      ], IMAGE_DURATION)
      const maskExit = animate(mask, [{ opacity: maskOpacity }, { opacity: 0 }], MASK_DURATION)
      void Promise.all([imageExit.finished, maskExit.finished]).then(() => {
        if (alive) callbacks.current.onExited()
      }).catch(() => undefined)
    }
    closeRef.current = close
    const dismiss = () => {
      if (isClosing) return
      close()
      callbacks.current.onCancel()
    }
    const draw = (next: View) => {
      if (isClosing) return
      view = next
      if (imageEntrance.playState === 'running') imageEntrance.cancel()
      if (drawFrame) return
      drawFrame = requestAnimationFrame(() => {
        drawFrame = 0
        frame.style.transform = viewTransform(view)
        root.dataset.zoomed = String(view.scale > 1)
      })
    }
    const gestures = createGestures(fitted, viewport, draw, dismiss)
    const isControl = (event: Event) => event.target instanceof Element && event.target.closest('button, a') !== null
    const point = (event: { clientX: number; clientY: number }) => ({ x: event.clientX, y: event.clientY })
    const pointerDown = (event: PointerEvent) => {
      if (isClosing || isControl(event) || (event.pointerType === 'mouse' && event.button !== 0)) return
      event.preventDefault()
      root.setPointerCapture(event.pointerId)
      gestures.down(event.pointerId, point(event))
    }
    const pointerMove = (event: PointerEvent) => {
      if (!isClosing) gestures.move(event.pointerId, point(event))
    }
    const pointerUp = (event: PointerEvent) => {
      if (!isClosing) gestures.up(event.pointerId, point(event))
    }
    const pointerCancel = (event: PointerEvent) => {
      if (!isClosing) gestures.cancel(event.pointerId)
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (isClosing || nativeGesture !== null) return
      gestures.wheel(event.deltaX, event.deltaY, event.deltaMode, event.ctrlKey, point(event))
    }
    const gesturePoint = (event: NativeGestureEvent) => ({
      x: Number.isFinite(event.clientX) ? event.clientX : viewport.width / 2,
      y: Number.isFinite(event.clientY) ? event.clientY : viewport.height / 2,
    })
    const gestureStart = (raw: Event) => {
      raw.preventDefault()
      if (isClosing || gestures.pointerCount > 0) return
      const event = raw as NativeGestureEvent
      nativeGesture = { scale: event.scale || 1, point: gesturePoint(event) }
    }
    const gestureChange = (raw: Event) => {
      raw.preventDefault()
      if (isClosing || nativeGesture === null || gestures.pointerCount > 0) return
      const event = raw as NativeGestureEvent
      const next = gesturePoint(event)
      gestures.zoom(event.scale / nativeGesture.scale, nativeGesture.point, next)
      nativeGesture = { scale: event.scale || 1, point: next }
    }
    const gestureEnd = (event: Event) => {
      event.preventDefault()
      nativeGesture = null
    }
    const resize = () => {
      if (isClosing) return
      layout()
      gestures.resize(fitted, viewport)
    }
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
      } else if (event.key === 'Tab') {
        event.preventDefault()
        ;(root.querySelector('button') ?? root).focus({ preventScroll: true })
      }
    }
    root.addEventListener('pointerdown', pointerDown)
    root.addEventListener('pointermove', pointerMove)
    root.addEventListener('pointerup', pointerUp)
    root.addEventListener('pointercancel', pointerCancel)
    root.addEventListener('lostpointercapture', pointerCancel)
    root.addEventListener('wheel', wheel, { passive: false })
    root.addEventListener('gesturestart', gestureStart, { passive: false })
    root.addEventListener('gesturechange', gestureChange, { passive: false })
    root.addEventListener('gestureend', gestureEnd, { passive: false })
    root.addEventListener('keydown', keyDown)
    window.addEventListener('resize', resize)

    return () => {
      alive = false
      lifetime.abort()
      activeDownload.abort()
      cancelAnimationFrame(drawFrame)
      for (const animation of animations) animation.cancel()
      for (const url of urls) URL.revokeObjectURL(url)
      root.removeEventListener('pointerdown', pointerDown)
      root.removeEventListener('pointermove', pointerMove)
      root.removeEventListener('pointerup', pointerUp)
      root.removeEventListener('pointercancel', pointerCancel)
      root.removeEventListener('lostpointercapture', pointerCancel)
      root.removeEventListener('wheel', wheel)
      root.removeEventListener('gesturestart', gestureStart)
      root.removeEventListener('gesturechange', gestureChange)
      root.removeEventListener('gestureend', gestureEnd)
      root.removeEventListener('keydown', keyDown)
      window.removeEventListener('resize', resize)
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [detail])

  useLayoutEffect(() => {
    if (closing) closeRef.current()
  }, [closing])

  return (
    <div ref={rootRef} className='detail-frame' role='dialog' aria-modal='true' aria-label='查看大图' tabIndex={-1}>
      <div ref={maskRef} className='bgMask' />
      <div ref={frameRef} className='imageFrame'>
        <img className='thumb' src={detail.thumb || undefined} alt='' draggable={false} />
        <div ref={sourceRef} className='sourceLayer' />
        {entered && !closing && loading !== 'ready' && (
          <div className='imgLoading' role='status'>
            {loading === 'loading'
              ? <><Spinner audioVolume={.8} /><span>加载中</span></>
              : <><span>大图加载失败，仍显示缩略图</span><button type='button' onClick={() => retryRef.current()}>重试</button></>}
          </div>
        )}
      </div>
    </div>
  )
}
