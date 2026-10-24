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
import { useLocation, useNavigate } from 'react-router-dom'

import { login as loginRequest } from '../api/auth'
import { UNAUTHORIZED_EVENT } from '../api/client'
import { useToast } from '../components/ToastProvider'
import { getToken, removeToken, setToken } from './token'

type AuthContextValue = {
  token: string
  isAuthenticated: boolean
  login: (pass: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState(() => getToken())
  const navigate = useNavigate()
  const location = useLocation()
  const locationRef = useRef(location)
  const unauthorizedRef = useRef(false)
  const toast = useToast()

  useEffect(() => {
    locationRef.current = location
  }, [location])

  const login = useCallback(async (pass: string) => {
    const result = await loginRequest(pass)
    setToken(result.token)
    setTokenState(result.token)
    unauthorizedRef.current = false
  }, [])

  const logout = useCallback(() => {
    removeToken()
    setTokenState('')
    unauthorizedRef.current = false
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      if (unauthorizedRef.current) {
        return
      }
      unauthorizedRef.current = true

      removeToken()
      setTokenState('')
      toast.info('登录已过期，请重新登录')

      const current = `${locationRef.current.pathname}${locationRef.current.search}`
      const redirect = current.startsWith('/admin') && !current.startsWith('/admin/login')
        ? current
        : '/admin/dashboard'

      navigate(`/admin/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [navigate, toast])

  const value = useMemo<AuthContextValue>(() => ({
    token,
    isAuthenticated: Boolean(token),
    login,
    logout,
  }), [login, logout, token])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
