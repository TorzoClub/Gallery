import React, { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import Icon from './Icon'

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      className={className ? `adm-spinner ${className}` : 'adm-spinner'}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

export function PageLoading({
  label = '加载中…',
  compact = false,
  fullscreen = false,
}: {
  label?: string
  compact?: boolean
  fullscreen?: boolean
}) {
  const classes = [
    'adm-loading',
    compact ? 'adm-loading--compact' : '',
    fullscreen ? 'adm-loading--fullscreen' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} role="status" aria-live="polite">
      <Spinner size={compact ? 18 : 26} />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({
  title = '暂无数据',
  description,
  action,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="adm-empty">
      <div className="adm-empty__icon">
        <Icon name="gallery" size={28} />
      </div>
      <h3 className="adm-empty__title">{title}</h3>
      {description && <p className="adm-empty__description">{description}</p>}
      {action && <div className="adm-empty__action">{action}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  backTo,
  backLabel = '返回',
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  backTo?: string
  backLabel?: string
  actions?: ReactNode
}) {
  return (
    <div className="adm-page-header">
      <div className="adm-page-header__main">
        {backTo && (
          <Link className="adm-back-link" to={backTo}>
            <Icon name="arrow-left" size={15} />
            {backLabel}
          </Link>
        )}
        <h1 className="adm-page-title">{title}</h1>
        {subtitle && <p className="adm-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="adm-page-actions">{actions}</div>}
    </div>
  )
}

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Admin render failure', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="adm-error-state">
          <div className="adm-error-state__code">ERROR</div>
          <h2>页面出错了</h2>
          <p>{this.state.error.message}</p>
          <button
            type="button"
            className="adm-button adm-button--primary"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
}
