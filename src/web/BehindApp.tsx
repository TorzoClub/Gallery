import pkg from '../../package.json'
import { useNavigate } from 'react-router-dom'

import './BehindApp.css'

import ReportCard, { type ReportCardBuild, type ReportCardRow } from './components/ReportCard'

import __logo_src from './about-image.jpg'
import { type FormEvent, lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { useClientPool } from './pool/store'
import { formatUptime } from '@shared/uptime'
import Navigator from './components/Navigator'
import { login as adminLogin } from './admin/api/auth'
import { setToken } from './admin/auth/token'
import { getApiErrorMessage } from './admin/utils/errors'
import Popover from './components/Popover'
import { Slit } from './components/Title'
import { identity, thunkify } from 'ramda'
import { WhitePlasticButton } from './components/WhitePlasticButton'

// 名单簿会带上后台的成员表单等代码，懒加载，不进公开页首屏的包
const PublicMemberNotebook = lazy(() => import('./components/PublicMemberNotebook'))

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

  return (
    <section className='behind-app' aria-label='关于同装相册'>
      <div className='behind-app__inner'>
        <Navigator scene='behind' onClickPushButton={() => {
          navigate('/explore', { replace: true })
          setShowCard(false)
        }} />
        {/*
          网格布局（见 BehindApp.css）：窄屏单列，品牌 → 后台抽屉 → 名单簿 → System Reports；
          ≥ 1100px 两栏，左栏品牌和 System Reports，右栏名单簿和后台抽屉（与名单簿同宽）
        */}
        <div className='behind-app__layout'>
          <div className='behind-app__brand'>
            <img className='behind-app__logo' src={__logo_src} alt='Torzo Gallery' />
            <h1 className='behind-app__title'>{pkg.title}</h1>
            <AppYearLabel year={2026} />
          </div>

          <EnterAdmin onLoginSuccess={() => {
            setShowCard(false)
            navigate('/admin', { replace: true })
          }} />

          {pool !== null && (
            <div className='behind-app__members'>
              <Suspense fallback={null}>
                <PublicMemberNotebook pool={pool} />
              </Suspense>
            </div>
          )}
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
      </div>
    </section>
  )
}

