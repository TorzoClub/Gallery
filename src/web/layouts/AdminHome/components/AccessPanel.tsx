import { type FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/dispatch'
import { login as adminLogin } from '@/admin/api/auth'
import { checkAdminToken, type TokenRejection, tokenRejectionOf } from '@/admin/api/client'
import { getToken, removeToken } from '@/admin/auth/token'
import { WhitePlasticButton } from '@/components/WhitePlasticButton'
import {
  ACCESS_GRANTED_SOUND_MS,
  playAccessAlarmSound,
  playAccessDeniedSound,
  playAccessGrantedSound,
  playAccessKeySound,
} from '@/utils/access-audio'
import { LedIndicator } from './LedIndicator'
import styles from './AccessPanel.module.css'

/*
 * idle       等待输入密码
 * checking   本地已有 token，正在向 /auth/check 核对
 * verifying  正在用密码登录
 * denied     密码登录被拒（ACCESS DENIED + 原因）
 * rejected   本地 token 无效 / 过期（INVALID TOKEN / EXPIRED TOKEN），已清掉，等待重新输入密码
 * granted    通过（LOGIN SUCCESS / IS LOGINED），播完闪烁后进入管理界面
 */
type Phase = 'idle' | 'checking' | 'verifying' | 'denied' | 'rejected' | 'granted'

const REJECTED_STATUS: Record<TokenRejection, string> = {
  invalid: 'INVALID TOKEN',
  expired: 'EXPIRED TOKEN',
}

/*
 * 通过后的时间线（从拿到 / 核对完 token 算起），密码登录和已有 token 两种情况完全一样，只是字不同：
 *   0ms     放成功音（两声上行“哔—哔”），屏上换成 LOGIN SUCCESS / IS LOGINED，常亮
 *   260ms   成功音放完，开始闪：灭 180ms、亮 220ms，共 3 次
 *   1460ms  闪完常亮，再停 240ms
 *   1700ms  交出 token，进入管理界面
 * 闪烁的时长写在 AccessPanel.module.css 的 .screenStatus[data-phase='granted']，两边要一起改。
 */
const GRANTED_BLINK_TIMES = 3
const GRANTED_BLINK_MS = 400
const GRANTED_HOLD_MS = 240
const GRANTED_TOTAL_MS = ACCESS_GRANTED_SOUND_MS + GRANTED_BLINK_TIMES * GRANTED_BLINK_MS + GRANTED_HOLD_MS

/*
 * 等待输入时提示行后面的点，节奏照 index.html 的 Loading：
 * 每 382ms 加一个，加到第 8 个时清空重来，所以屏上依次是 1～7 个、0 个、1 个……
 * 点不用字符（字体里没有半角“.”，“。”又太宽），用 LcdDot 画。
 */
const WAITING_DOT_MS = 382
const WAITING_DOT_MAX = 7

/**
 * 液晶屏上的一个半角点：宽 0.5em（与点阵字的半角字同宽）、高 1.25em（= 提示行的 line-height），
 * 2×2 像素的方点画在正中，所以点在整行的垂直中线上，而不是贴着基线 / 行底。
 * viewBox 按 16px 字号 1:1 画（8×20），一个单位就是点阵字的一个像素。
 */
function LcdDot() {
  return (
    <svg className={styles.lcdDot} viewBox='0 0 8 20' aria-hidden='true' focusable='false'>
      <rect x='3' y='9' width='2' height='2' />
    </svg>
  )
}

/**
 * 液晶屏用的是 guanzhi 8x8 base，这是个子集字体：屏上的字只用 A-Z、a-z、0-9 和空格（点用 LcdDot 画）。
 * 服务端的报错是中文，所以这里按状态码换成英文短句，不直接显示 message。
 */
function deniedReason(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'NO CONNECTION'
    }
    if (error.status === 401) {
      return 'WRONG PASSWORD'
    }
    if (error.status === 429) {
      return 'TOO MANY TRIES'
    }
    return `ERROR ${error.status}`
  }
  return 'UNKNOWN ERROR'
}

