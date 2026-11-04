import pkg from '../../package.json'
import { useNavigate } from 'react-router-dom'

import './BehindApp.css'

import ReportCard, { type ReportCardBuild, type ReportCardConfigInput, type ReportCardRow } from './components/ReportCard'

import BehindPhotoStack from './components/BehindPhotoStack'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useClientPool } from './pool/store'
import { formatUptime } from '@shared/uptime'
import Navigator from './components/Navigator'
import { identity, thunkify } from 'ramda'

// 名单簿会带上后台的成员表单等代码，懒加载，不进公开页首屏的包
const PublicMemberNotebook = lazy(() => import('./components/PublicMemberNotebook'))

const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? 'N/A'

/** 与 BehindApp.css 的三栏断点一致 */
const THREE_COLUMN_QUERY = '(min-width: 1600px)'

function useThreeColumn(): boolean {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(THREE_COLUMN_QUERY).matches
  ))
  useEffect(() => {
    const mq = window.matchMedia(THREE_COLUMN_QUERY)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return matches
}
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
  // 三栏并排时 System Reports 摆正，和左右两块一起排成一行；其他宽度保持组件默认的 -1°。
  // 只在跨断点时换对象，免得每次渲染都让 ReportCard 重算纸纹
  const three_column = useThreeColumn()
  const report_config = useMemo<ReportCardConfigInput | undefined>(
    () => (three_column ? { angle: 0 } : undefined),
    [three_column],
  )

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
  // ReportCard 的首帧渲染很重，直接和页面一起挂载会让切页明显卡顿（移动端尤其明显）。
  // thisIsDisplay 是“Behind 是当前频道”：PublicRoot 在换台切到 Behind 时置 true、离开时置 false，
  // 所以这里的 500ms 是从真正显示 Behind 之后开始算的。
  // Behind 离开后只是被 <Activity> 藏起来、不卸载，但卡片必须每次离开都卸掉、回来再等 500ms：
  // - 渲染条件带上 thisIsDisplay：离开时那次（藏起来的）渲染直接把卡片拿掉，不靠 effect
  //   （藏起来的子树里 effect 不会再跑）
  // - effect 清理时把 show_card 复位：Activity 藏起来会执行清理，回来那一帧 show_card 已是 false，
  //   卡片不会跟着页面同一帧挂上
  // 这是用显示生命周期换首帧流畅度的妥协；如果未来显著优化了 ReportCard，
  // 应该移除这层延迟，恢复普通的声明式挂载。
  useEffect(() => {
    if (!thisIsDisplay) {
      setShowCard(false)
      return
    }

    const h = window.setTimeout(() => setShowCard(true), 500)
    return () => {
      window.clearTimeout(h)
      setShowCard(false)
    }
  }, [thisIsDisplay])

  return (
    <section className='behind-app' aria-label='关于同装相册'>
      <div className='behind-app__inner'>
        <Navigator
          scene='behind'
          onClickPushButton={() => {
            navigate('/explore', { replace: true })
            setShowCard(false)
          }}
          onClickAdmin={() => {
            setShowCard(false)
            navigate('/admin', { replace: true })
          }}
        />
        {/*
          网格布局（见 BehindApp.css）：窄屏单列，品牌 → 名单簿 → System Reports；
          ≥ 800px 第一行左品牌、右 System Reports，第二行名单簿横跨两栏；
          ≥ 1600px 一行三栏：品牌 | System Reports | 名单簿。后台入口是 Navigator 上的“A”按钮
        */}
        <div className='behind-app__layout'>
          <div className='behind-app__brand'>
            <BehindPhotoStack pool={pool} play={thisIsDisplay} />
            <h1 className='behind-app__title'>{pkg.title}</h1>
            <AppYearLabel year={2026} />
          </div>

          {pool !== null && (
            <div className='behind-app__members'>
              <Suspense fallback={null}>
                <PublicMemberNotebook pool={pool} />
              </Suspense>
            </div>
          )}
          {/* 外壳常驻、≥ 800px 预留卡片高度：卡片晚 500ms 出现时，下面的名单簿不会往下跳 */}
          <div className='behind-app__card-wrapper'>
            {show_card && thisIsDisplay && (
              <ReportCard
                className='behind-app__report'
                config={report_config}
                report={report}
                build={build}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