function EnterAdmin(props: { onLoginSuccess(): void }) {
  const [open, setOpen] = useState(false)
  const [admin_password, setAdminPassword] = useState('')
  const [admin_error, setAdminError] = useState('')
  const [admin_submitting, setAdminSubmitting] = useState(false)
  const admin_submitting_ref = useRef(false)

  // 抽屉拉开（Slit 展开 360ms）后把焦点放进密码框，用户可以直接输入
  useEffect(() => {
    if (!open) {
      return
    }
    const timer = window.setTimeout(() => {
      document.getElementById('behind-admin-password')?.focus({ preventScroll: true })
    }, DRAWER_SLIDE_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  const submitAdminPassword = async (password: string) => {
    if (admin_submitting_ref.current) {
      return
    }
    if (password.length === 0) {
      setAdminError('请输入后台密码')
      return
    }

    admin_submitting_ref.current = true
    setAdminSubmitting(true)
    setAdminError('')
    try {
      const result = await adminLogin(password)
      setToken(result.token)
      props.onLoginSuccess()
    } catch (error) {
      setAdminError(getApiErrorMessage(error, '登录失败'))
    } finally {
      admin_submitting_ref.current = false
      setAdminSubmitting(false)
    }
  }

  const handleAdminLogin = (event: FormEvent) => {
    event.preventDefault()
    void submitAdminPassword(admin_password)
  }

  return (
    <div className='behind-app__admin'>
      {/* 抽屉：托盘在上，面板（拉手）在下；拉开时托盘从 0 长到表单高度，把面板往下推 */}
      <div className='behind-app__admin-login-area' id='behind-admin-login'>
        <Slit open={open} keepTransition>
          <form className='behind-app__admin-entry' onSubmit={handleAdminLogin}>
            <div className='behind-app__admin-head'>
              <span className='behind-app__admin-rule' aria-hidden='true' />
              <span className='behind-app__admin-kicker'>Admin Login</span>
              <span className='behind-app__admin-rule' aria-hidden='true' />
            </div>
            <label className='behind-app__admin-sr-label' htmlFor='behind-admin-password'>
              管理员密码
            </label>
            <div className='behind-app__admin-row'>
              <Popover
                trigger={(
                  <input
                    id='behind-admin-password'
                    type='password'
                    value={admin_password}
                    autoComplete='current-password'
                    placeholder='管理员密码'
                    disabled={admin_submitting}
                    aria-invalid={admin_error !== ''}
                    aria-describedby={admin_error !== '' ? 'behind-admin-error' : undefined}
                    onChange={event => {
                      setAdminPassword(event.target.value)
                      if (admin_error !== '') {
                        setAdminError('')
                      }
                    }}
                  />
                )}
                content={(
                  <div
                    id='behind-admin-error'
                    className='behind-app__admin-error-message'
                    role='alert'
                  >
                    {admin_error}
                  </div>
                )}
                open={admin_error !== ''}
                onOpenChange={next_open => {
                  if (!next_open && admin_error !== '') {
                    setAdminError('')
                  }
                }}
                modal={false}
                side='top'
                align='center'
                offset={8}
                label='登录错误'
                className='behind-app__admin-error-popover'
              />
              <div className='behind-app__admin-submit'>
                <WhitePlasticButton
                  type='submit'
                  press={admin_submitting}
                >{admin_submitting ? '验证中…' : '进入'}</WhitePlasticButton>
              </div>
            </div>
          </form>
        </Slit>
      </div>
      <AdminPullHandle
        expanded={open}
        onToggle={next => {
          setOpen(next)
          if (!next) {
            setAdminError('')
          }
        }}
      />
    </div>
  )
}

// 与 Slit 的展开时长一致（components/Title 的 __OPENING_DURATION__）
const DRAWER_SLIDE_MS = 360
// ✋ 从面板下方伸到拉手上
const HAND_REACH_MS = 380
// 手搭在拉手上，停一下再握
const HAND_SETTLE_MS = 160
// ✊ 握住后跟着面板一起被拉下来，时长等于抽屉滑出
const HAND_PULL_MS = DRAWER_SLIDE_MS
// 松手：✋ 下移淡出
const HAND_RELEASE_MS = 180

type HandPhase = 'idle' | 'entering' | 'reaching' | 'gripped' | 'released'

function AdminPullHandle({ expanded, onToggle }: {
  expanded: boolean
  onToggle(next: boolean): void
}) {
  const uid = useId().replace(/:/g, '')
  const bar_gradient = `admin-pull-bar-${uid}`
  const cap_gradient = `admin-pull-cap-${uid}`
  const [hand_phase, setHandPhase] = useState<HandPhase>('idle')
  const timers = useRef<number[]>([])
  const animation_frame = useRef<number | null>(null)

  useEffect(() => () => {
    timers.current.forEach(timer => window.clearTimeout(timer))
    if (animation_frame.current !== null) {
      window.cancelAnimationFrame(animation_frame.current)
    }
  }, [])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const handleClick = () => {
    if (hand_phase !== 'idle') {
      return
    }
    // 已拉开：直接推回去，不播手
    if (expanded) {
      onToggle(false)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onToggle(true)
      return
    }

    // entering 先把手放到起点（下方、透明），下一帧再切到 reaching 才有过渡
    setHandPhase('entering')
    animation_frame.current = window.requestAnimationFrame(() => {
      animation_frame.current = window.requestAnimationFrame(() => {
        animation_frame.current = null
        setHandPhase('reaching')
        later(() => {
          setHandPhase('gripped')
          onToggle(true)
          later(() => {
            setHandPhase('released')
            later(() => setHandPhase('idle'), HAND_RELEASE_MS)
          }, HAND_PULL_MS)
        }, HAND_REACH_MS + HAND_SETTLE_MS)
      })
    })
  }

  const stage_class = [
    'behind-app__admin-pull-stage',
    expanded ? 'behind-app__admin-pull-stage--open' : '',
    hand_phase !== 'idle' ? `behind-app__admin-pull-stage--${hand_phase}` : '',
  ].filter(Boolean).join(' ')

  const fist = hand_phase === 'gripped'

  return (
    <div className={stage_class}>
      <button
        type='button'
        className='behind-app__admin-pull'
        aria-label={expanded ? '收起后台登录' : '拉开后台登录'}
        aria-expanded={expanded}
        aria-controls='behind-admin-login'
        aria-busy={hand_phase !== 'idle'}
        disabled={hand_phase !== 'idle'}
        onClick={handleClick}
      >
        <span className='behind-app__admin-pull-label' aria-hidden='true'>Admin</span>
        <span className='behind-app__admin-pull-led' aria-hidden='true' />
        <span className='behind-app__admin-pull-grip' aria-hidden='true'>
          <svg
            className='behind-app__admin-pull-graphic'
            viewBox='0 0 132 32'
            focusable='false'
          >
            <defs>
              <linearGradient id={bar_gradient} x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0' stopColor='#fbfcfc' />
                <stop offset='0.3' stopColor='#d5dbdd' />
                <stop offset='0.55' stopColor='#9aa5a9' />
                <stop offset='0.8' stopColor='#c3cacc' />
                <stop offset='1' stopColor='#6f7a7f' />
              </linearGradient>
              <radialGradient id={cap_gradient} cx='0.4' cy='0.35' r='0.7'>
                <stop offset='0' stopColor='#f4f6f6' />
                <stop offset='0.6' stopColor='#aab3b6' />
                <stop offset='1' stopColor='#6c777b' />
              </radialGradient>
            </defs>
            {/* 拉手离开面板几毫米：下方一道柔和的落影 */}
            <rect x='14' y='19' width='104' height='9' rx='4.5' fill='#1d262b' opacity='0.16' />
            {/* 两端底座 */}
            <circle cx='16' cy='15' r='8' fill={`url(#${cap_gradient})`} stroke='#7d878b' strokeWidth='0.8' />
            <circle cx='116' cy='15' r='8' fill={`url(#${cap_gradient})`} stroke='#7d878b' strokeWidth='0.8' />
            {/* 横杆 */}
            <rect x='12' y='9' width='108' height='12' rx='6' fill={`url(#${bar_gradient})`} stroke='#6f7a7f' strokeWidth='0.8' />
            <rect x='18' y='11' width='96' height='2' rx='1' fill='#ffffff' opacity='0.85' />
          </svg>
        </span>
      </button>
      <span className='behind-app__admin-pull-hand' aria-hidden='true'>
        {fist ? '✊' : '✋'}
      </span>
    </div>
  )
}
