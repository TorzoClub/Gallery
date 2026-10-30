import React, { FormEvent, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import Icon from '../components/Icon'
import { Spinner } from '../components/Feedback'
import { getApiErrorMessage } from '../utils/errors'

function safeRedirect(value: string | null): string {
  if (value && value.startsWith('/admin-legacy') && !value.startsWith('/admin-legacy/login')) {
    return value
  }
  return '/admin-legacy/dashboard'
}

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = useMemo(() => safeRedirect(searchParams.get('redirect')), [searchParams])

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = '登录 · 同装相册后台'
  }, [])

  if (isAuthenticated) {
    return <Navigate to="/admin-legacy/dashboard" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!password) {
      setError('请输入后台密码')
      return
    }

    setSubmitting(true)
    try {
      await login(password)
      navigate(redirect, { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err, '登录失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-root adm-login">
      <div className="adm-login__glow adm-login__glow--one" />
      <div className="adm-login__glow adm-login__glow--two" />

      <div className="adm-login__card">
        <div className="adm-login__brand">
          <span className="adm-brand__mark">同</span>
          <span className="adm-brand__text">
            <strong>同装相册</strong>
            <small>管理后台</small>
          </span>
        </div>

        <div className="adm-login__heading">
          <h1>欢迎回来</h1>
          <p>输入后台密码以继续管理相册</p>
        </div>

        <form className="adm-login__form" onSubmit={handleSubmit} noValidate>
          <label className="adm-field__label" htmlFor="admin-password">后台密码</label>
          <div className={error ? 'adm-password adm-password--error' : 'adm-password'}>
            <Icon name="user" size={17} className="adm-password__icon" />
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              placeholder="请输入密码"
              autoComplete="current-password"
              autoFocus
              aria-invalid={Boolean(error)}
              onChange={event => {
                setPassword(event.target.value)
                if (error) {
                  setError('')
                }
              }}
            />
            <button
              type="button"
              className="adm-password__toggle"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              onClick={() => setShowPassword(value => !value)}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
            </button>
          </div>

          {error && <div className="adm-field__error" role="alert">{error}</div>}

          <button
            type="submit"
            className="adm-button adm-button--primary adm-login__submit"
            disabled={submitting}
          >
            {submitting ? <><Spinner size={17} /> 登录中…</> : '登录'}
          </button>
        </form>

        <div className="adm-login__footer">
          <a href={import.meta.env.BASE_URL} className="adm-login__footer-link">
            返回相册首页
          </a>
          <span>仅限管理员访问</span>
        </div>
      </div>
    </div>
  )
}
