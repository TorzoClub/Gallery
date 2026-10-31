import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './index.module.scss'

export type PopoverSide = 'top' | 'bottom' | 'left' | 'right'
export type PopoverAlign = 'start' | 'center' | 'end'

export type PopoverProps = {
  trigger: ReactNode
  content: ReactNode | ((close: () => void) => ReactNode)
  side?: PopoverSide
  align?: PopoverAlign
  offset?: number
  arrow?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  label?: string
  className?: string
}

const MARGIN = 8
const ARROW_W = 16
const ARROW_H = 9
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type Box = {
  left: number
  top: number
  width: number
  height: number
}

type Placement = {
  x: number
  y: number
  side: PopoverSide
  arrow: number
}

const LAYERS: symbol[] = []

function useLayer(open: boolean) {
  const token = useMemo(() => Symbol('popover-layer'), [])

  useEffect(() => {
    if (!open) {
      return
    }
    LAYERS.push(token)
    return () => {
      const index = LAYERS.lastIndexOf(token)
      if (index >= 0) {
        LAYERS.splice(index, 1)
      }
    }
  }, [open, token])

  return useMemo(() => ({
    isTop: () => LAYERS[LAYERS.length - 1] === token,
  }), [token])
}

const OPPOSITE: Record<PopoverSide, PopoverSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

function place(
  anchor: Box,
  width: number,
  height: number,
  side: PopoverSide,
  align: PopoverAlign,
  offset: number,
): Placement {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const fits: Record<PopoverSide, boolean> = {
    top: anchor.top - offset - height >= MARGIN,
    bottom: anchor.top + anchor.height + offset + height <= vh - MARGIN,
    left: anchor.left - offset - width >= MARGIN,
    right: anchor.left + anchor.width + offset + width <= vw - MARGIN,
  }
  const chosen = fits[side] || !fits[OPPOSITE[side]] ? side : OPPOSITE[side]
  const vertical = chosen === 'top' || chosen === 'bottom'
  const alignAlong = (start: number, size: number, own: number) => (
    align === 'start'
      ? start
      : align === 'end'
        ? start + size - own
        : start + size / 2 - own / 2
  )

  let x = vertical
    ? alignAlong(anchor.left, anchor.width, width)
    : chosen === 'left'
      ? anchor.left - offset - width
      : anchor.left + anchor.width + offset
  let y = vertical
    ? chosen === 'top'
      ? anchor.top - offset - height
      : anchor.top + anchor.height + offset
    : alignAlong(anchor.top, anchor.height, height)

  x = Math.min(Math.max(x, MARGIN), Math.max(MARGIN, vw - width - MARGIN))
  y = Math.min(Math.max(y, MARGIN), Math.max(MARGIN, vh - height - MARGIN))

  return {
    x,
    y,
    side: chosen,
    arrow: vertical
      ? anchor.left + anchor.width / 2 - x
      : anchor.top + anchor.height / 2 - y,
  }
}

function focusableElements(element: HTMLElement): HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter(node => !node.closest('[inert]') && node.offsetParent !== null)
}

function Arrow({ side, at }: { side: PopoverSide; at: number }) {
  const vertical = side === 'top' || side === 'bottom'
  const rotate = { bottom: 0, top: 180, right: -90, left: 90 }[side]
  const out = `${-(ARROW_H / 2 - 1)}px`
  const beyond = `calc(100% + ${ARROW_H / 2 - 1}px)`
  const along = `clamp(${14 + ARROW_W / 2}px, ${at}px, calc(100% - ${14 + ARROW_W / 2}px))`

  return (
    <svg
      aria-hidden
      width={ARROW_W}
      height={ARROW_H}
      viewBox={`0 0 ${ARROW_W} ${ARROW_H}`}
      className={styles.arrow}
      style={{
        left: vertical ? along : side === 'right' ? out : beyond,
        top: vertical ? (side === 'bottom' ? out : beyond) : along,
        transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
      }}
    >
      <path
        d={`M0 ${ARROW_H} L${ARROW_W / 2} 1 L${ARROW_W} ${ARROW_H} Z`}
        className={styles.arrowFill}
      />
      <path
        d={`M0 ${ARROW_H - 1} L${ARROW_W / 2} 1 L${ARROW_W} ${ARROW_H - 1}`}
        className={styles.arrowStroke}
      />
    </svg>
  )
}

