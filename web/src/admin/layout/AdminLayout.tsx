import React, { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { PageLoading, RouteErrorBoundary } from '../components/Feedback'
import Icon, { IconName } from '../components/Icon'

type NavItem = {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/admin/dashboard', label: '概览', icon: 'dashboard', end: true },
  { to: '/admin/gallery', label: '相册', icon: 'gallery' },
  { to: '/admin/member', label: '成员', icon: 'users' },
]

function sectionTitle(pathname: string) {
  if (pathname.startsWith('/admin/dashboard')) {
    return '概览'
  }
  if (pathname.startsWith('/admin/gallery')) {
    return '相册'
  }
  if (pathname.startsWith('/admin/member')) {
    return '成员'
  }
  return '管理后台'
}

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const title = sectionTitle(location.pathname)

  useEffect(() => {
    setSidebarOpen(false)
    contentRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])

  useEffect(() => {
    document.title = `${title} · 同装相册后台`
  }, [title])

  useEffect(() => {
    if (!sidebarOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [sidebarOpen])

  const handleLogout = () => {
    logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-root adm-shell">
      <button
        type="button"
        className={sidebarOpen ? 'adm-sidebar-overlay adm-sidebar-overlay--open' : 'adm-sidebar-overlay'}
        aria-label="关闭导航"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={sidebarOpen ? 'adm-sidebar adm-sidebar--open' : 'adm-sidebar'}>
        <div className="adm-sidebar__brand">
          <NavLink to="/admin/dashboard" className="adm-brand">
            <span className="adm-brand__mark">同</span>
            <span className="adm-brand__text">
              <strong>同装相册</strong>
              <small>管理后台</small>
            </span>
          </NavLink>
          <button
            type="button"
            className="adm-icon-button adm-sidebar__close"
            aria-label="关闭导航"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className="adm-nav" aria-label="后台导航">
          <span className="adm-nav__label">工作台</span>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => isActive ? 'adm-nav-item adm-nav-item--active' : 'adm-nav-item'}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="adm-sidebar__footer">
          <a
            className="adm-sidebar-link"
            href={import.meta.env.BASE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="external" size={17} />
            <span>打开前台</span>
          </a>
          <button type="button" className="adm-sidebar-link" onClick={handleLogout}>
            <Icon name="logout" size={17} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <div className="adm-topbar__left">
            <button
              type="button"
              className="adm-icon-button adm-menu-button"
              aria-label="打开导航"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="menu" size={21} />
            </button>
            <div className="adm-breadcrumb" aria-label="面包屑">
              <span>后台</span>
              <span className="adm-breadcrumb__separator">/</span>
              <strong>{title}</strong>
            </div>
          </div>

          <div className="adm-topbar__right">
            <a
              className="adm-topbar-link"
              href={import.meta.env.BASE_URL}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="external" size={15} />
              <span>打开前台</span>
            </a>
            <span className="adm-user-chip">
              <Icon name="user" size={15} />
              管理员
            </span>
            <button type="button" className="adm-icon-button" aria-label="退出登录" onClick={handleLogout}>
              <Icon name="logout" size={19} />
            </button>
          </div>
        </header>

        <main className="adm-content" ref={contentRef}>
          <RouteErrorBoundary>
            <Suspense fallback={<PageLoading label="正在加载页面…" />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}
