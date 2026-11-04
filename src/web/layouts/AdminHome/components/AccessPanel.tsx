import { type FormEvent, useEffect, useRef, useState } from 'react'
import { login as adminLogin } from '@/admin/api/auth'
import { getApiErrorMessage } from '@/admin/utils/errors'
import { WhitePlasticButton } from '@/components/WhitePlasticButton'
import { LedIndicator } from './LedIndicator'
import styles from './AccessPanel.module.css'

type Phase = 'idle' | 'verifying' | 'denied'

/**
 * 门禁：后台登录界面，挂在控制台主面板里（AdminConsoleShell）。
 * 一块带螺丝的拉丝金属面板：铭牌、数码屏（状态 + 提示 / 报错）、密码框 + 开锁键、喇叭孔。
 * 状态变化全部瞬时，不加动画、不发声。
 */
export function AccessPanel({ notice, onGranted }: {
  /** 进来时屏上第二行的提示，例如“登录已失效” */
  notice?: string
  onGranted(token: string): void
}) {
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')
  const busy = useRef(false)
  const input_ref = useRef<HTMLInputElement>(null)

  // 有鼠标的设备直接把焦点放进密码框；触屏不自动弹键盘
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      input_ref.current?.focus({ preventScroll: true })
    }
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy.current) {
      return
    }
    if (password.length === 0) {
      setPhase('denied')
      setMessage('请输入管理员密码')
      input_ref.current?.focus()
      return
    }
    busy.current = true
    setPhase('verifying')
    setMessage('')
    try {
      const result = await adminLogin(password)
      onGranted(result.token)
    } catch (error) {
      setPhase('denied')
      setMessage(getApiErrorMessage(error, '登录失败'))
      setPassword('')
      input_ref.current?.focus()
    } finally {
      busy.current = false
    }
  }

  const status = phase === 'verifying' ? 'VERIFYING…' : phase === 'denied' ? 'ACCESS DENIED' : 'LOCKED'
  const hint = phase === 'denied'
    ? message
    : phase === 'verifying'
      ? '正在核对密码'
      : (notice ?? '请输入管理员密码')

  return (
    <form className={styles.panel} onSubmit={event => void submit(event)} aria-label='后台登录'>
      <span className={`${styles.screw} ${styles.screw0}`} aria-hidden='true' />
      <span className={`${styles.screw} ${styles.screw1}`} aria-hidden='true' />
      <span className={`${styles.screw} ${styles.screw2}`} aria-hidden='true' />
      <span className={`${styles.screw} ${styles.screw3}`} aria-hidden='true' />

      <div className={styles.plate}>
        <span className={styles.plateTitle}>ACCESS CONTROL</span>
        <span className={styles.plateSub}>Torzo Gallery · Admin</span>
      </div>

      <div className={styles.screen} role='status' aria-live='polite'>
        <div className={styles.screenStatus} data-phase={phase}>{status}</div>
        <div className={styles.screenHint}>{hint}</div>
      </div>

      <label className={styles.srOnly} htmlFor='admin-access-password'>管理员密码</label>
      <div className={styles.entry}>
        <input
          ref={input_ref}
          id='admin-access-password'
          className={styles.field}
          type='password'
          value={password}
          autoComplete='current-password'
          placeholder='管理员密码'
          disabled={phase === 'verifying'}
          aria-invalid={phase === 'denied'}
          onChange={event => {
            setPassword(event.target.value)
            if (phase === 'denied') {
              setPhase('idle')
              setMessage('')
            }
          }}
        />
        <WhitePlasticButton type='submit' press={phase === 'verifying'} disabled={phase === 'verifying'}>
          <span className={styles.unlock}>开锁</span>
        </WhitePlasticButton>
      </div>

      <div className={styles.foot}>
        <span className={styles.grille} aria-hidden='true' />
        <div className={styles.lamps}>
          <LedIndicator color={phase === 'verifying' ? 'amber' : null} label='核对' />
          <LedIndicator color={phase === 'denied' ? 'red' : null} label='拒绝' />
        </div>
      </div>
    </form>
  )
}