export default function Popover({
  trigger,
  content,
  side = 'bottom',
  align = 'center',
  offset = 10,
  arrow = true,
  open: open_prop,
  onOpenChange,
  label,
  className,
}: PopoverProps) {
  const [internal_open, setInternalOpen] = useState(false)
  const open = open_prop ?? internal_open
  const trigger_ref = useRef<HTMLSpanElement>(null)
  const floating_ref = useRef<HTMLDivElement>(null)
  const panel_ref = useRef<HTMLDivElement>(null)
  const layer = useLayer(open)
  const [placement, setPlacement] = useState<Placement | null>(null)

  const setOpen = useCallback((next: boolean) => {
    if (open_prop === undefined) {
      setInternalOpen(next)
    }
    onOpenChange?.(next)
  }, [onOpenChange, open_prop])

  const close = useCallback(() => setOpen(false), [setOpen])

  useEffect(() => {
    const element = trigger_ref.current?.firstElementChild
    if (!(element instanceof HTMLElement)) {
      return
    }
    element.setAttribute('aria-haspopup', 'dialog')
    element.setAttribute('aria-expanded', String(open))
    if (!element.matches('button, a, input, select, textarea, [tabindex]')) {
      element.setAttribute('tabindex', '0')
      element.setAttribute('role', 'button')
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !layer.isTop()) {
        return
      }
      event.preventDefault()
      close()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!layer.isTop()) {
        return
      }
      const target = event.target as Node | null
      const panel = panel_ref.current
      const trigger_element = trigger_ref.current
      if (target === null || panel === null) {
        return
      }
      if (panel.contains(target) || trigger_element?.contains(target)) {
        return
      }
      close()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [close, layer, open])

  const positioned = placement !== null

  useEffect(() => {
    if (!open || !positioned) {
      return
    }

    const previous = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const frame = window.requestAnimationFrame(() => {
      const panel = panel_ref.current
      if (panel === null) {
        return
      }
      const target = panel.querySelector<HTMLElement>('[data-autofocus]')
        ?? focusableElements(panel)[0]
        ?? panel
      target.focus({ preventScroll: true })
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !layer.isTop()) {
        return
      }
      const panel = panel_ref.current
      if (panel === null) {
        return
      }
      const focusable = focusableElements(panel)
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      if (previous !== null && document.contains(previous)) {
        previous.focus({ preventScroll: true })
      }
    }
  }, [layer, open, positioned])

  useEffect(() => {
    if (!open) {
      setPlacement(null)
      return
    }

    const floating = floating_ref.current
    const trigger_element = trigger_ref.current?.firstElementChild
    if (!(floating instanceof HTMLElement) || !(trigger_element instanceof HTMLElement)) {
      return
    }

    const update = () => {
      const anchor = trigger_element.getBoundingClientRect()
      if (anchor.width === 0 && anchor.height === 0) {
        return
      }
      const next = place(
        anchor,
        floating.offsetWidth,
        floating.offsetHeight,
        side,
        align,
        offset,
      )
      floating.style.transform = `translate(${Math.round(next.x)}px, ${Math.round(next.y)}px)`
      setPlacement(current => (
        current !== null
          && current.side === next.side
          && Math.abs(current.arrow - next.arrow) < 0.5
          && current.x === next.x
          && current.y === next.y
          ? current
          : next
      ))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(floating)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [align, offset, open, side])

  const content_node = typeof content === 'function' ? content(close) : content

  return (
    <>
      <span
        ref={trigger_ref}
        className={styles.trigger}
        onClick={(event) => {
          event.stopPropagation()
          setOpen(!open)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return
          }
          const target = event.target
          if (target instanceof HTMLElement && target.matches('button, a, input, select, textarea')) {
            return
          }
          event.preventDefault()
          setOpen(!open)
        }}
      >
        {trigger}
      </span>
      {open && createPortal(
        <div
          ref={floating_ref}
          className={styles.floating}
          style={{ visibility: placement === null ? 'hidden' : 'visible' }}
        >
          <div
            ref={panel_ref}
            className={className === undefined ? styles.panel : `${styles.panel} ${className}`}
            role="dialog"
            aria-label={label ?? '弹出面板'}
            tabIndex={-1}
          >
            {content_node}
            {arrow && placement !== null && (
              <Arrow side={placement.side} at={placement.arrow} />
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
