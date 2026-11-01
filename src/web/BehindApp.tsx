import pkg from '../../package.json'
import { useNavigate } from 'react-router-dom'

import './BehindApp.css'

import ReportCard, { type ReportCardBuild, type ReportCardRow } from './components/ReportCard'

import __logo_src from './about-image.jpg'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useClientPool } from './pool/store'
import { formatUptime } from '@shared/uptime'
import Navigator from './components/Navigator'
import { login as adminLogin } from './admin/api/auth'
import { setToken } from './admin/auth/token'
import { getApiErrorMessage } from './admin/utils/errors'
import SkeuomorphismButton from './components/SkeuomorphismButton'
import { ZeldaQuestBanner } from './components/ZeldaQuestBanner'

const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? 'N/A'
const BASE_PATH = import.meta.env.VITE_BASE_PATH ?? 'N/A'

function AppYearLabel(props: { year: string | number }) {
  const year = `${props.year}`
  const timeRef = useRef<HTMLTimeElement>(null)

  useEffect(() => {
    const element = timeRef.current
    if (element === null) {
      return
    }

    const spans = element.querySelectorAll('span')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      spans.forEach(span => {
        span.style.transform = 'translate3d(0, 0, 0)'
      })
      return
    }

    const amplitudeEm = 0.04
    const angularVelocity = (Math.PI * 2) / 5
    let start: number | null = null
    let frame = 0

    const animate = (now: number) => {
      if (start === null) {
        start = now
      }

      const elapsed = (now - start) / 1000
      spans.forEach((span, index) => {
        // 奇数位与偶数位从相反方向开始，同时保持完整正弦往复。
        const phase = index * Math.PI
        const offset = Math.sin(elapsed * angularVelocity + phase) * amplitudeEm
        span.style.transform = `translate3d(0, ${offset.toFixed(5)}em, 0)`
      })

      frame = window.requestAnimationFrame(animate)
    }

    frame = window.requestAnimationFrame(animate)
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [year])

  return (
    <time ref={timeRef} className='behind-app__year'>
      {
        [...year].map((num, idx) => {
          return <span key={idx}>{num}</span>
        })
      }
    </time>
  )
}

export default function BehindApp({ thisIsDisplay }: { thisIsDisplay: boolean }) {
  const navigate = useNavigate()
  const pool_state = useClientPool()
  const pool = pool_state.status === 'ready' ? pool_state.pool : null
  const [show_card, setShowCard] = useState(false)
  const [uptime, setUptime] = useState('—')
  const [admin_password, setAdminPassword] = useState('')
  const [admin_error, setAdminError] = useState('')
  const [admin_submitting, setAdminSubmitting] = useState(false)

  useEffect(() => {
    if (pool === null) {
      setUptime('N/A')
    } else {
      const update = () => setUptime(formatUptime(pool.app_startup_time))
      update()
      const timer = window.setInterval(update, 60_000)
      return () => window.clearInterval(timer)
    }
  }, [pool])

  const report: readonly ReportCardRow[] = [
    ['Version', `v${pkg.version}`],
    ['Uptime', uptime],
    ['Submissions', pool === null ? '—' : String(pool.submissions)],
    ['Votes', pool === null ? '—' : String(pool.votes)],
    ['API prefix', API_PREFIX],
    ['Base path', BASE_PATH],
  ]

  const build: ReportCardBuild = {
    date: pool?.build_date ?? 'N/A',
    hash: pool?.git_hash ?? 'N/A',
  }

  // WARNING: 为什么要采纳这种设计？
  // ReportCard 的首帧渲染很重，直接和页面一起挂载会让切页明显卡顿。
  // PublicRoot 只在 CRT 换台动画结束后才把 thisIsDisplay 置为 true，
  // 因此这里的 500ms 是从真正显示 Behind 之后开始算的；
  // 换台动画本身不会触发 ReportCard 的副作用。
  // 离开 Behind 时 thisIsDisplay 变回 false，立即卸载卡片并取消计时。
  // 这是用显示生命周期换首帧流畅度的妥协；如果未来显著优化了 ReportCard，
  // 应该移除这层延迟，恢复普通的声明式挂载。
  useEffect(() => {
    if (!thisIsDisplay) {
      setShowCard(false)
      return
    }

    const h = window.setTimeout(() => setShowCard(true), 500)
    return () => window.clearTimeout(h)
  }, [thisIsDisplay])

  const handleAdminLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (admin_submitting) {
      return
    }
    if (admin_password.length === 0) {
      setAdminError('请输入后台密码')
      return
    }

    setAdminSubmitting(true)
    setAdminError('')
    try {
      const result = await adminLogin(admin_password)
      setToken(result.token)
      setShowCard(false)
      navigate('/admin', { replace: true })
    } catch (error) {
      setAdminError(getApiErrorMessage(error, '登录失败'))
    } finally {
      setAdminSubmitting(false)
    }
  }

  return (
    <section className='behind-app' aria-label='关于同装相册'>
      <div className='behind-app__inner'>
        <Navigator scene='behind' onClickPushButton={() => {
          navigate('/explore', { replace: true })
          setShowCard(false)
        }} />
        <div className='behind-app__brand'>
          <img className='behind-app__logo' src={__logo_src} alt='Torzo Gallery' />
          <h1 className='behind-app__title'>{pkg.title}</h1>
          <AppYearLabel year={2026} />
        </div>
        <form className='behind-app__admin-entry' onSubmit={handleAdminLogin}>
          <label htmlFor='behind-admin-password'>进入后台管理</label>
          <div className='behind-app__admin-row'>
            <input
              id='behind-admin-password'
              type='password'
              value={admin_password}
              autoComplete='current-password'
              placeholder='管理员密码'
              disabled={admin_submitting}
              aria-invalid={admin_error !== ''}
              onChange={event => {
                setAdminPassword(event.target.value)
                if (admin_error !== '') {
                  setAdminError('')
                }
              }}
            />
            <button type='submit' disabled={admin_submitting}>
              {admin_submitting ? '验证中…' : '进入'}
            </button>
          </div>
          {admin_error !== '' && <div className='behind-app__admin-error' role='alert'>{admin_error}</div>}
        </form>
        <ZeldaQuestBannerTest />
        {/* <SkeuomorphismButton>测试</SkeuomorphismButton> */}
        {show_card && (
          <div className='behind-app__card-wrapper'>
            <ReportCard
              className='behind-app__report'
              report={report}
              build={build}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function ZeldaQuestBannerTest() {
  const [isOpen, setIsOpen] = useState(false);

  const triggerQuest = () => {
    if (isOpen) return;
    setIsOpen(true);
    // 3.8秒后自动关闭
    setTimeout(() => {
      setIsOpen(false);
    }, 3800);
  };

  return (
    <div style={{ marginTop: '40px'}}>
      <SkeuomorphismButton onClick={triggerQuest}>触发同装摄影活动banner</SkeuomorphismButton>

      <ZeldaQuestBanner
        isOpen={isOpen}
        category="迷你挑战"
        title="同装相册投票"
      />
    </div>
  );
}
