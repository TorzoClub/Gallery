import React, { ReactNode, Suspense, lazy, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { OutterPromise } from 'vait'

import { appInitInfomation } from './HomeApp'
import PublicRoot from './PublicRoot'
import { isBehindPath } from './routes'
import { FailureLayoutContainer, useFailureLayout } from './components/FailureLayout'

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

function TitleSync() {
  const location = useLocation()

  useEffect(() => {
    if (isBehindPath(location.pathname)) {
      document.title = '同装摄影集 · About'
    } else if (location.pathname.startsWith('/explore')) {
      document.title = '同装摄影集'
    } else if (!location.pathname.startsWith('/admin')) {
      document.title = '同装摄影集'
    }
  }, [location.pathname])

  return null
}

import { signal_critical_error } from './signals'
import LoadingLayout from './layouts/GalleryHome/components/LoadingLayout'

export default function CriticalFailureLayout({ children }: { children: ReactNode }) {
  const [ showFailure, , failure_layout ] = useFailureLayout(children)

  useEffect(() => {
    signal_critical_error.receive(showFailure)
    return () => signal_critical_error.cancelReceive(showFailure)
  }, [showFailure])

  return <>{failure_layout}</>
}

const build_description = import.meta.env.VITE_BUILD_DESCRIPTION

function Bootstrap() {
  return (
    <div className='bootstrap'>
      <CriticalFailureLayout>
        <RootErrorBoundary>
          <BrowserRouter basename={basename}>
            <TitleSync />
            <Routes>
              <Route path="/" element={<Navigate to="/explore" replace />} />
              <Route
                path="/admin/*"
                element={(
                  <Suspense fallback={<LoadingLayout />}>
                    <AdminApp />
                  </Suspense>
                )}
              />
              <Route path="/*" element={<PublicRoot />} />
            </Routes>
          </BrowserRouter>
        </RootErrorBoundary>
      </CriticalFailureLayout>
      {
        build_description && build_description.length && (
          <pre className="build-description">
            <code>{ build_description }</code>
          </pre>
        )
      }
      <style>{`
        .bootstrap {
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
        }
        .build-description {
          position: fixed;
          bottom: 0;
          right: 24px;
          color: grey;
          font-size: 12px;
          padding: 0;
          margin: 0;
          line-height: 1em;
          max-width: 100vw;
          word-break: break-all;
          display: inline-block;
          white-space: break-spaces;
        }
      `}</style>
    </div>
  )
}

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
