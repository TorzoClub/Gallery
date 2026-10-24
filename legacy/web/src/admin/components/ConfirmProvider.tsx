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

import Modal from './Modal'

export type ConfirmOptions = {
  title?: ReactNode
  message: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const close = useCallback((value: boolean) => {
    const resolver = resolverRef.current
    resolverRef.current = null
    setOptions(null)
    resolver?.(value)
  }, [])

  const confirm = useCallback((nextOptions: ConfirmOptions) => {
    if (resolverRef.current) {
      return Promise.resolve(false)
    }

    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve
      setOptions(nextOptions)
    })
  }, [])

  useEffect(() => {
    return () => {
      resolverRef.current?.(false)
      resolverRef.current = null
    }
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={options !== null}
        title={options?.title ?? '请确认'}
        onClose={() => close(false)}
        closeOnOverlay={false}
        size="sm"
        footer={(
          <>
            <button type="button" className="adm-button" onClick={() => close(false)}>
              {options?.cancelText ?? '取消'}
            </button>
            <button
              type="button"
              className={options?.danger ? 'adm-button adm-button--danger' : 'adm-button adm-button--primary'}
              onClick={() => close(true)}
            >
              {options?.confirmText ?? '确定'}
            </button>
          </>
        )}
      >
        <div className="adm-confirm-message">{options?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmContextValue['confirm'] {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used inside ConfirmProvider')
  }
  return context.confirm
}
