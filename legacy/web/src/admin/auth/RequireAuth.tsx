import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from './AuthContext'

export default function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    const current = `${location.pathname}${location.search}`
    return (
      <Navigate
        to={`/admin/login?redirect=${encodeURIComponent(current)}`}
        replace
      />
    )
  }

  return <Outlet />
}
