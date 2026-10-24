import React, { ReactNode, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import Icon from './Icon'

type Props = {
  open: boolean
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose?: () => void
  closeOnOverlay?: boolean
  size?: 'sm' | 'md' | 'lg'
  bodyClassName?: string
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
}

export default function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  closeOnOverlay = true,
  size = 'md',
  bodyClassName,
}: Props) {
  const titleID = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (!dialog) {
        return
      }
      const focusable = getFocusable(dialog)
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        dialog.focus()
      }
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const dialog = dialogRef.current
      if (!dialog) {
        return
      }

      const focusable = getFocusable(dialog)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [open])

  if (!open) {
    return null
  }

  return createPortal(
    <div className="admin-portal">
      <div
        className="adm-modal-overlay"
        onMouseDown={event => {
          if (closeOnOverlay && event.target === event.currentTarget) {
            onClose?.()
          }
        }}
      >
        <div
          ref={dialogRef}
          className={`adm-modal adm-modal--${size}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleID : undefined}
          aria-label={title ? undefined : '对话框'}
          tabIndex={-1}
          onMouseDown={event => event.stopPropagation()}
        >
          {(title || onClose) && (
            <div className="adm-modal__header">
              <h2 id={titleID} className="adm-modal__title">{title}</h2>
              {onClose && (
                <button
                  type="button"
                  className="adm-icon-button"
                  aria-label="关闭"
                  onClick={onClose}
                >
                  <Icon name="close" size={20} />
                </button>
              )}
            </div>
          )}

          <div className={bodyClassName ? `adm-modal__body ${bodyClassName}` : 'adm-modal__body'}>
            {children}
          </div>

          {footer && (
            <div className="adm-modal__footer">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
