import React, { ReactNode } from 'react'

type Props = {
  label?: ReactNode
  htmlFor?: string
  required?: boolean
  error?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}

export default function Field({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  children,
  className,
}: Props) {
  return (
    <div className={className ? `adm-field ${className}` : 'adm-field'}>
      {label && (
        <label className="adm-field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="adm-field__required">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <div className="adm-field__hint">{hint}</div>}
      {error && <div className="adm-field__error" role="alert">{error}</div>}
    </div>
  )
}
