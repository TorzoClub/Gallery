import React, { Suspense, lazy, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Memo, OutterPromise } from 'new-vait'

import App, { appInitInfomation } from './App'
import { FailureLayoutContainer } from './components/FailureLayout'
import './index.css'

const AdminApp = lazy(() => import('./admin/AdminApp'))

const rawBase = import.meta.env.BASE_URL
const basename = rawBase === '/' ? '/' : rawBase.replace(/\/$/, '')

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Root render failure', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <FailureLayoutContainer errors={[this.state.error]}>
          <div style={{ minHeight: '100vh', background: '#fff' }} />
        </FailureLayoutContainer>
      )
    }

    return this.props.children
  }
}

function AdminBootSplash() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.8em',
      background: '#f5f6f8',
      color: '#4b5563',
      fontFamily: 'sans-serif',
      fontSize: 15,
    }}>
      <span style={{
        width: 20,
        height: 20,
        border: '2px solid #c7d2fe',
        borderTopColor: '#4f46e5',
        borderRadius: '50%',
        animation: 'admin-boot-spin 0.8s linear infinite',
      }} />
      正在加载后台…
      <style>{`
        @keyframes admin-boot-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function TitleSync() {
  const location = useLocation()

  useEffect(() => {
    if (!location.pathname.startsWith('/admin')) {
      document.title = '同装摄影集'
    }
  }, [location.pathname])

  return null
}

function Bootstrap() {
  return (
    <RootErrorBoundary>
      <BrowserRouter basename={basename}>
        <TitleSync />
        <Routes>
          <Route
            path="/admin/*"
            element={(
              <Suspense fallback={<AdminBootSplash />}>
                <AdminApp />
              </Suspense>
            )}
          />
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </RootErrorBoundary>
  )
}

initPictureSupportInfomation()
  .then(picutre_support => {
    const [ getAppInitInfo, setAppInitInfo ] = appInitInfomation
    setAppInitInfo({
      ...getAppInitInfo(),
      picutre_support,
    })

    const mount_el = document.getElementById('root')
    if (mount_el === null) {
      alert('没有找到#root元素！')
    } else {
      ReactDOM.createRoot(mount_el).render(<Bootstrap />)
    }
  })
  .catch(err => {
    alert(`页面初始化错误：${err?.message}`)
  })

function PictureTypeSupported(base64sample: string) {
  return () => {
    const [res, rej, promise] = OutterPromise<boolean>()

    const image = new Image()
    image.onerror = () => rej(false)
    image.onload = () => res(true)
    image.src = base64sample

    return promise
  }
}

export async function initPictureSupportInfomation() {
  const [avif, webp] = await Promise.all([
    PictureTypeSupported('data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=')(),
    PictureTypeSupported('data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAEAAQAcJaQAA3AA/v3AgAA=')(),
  ])
  return { avif, webp } as const
}
