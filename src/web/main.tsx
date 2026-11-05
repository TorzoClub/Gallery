import React, { ReactNode, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { OutterPromise } from 'vait'

import { appInitInfomation } from './HomeApp'
import { acquireTabSlot, MAX_TABS } from './utils/tab-slot'
import TooManyTabsIcon from './components/TooManyTabsIcon'
import { isBehindPath, isCancelSubmissionPath, isMemberPath, isStaffPath } from './routes'
import { FailureLayoutContainer, useFailureLayout } from './components/FailureLayout'

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
    } else if (isStaffPath(location.pathname)) {
      document.title = '同装摄影集 · Staff'
    } else if (isMemberPath(location.pathname)) {
      document.title = '同装摄影集 · Member'
    } else if (isCancelSubmissionPath(location.pathname)) {
      document.title = '同装摄影集 · cancelSubmission'
    } else if (location.pathname.startsWith('/explore')) {
      document.title = '同装摄影集'
    } else if (!location.pathname.startsWith('/admin')) {
      document.title = '同装摄影集'
    }
  }, [location.pathname])

  return null
}

import { signal_critical_error } from './signals'
import { ZeldaQuestBanner } from './components/ZeldaQuestBanner'
import ZeldaQuestBannerLayout from './ZeldaQuestBannerLayout'

export default function CriticalFailureLayout({ children }: { children: ReactNode }) {
  const [ showFailure, , failure_layout ] = useFailureLayout(children)

  useEffect(() => {
    signal_critical_error.receive(showFailure)
    return () => signal_critical_error.cancelReceive(showFailure)
  }, [showFailure])

  return <>{failure_layout}</>
}

const build_description = import.meta.env.VITE_BUILD_DESCRIPTION

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

function OverRunning() {
  useEffect(() => {
    document.title = '同装摄影集 · 页面太多'
  }, [])

  return (
    <main
      role='alert'
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        background: 'transparent',
        color: '#2b333b',
        fontFamily: '"Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 'min(640px, calc(100vw - 32px))',
          padding: '26px 32px 24px',
          boxSizing: 'border-box',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 0 1px grey, 0 4px 12px -4px hsl(0 0% 70% / 1)',
        }}
      >
        <div style={{ width: 'min(560px, 100%)', margin: '0 auto 10px' }}>
          <TooManyTabsIcon />
        </div>
        <h1 style={{ margin: '0 0 16px', fontSize: '28px', fontWeight: 700 }}>
          页面开得太多了
        </h1>
        <p style={{ margin: '8px 0', lineHeight: 1.7 }}>
          由于连接限制，最多同时打开 {MAX_TABS} 个页面。关掉一个标签页后会自动进入，不用刷新。
        </p>
      </div>
    </main>
  )
}

function RootGate() {
  const [status, set_status] = useState<'checking' | 'ready' | 'blocked'>('checking')

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    const check = async () => {
      let result
      try {
        result = await acquireTabSlot()
      } catch {
        result = { ok: true }
      }
      if (cancelled) {
        return
      }
      if (result.ok) {
        set_status('ready')
        return
      }
      set_status('blocked')
      timer = window.setTimeout(() => {
        void check()
      }, 1000)
    }

    void check()
    return () => {
      cancelled = true
      if (timer !== undefined) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  if (status === 'checking') {
    return null
  }
  if (status === 'blocked') {
    return <OverRunning />
  }
  return <Bootstrap />
}

function Bootstrap() {
  const PublicRoot = publicRoot.default
  return (
    <div className='bootstrap'>
      <CriticalFailureLayout>
        <ZeldaQuestBannerLayout>
          <RootErrorBoundary>
            <BrowserRouter basename={basename}>
              <TitleSync />
              <Routes>
                <Route path="/" element={<Navigate to="/explore" replace />} />
                <Route path="/*" element={<PublicRoot />} />
              </Routes>
            </BrowserRouter>
          </RootErrorBoundary>
        </ZeldaQuestBannerLayout>
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


const [
  homeAppData,
  publicRoot,
] = await Promise.all([
  import('./HomeApp'),
  import('./PublicRoot'),
])

const picutre_support = await initPictureSupportInfomation()

try {
  const [ getAppInitInfo, setAppInitInfo ] = appInitInfomation
  setAppInitInfo({
    ...getAppInitInfo(),
    picutre_support,
  })

  const mount_el = document.getElementById('root')
  if (mount_el === null) {
    alert('没有找到#root元素！')
  } else {
    ReactDOM.createRoot(mount_el).render(<RootGate />)
  }
} catch (err) {
  alert(`页面初始化错误：${err}`)
}