/**
 * 门禁：进入后台的唯一入口，挂在控制台主面板里（AdminConsoleShell）。
 * 一块带螺丝的拉丝金属面板：铭牌、液晶屏（状态 + 提示 / 报错）、密码框 + 开锁键、喇叭孔。
 *
 * 进来时本地已有 token：先向 /auth/check 核对（不读后台数据），通过就走和密码登录一样的成功流程，
 * 只是屏上写 IS LOGINED；token 无效 / 过期则清掉它、报警，屏上写 INVALID TOKEN / EXPIRED TOKEN，等待重新输入密码。
 *
 * 每输入 / 删除一个字符“哔”一声；成功、拒绝、报警各有一段蜂鸣。
 * 状态变化是瞬时的；动效只有：等待输入时提示后面的点一个个加、ACCESS DENIED / INVALID TOKEN / EXPIRED TOKEN 闪 3 次、
 * 通过后 LOGIN SUCCESS / IS LOGINED 闪 3 次再进管理界面。
 */
export function AccessPanel({ rejected, onGranted }: {
  /** 用着用着 token 失效被踢回来时传入（此时 token 已被清掉）：一进来就报警并显示原因 */
  rejected?: TokenRejection
  onGranted(token: string): void
}) {
  const [password, setPassword] = useState('')
  // 只在挂载时读一次本地 token；被踢回来时它已被清掉，读到的是空串
  const [stored_token] = useState(() => (rejected === undefined ? getToken() : ''))
  const [phase, setPhase] = useState<Phase>(() => (
    rejected !== undefined ? 'rejected' : stored_token !== '' ? 'checking' : 'idle'
  ))
  const [rejection, setRejection] = useState<TokenRejection>(rejected ?? 'invalid')
  const [granted_status, setGrantedStatus] = useState('LOGIN SUCCESS')
  const [message, setMessage] = useState('')
  const busy = useRef(false)
  const input_ref = useRef<HTMLInputElement>(null)

  const granted_timer = useRef<number | null>(null)
  const [dots, setDots] = useState(0)
  // 每次拒绝都加一，作为状态行的 key：连续两次被拒（比如连点两次空密码）也会重新闪
  const [denied_count, setDeniedCount] = useState(0)

  // 只在等待输入（Locked / token 被拒后）时走点；离开这个状态就清零，回来从 0 个开始
  const waiting = phase === 'idle' || phase === 'rejected'
  useEffect(() => {
    if (!waiting) {
      setDots(0)
      return
    }
    const timer = window.setInterval(() => {
      setDots(count => (count + 1 > WAITING_DOT_MAX ? 0 : count + 1))
    }, WAITING_DOT_MS)
    return () => window.clearInterval(timer)
  }, [waiting])

  // 有鼠标的设备在可以输入时直接把焦点放进密码框（核对 token 时输入框是锁住的，等它解锁）；触屏不自动弹键盘
  const can_type = phase === 'idle' || phase === 'rejected' || phase === 'denied'
  useEffect(() => {
    if (can_type && window.matchMedia('(pointer: fine)').matches) {
      input_ref.current?.focus({ preventScroll: true })
    }
  }, [can_type])

  useEffect(() => () => {
    if (granted_timer.current !== null) {
      window.clearTimeout(granted_timer.current)
    }
  }, [])

  // onGranted 由 AdminHome 用 useCallback 稳定下来，所以这三个回调不会每次渲染都变，下面核对 token 的 effect 只跑一次
  const grant = useCallback((token: string, status: string) => {
    playAccessGrantedSound()
    setGrantedStatus(status)
    setPhase('granted')
    granted_timer.current = window.setTimeout(() => {
      granted_timer.current = null
      onGranted(token)
    }, GRANTED_TOTAL_MS)
  }, [onGranted])

  const reject = useCallback((reason: TokenRejection) => {
    playAccessAlarmSound()
    setDeniedCount(count => count + 1)
    setRejection(reason)
    setPhase('rejected')
  }, [])

  const deny = useCallback((reason: string) => {
    playAccessDeniedSound()
    setDeniedCount(count => count + 1)
    setPhase('denied')
    setMessage(reason)
  }, [])

  // 被踢回来：一进来就报警（ref 防止开发模式 StrictMode 重复执行时响两遍）
  const alarmed = useRef(false)
  useEffect(() => {
    if (rejected !== undefined && !alarmed.current) {
      alarmed.current = true
      playAccessAlarmSound()
    }
  }, [rejected])

  // 本地已有 token：核对它。通过 → IS LOGINED；401 过期 / 403 无效 → 清 token、报警；连不上等其他错误 → ACCESS DENIED，token 留着
  useEffect(() => {
    if (stored_token === '') {
      return
    }
    let cancelled = false
    busy.current = true
    checkAdminToken(stored_token).then(
      () => {
        if (!cancelled) {
          grant(stored_token, 'IS LOGINED')
        }
      },
      (error: unknown) => {
        if (cancelled) {
          return
        }
        busy.current = false
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          removeToken()
          reject(tokenRejectionOf(error.status))
          return
        }
        deny(deniedReason(error))
      },
    )
    return () => {
      cancelled = true
      busy.current = false
    }
  }, [stored_token, grant, reject, deny])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!busy.current) {
      if (password.length === 0) {
        deny('ENTER PASSWORD')
        input_ref.current?.focus()
      } else {
        busy.current = true
        setPhase('verifying')
        setMessage('')
        try {
          const result = await adminLogin(password)
          grant(result.token, 'LOGIN SUCCESS')
        } catch (error) {
          busy.current = false
          deny(deniedReason(error))
          setPassword('')
          input_ref.current?.focus()
        }
      }
    }
  }

  const status = {
    idle: 'Locked',
    checking: 'VERIFYING',
    verifying: 'VERIFYING',
    denied: 'ACCESS DENIED',
    rejected: REJECTED_STATUS[rejection],
    granted: granted_status,
  }[phase]
  const hint = waiting
    ? <>ENTER PASSWORD{Array.from({ length: dots }, (_, index) => <LcdDot key={index} />)}</>
    : {
        checking: 'CHECKING TOKEN',
        verifying: 'PLEASE WAIT',
        denied: message,
        granted: 'WELCOME',
      }[phase as 'checking' | 'verifying' | 'denied' | 'granted']
  const locked = !can_type

  return (
    <form className={styles.panel} onSubmit={event => void submit(event)} aria-label='后台登录'>
      <span className={`${styles.screw} ${styles.screw0}`} aria-hidden='true' />
      <span className={`${styles.screw} ${styles.screw1}`} aria-hidden='true' />
      <span className={`${styles.screw} ${styles.screw2}`} aria-hidden='true' />
      <span className={`${styles.screw} ${styles.screw3}`} aria-hidden='true' />

      <div className={styles.plate}>
        <span className={styles.plateTitle}>ACCESS CONTROL</span>
        <span className={styles.plateSub}>Only Admin</span>
      </div>

      <div className={styles.screen} role='status' aria-live='polite'>
        <div
          key={phase === 'denied' || phase === 'rejected' ? `${phase}-${denied_count}` : phase}
          className={styles.screenStatus}
          data-phase={phase}
        >
          {status}
        </div>
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
          disabled={locked}
          aria-invalid={phase === 'denied' || phase === 'rejected'}
          onChange={event => {
            // 每输入或删掉一次（粘贴一整段也只算一次）“哔”一声
            playAccessKeySound()
            setPassword(event.target.value)
            if (phase === 'denied' || phase === 'rejected') {
              setPhase('idle')
              setMessage('')
            }
          }}
        />
        <WhitePlasticButton type='submit' press={locked} disabled={locked}>
          <span className={styles.unlock}>开锁</span>
        </WhitePlasticButton>
      </div>

      <div className={styles.foot}>
        <span
          className={styles.grille}
          aria-hidden='true'
        />
        <div className={styles.lamps}>
          <LedIndicator color={phase === 'verifying' || phase === 'checking' ? 'amber' : null} label='核对' />
          <LedIndicator color={phase === 'denied' || phase === 'rejected' ? 'red' : null} label='拒绝' />
        </div>
      </div>
    </form>
  )
}
