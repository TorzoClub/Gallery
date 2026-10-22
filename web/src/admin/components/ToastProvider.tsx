import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import Icon, { IconName } from './Icon'

type ToastKind = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  kind: ToastKind
  message: string
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toastIcons: Record<ToastKind, IconName> = {
  success: 'check',
  error: 'alert',
  info: 'info',
}

let nextToastID = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const remove = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts(list => list.filter(item => item.id !== id))
  }, [])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextToastID++
    setToasts(list => [...list, { id, kind, message }].slice(-4))

    const duration = kind === 'error' ? 6500 : 4000
    const timer = setTimeout(() => remove(id), duration)
    timers.current.set(id, timer)
  }, [remove])

  useEffect(() => {
    const currentTimers = timers.current
    return () => {
      currentTimers.forEach(timer => clearTimeout(timer))
      currentTimers.clear()
    }
  }, [])

  const success = useCallback((message: string) => push('success', message), [push])
  const error = useCallback((message: string) => push('error', message), [push])
  const info = useCallback((message: string) => push('info', message), [push])

  const value = useMemo(() => ({ success, error, info }), [success, error, info])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="admin-portal">
          <div className="adm-toast-stack" aria-live="polite" aria-atomic="false">
            {toasts.map(toast => (
              <div
                key={toast.id}
                className={`adm-toast adm-toast--${toast.kind}`}
                role={toast.kind === 'error' ? 'alert' : 'status'}
              >
                <span className="adm-toast__icon">
                  <Icon name={toastIcons[toast.kind]} size={18} />
                </span>
                <span className="adm-toast__message">{toast.message}</span>
                <button
                  type="button"
                  className="adm-toast__close"
                  aria-label="关闭提示"
                  onClick={() => remove(toast.id)}
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider')
  }
  return context
}
