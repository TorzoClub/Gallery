import pkg from '../../package.json'
import { useNavigate } from 'react-router-dom'

import './BehindApp.css'

import ReportCard, { type ReportCardRow } from './components/ReportCard'
import SkeuomorphismButton from './components/SkeuomorphismButton'

import __logo_src from './torzo-gallery-logo.jpg'

const __api_prefix = import.meta.env.VITE_API_PREFIX ?? 'N/A'
const __base_path = import.meta.env.VITE_BASE_PATH ?? 'N/A'

const REPORT_ROWS: readonly ReportCardRow[] = [
  ['Version', `v${pkg.version}`],
  ['Uptime', '4y 2m 1d'],
  ['Submissions', '245'],
  ['Votes', '2189'],
  ['API prefix', __api_prefix],
  ['Base path', __base_path],
]

export default function BehindApp() {
  const navigate = useNavigate()

  return (
    <section className='behind-app' aria-label='关于同装相册'>
      <div className='behind-app__inner'>
        <div className='behind-app__brand'>
          <img className='behind-app__logo' src={__logo_src} alt='Torzo Gallery' />
          <h1 className='behind-app__title'>{pkg.title}</h1>
          <time className='behind-app__year'>2 0 2 6</time>
        </div>
        <ReportCard className='behind-app__report' report={REPORT_ROWS} />
        <div className='behind-app__actions'>
          <SkeuomorphismButton onClick={() => {
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
