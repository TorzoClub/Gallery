import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { login as adminLogin } from '@/admin/api/auth'
import { setToken } from '@/admin/auth/token'
import { getApiErrorMessage } from '@/admin/utils/errors'
import Popover from '@/components/Popover'
import { Slit } from '@/components/Title'
import { WhitePlasticButton } from '@/components/WhitePlasticButton'
import './index.css'

/**
 * 【已弃用】后台登录抽屉。
 *
 * 曾经放在 /behind 页里作为后台入口：铝灰面板 + 横杆拉手，✋ 伸过来握成 ✊ 把抽屉拉开，托盘里是登录表单。
 * 现在后台入口改成 Navigator 上的“A”按钮，登录在 /admin 的门禁（AccessPanel）里做，这个组件不再被任何页面使用。
 * 保留它是因为造型和交互还不错，以后可能复用；见 docs/designs.md 的“已弃用组件”。
 *
 * 用法（原来在 BehindApp.tsx 里）：
 *   <AdminLoginDrawer onLoginSuccess={() => navigate('/admin', { replace: true })} />
 */
export function AdminLoginDrawer(props: { onLoginSuccess(): void }) {
  const [open, setOpen] = useState(false)
  const [admin_password, setAdminPassword] = useState('')
  const [admin_error, setAdminError] = useState('')
  const [admin_submitting, setAdminSubmitting] = useState(false)
  const admin_submitting_ref = useRef(false)
  const input_id = `admin-login-drawer-password-${useId().replace(/:/g, '')}`
  const error_id = `${input_id}-error`
  const area_id = `${input_id}-area`

  // 抽屉拉开（Slit 展开 360ms）后把焦点放进密码框，用户可以直接输入
  useEffect(() => {
    if (!open) {
      return
    }
    const timer = window.setTimeout(() => {
      document.getElementById(input_id)?.focus({ preventScroll: true })
    }, DRAWER_SLIDE_MS)
    return () => window.clearTimeout(timer)
  }, [open, input_id])

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
    <div className='admin-login-drawer'>
      {/* 抽屉：托盘在上，面板（拉手）在下；拉开时托盘从 0 长到表单高度，把面板往下推 */}
      <div className='admin-login-drawer__login-area' id={area_id}>
        <Slit open={open} keepTransition>
          <form className='admin-login-drawer__entry' onSubmit={handleAdminLogin}>
            <div className='admin-login-drawer__head'>
              <span className='admin-login-drawer__rule' aria-hidden='true' />
              <span className='admin-login-drawer__kicker'>Admin Login</span>
              <span className='admin-login-drawer__rule' aria-hidden='true' />
            </div>
            <label className='admin-login-drawer__sr-label' htmlFor={input_id}>
              管理员密码
            </label>
            <div className='admin-login-drawer__row'>
              <Popover
                trigger={(
                  <input
                    id={input_id}
                    className='admin-login-drawer__password'
                    type='password'
                    value={admin_password}
                    autoComplete='current-password'
                    placeholder='管理员密码'
                    disabled={admin_submitting}
                    aria-invalid={admin_error !== ''}
                    aria-describedby={admin_error !== '' ? error_id : undefined}
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
                    id={error_id}
                    className='admin-login-drawer__error-message'
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
                className='admin-login-drawer__error-popover'
              />
              <div className='admin-login-drawer__submit'>
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
        controls={area_id}
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

function AdminPullHandle({ expanded, controls, onToggle }: {
  expanded: boolean
  controls: string
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
    'admin-login-drawer__pull-stage',
    expanded ? 'admin-login-drawer__pull-stage--open' : '',
    hand_phase !== 'idle' ? `admin-login-drawer__pull-stage--${hand_phase}` : '',
  ].filter(Boolean).join(' ')

  const fist = hand_phase === 'gripped'

  return (
    <div className={stage_class}>
      <button
        type='button'
        className='admin-login-drawer__pull'
        aria-label={expanded ? '收起后台登录' : '拉开后台登录'}
        aria-expanded={expanded}
        aria-controls={controls}
        aria-busy={hand_phase !== 'idle'}
        disabled={hand_phase !== 'idle'}
        onClick={handleClick}
      >
        <span className='admin-login-drawer__pull-label' aria-hidden='true'>Admin</span>
        <span className='admin-login-drawer__pull-led' aria-hidden='true' />
        <span className='admin-login-drawer__pull-grip' aria-hidden='true'>
          <svg
            className='admin-login-drawer__pull-graphic'
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
      <span className='admin-login-drawer__pull-hand' aria-hidden='true'>
        {fist ? '✊' : '✋'}
      </span>
    </div>
  )
}
