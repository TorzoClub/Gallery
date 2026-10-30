import React, { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import RequireAuth from './auth/RequireAuth'
import { ConfirmProvider } from './components/ConfirmProvider'
import { PageLoading, RouteErrorBoundary } from './components/Feedback'
import { ToastProvider } from './components/ToastProvider'
import AdminLayout from './layout/AdminLayout'
import './admin.css'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const GalleryListPage = lazy(() => import('./pages/GalleryListPage'))
const PhotoListPage = lazy(() => import('./pages/PhotoListPage'))
const PhotoEditPage = lazy(() => import('./pages/PhotoEditPage'))
const PhotoMemberVotePage = lazy(() => import('./pages/PhotoMemberVotePage'))
const MemberListPage = lazy(() => import('./pages/MemberListPage'))
const MemberEditPage = lazy(() => import('./pages/MemberEditPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function AdminRoutes() {
  return (
    <Routes>
      <Route
        path="login"
        element={(
          <Suspense fallback={<PageLoading fullscreen label="正在加载登录页…" />}>
            <LoginPage />
          </Suspense>
        )}
      />

      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin-legacy/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="gallery" element={<GalleryListPage />} />
          <Route path="gallery/:gallery_id/photo/list" element={<PhotoListPage />} />
          <Route path="gallery/:gallery_id/photo/new" element={<PhotoEditPage />} />
          <Route path="gallery/:gallery_id/photo/member" element={<PhotoMemberVotePage />} />
          <Route path="gallery/:gallery_id/photo/:id" element={<PhotoEditPage />} />
          <Route path="member" element={<MemberListPage />} />
          <Route path="member/new" element={<MemberEditPage />} />
          <Route path="member/:id" element={<MemberEditPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function AdminApp() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex,nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <RouteErrorBoundary>
            <AdminRoutes />
          </RouteErrorBoundary>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
