import pkg from '../../package.json'
import { useNavigate } from 'react-router-dom'

import './BehindApp.css'

import ReportCard, { type ReportCardRow } from './components/ReportCard'
import SkeuomorphismButton from './components/SkeuomorphismButton'

import __logo_src from './torzo-gallery-logo.jpg'
import { useEffect, useState } from 'react'

const REPORT_ROWS: readonly ReportCardRow[] = [
  ['Version', `v${pkg.version}`],
  ['Uptime', '4y2m1d'],
  ['Submissions', '245'],
  ['Votes', '2189'],
  ['API prefix', import.meta.env.VITE_API_PREFIX ?? 'N/A'],
  ['Base path', import.meta.env.VITE_BASE_PATH ?? 'N/A'],
]

export default function BehindApp() {
  const navigate = useNavigate()
  const [show_card, setShowCard] = useState(false)

  // WARNING: 为什么要采纳这种设计？
  // 因为 <ReportCard> 的首帧渲染过慢，画面会卡顿，于是就得做成：先显示出页面后
  // 再显示 ReportCard ，采用动画过渡的方式
  // 这是妥协。只能寄希望于未来，硬件性能提升和浏览器优化
  useEffect(() => {
    const h = setTimeout(() => setShowCard(true), 500)
    return () => clearTimeout(h)
  }, [])

  return (
    <section className='behind-app' aria-label='关于同装相册'>
      <div className='behind-app__inner'>
        <div className='behind-app__brand'>
          <img className='behind-app__logo' src={__logo_src} alt='Torzo Gallery' />
          <h1 className='behind-app__title'>{pkg.title}</h1>
          <time className='behind-app__year'>2 0 2 6</time>
        </div>
        <div className='behind-app__card-wrapper' style={{
          display: show_card ? '' : 'none',
        }}>
          <ReportCard
            className='behind-app__report'
            report={REPORT_ROWS}
          />
        </div>
        <div className='behind-app__actions'>
          <SkeuomorphismButton onClick={() => {
            setShowCard(true)
            navigate('/', { replace: true })
          }}>回到相册</SkeuomorphismButton>
          <div style={{ height: '22px' }} />
          <SkeuomorphismButton onClick={() => {
            navigate('/admin', { replace: true })
          }}>进入后台管理</SkeuomorphismButton>
        </div>
      </div>
    </section>
  )
}
