import React, { useEffect, useRef, useState } from 'react'
import TooManyTabsIcon from '../TooManyTabsIcon'
import { MAX_TABS } from '../../utils/tab-slot'
import styles from './index.module.scss'

type Page = 'main' | 'why'
type Flip = {
  target: Page
  direction: 'forward' | 'backward'
}

const FLIP_MS = 440

export default function TooManyTabs() {
  const [page, set_page] = useState<Page>('main')
  const [flip, set_flip] = useState<Flip | null>(null)
  const flip_timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    document.title = '同装摄影集 · 页面太多'
    return () => {
      if (flip_timer.current !== undefined) {
        window.clearTimeout(flip_timer.current)
      }
    }
  }, [])

  const turn = (next: Page) => {
    if (flip !== null || next === page) {
      return
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      set_page(next)
      return
    }
    set_flip({
      target: next,
      direction: next === 'why' ? 'forward' : 'backward',
    })
    flip_timer.current = window.setTimeout(() => {
      set_page(next)
      set_flip(null)
      flip_timer.current = undefined
    }, FLIP_MS)
  }

  const renderPage = (which: Page) => {
    if (which === 'main') {
      return (
        <section className={styles.mainPage} aria-label='页面数量超限'>
          <TooManyTabsIcon className={styles.icon} />
          <h1 className={styles.title}>页面开得太多了</h1>
          <p className={styles.lead}>
            由于连接限制，最多同时打开 {MAX_TABS} 个页面，请关闭一些标签页后再刷新。
          </p>
          <button
            type='button'
            className={styles.moreLink}
            disabled={flip !== null}
            onClick={() => turn('why')}
          >
            为什么会如此
          </button>
        </section>
      )
    }

    return (
      <section className={styles.whyPage} aria-label='连接限制说明'>
        <button
          type='button'
          className={styles.backLink}
          disabled={flip !== null}
          onClick={() => turn('main')}
        >
          ‹ 返回
        </button>
        <div className={styles.manualKicker}>Manual · Connection Limit</div>
        <h1 className={styles.whyTitle}>为什么会如此</h1>
        <p className={styles.whyLead}>
          因为浏览器不是一个可以无限打开页面的容器。每个同装摄影集页面都需要持续接收服务器推送，而浏览器的连接数是有限的。
        </p>

        <section className={styles.section}>
          <span className={styles.sectionIndex}>01</span>
          <div>
            <h2 className={styles.sectionTitle}>每个页面都占着一条连接</h2>
            <p className={styles.sectionText}>
              打开本站后，页面会与服务器建立一条用来接收相片和成员更新的长连接。它不是一次性的普通请求，而会一直保持到页面关闭或切到后台。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <span className={styles.sectionIndex}>02</span>
          <div>
            <h2 className={styles.sectionTitle}>浏览器有并发上限</h2>
            <p className={styles.sectionText}>
              在 HTTP/1.1 下，浏览器通常只允许同一个域名同时保留 6 条连接。页面、图片、接口和长连接都要排队使用它们。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <span className={styles.sectionIndex}>03</span>
          <div>
            <h2 className={styles.sectionTitle}>所以这里最多开 5 个页面</h2>
            <p className={styles.sectionText}>
              给普通请求和后台操作留出一条余量。超过 5 个实例时，新页面不会进入应用，也不会再建立新的长连接。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <span className={styles.sectionIndex}>04</span>
          <div>
            <h2 className={styles.sectionTitle}>关掉旧页面就会回来</h2>
            <p className={styles.sectionText}>
              页面占用的槽位由浏览器的 Web Locks 管理，关闭标签页后会自动释放。这个页面每秒会再检查一次，空出位置后会自动进入。
            </p>
          </div>
        </section>

      </section>
    )
  }

  const renderSheet = (which: Page, className = '', hidden = false) => (
    <div className={`${styles.sheet} ${className}`.trim()} aria-hidden={hidden || undefined}>
      <div className={styles.pageBody}>
        <header className={styles.docHeader}>TORZO GΛLLERY DOCUMENTION</header>
        <div className={styles.docContent}>{renderPage(which)}</div>
        <footer className={styles.docFooter}>位置：故障说明·连接数限制</footer>
      </div>
    </div>
  )

  const current_class = flip === null
    ? ''
    : flip.direction === 'forward'
      ? styles.flipAway
      : styles.under

  return (
    <main className={styles.page} role='alert'>
      <div className={styles.notebook}>
        <div className={styles.backing} aria-hidden />
        <div className={styles.pages}>
          {flip?.direction === 'forward' && renderSheet(flip.target, styles.under, true)}
          {renderSheet(page, current_class)}
          {flip?.direction === 'backward' && renderSheet(flip.target, styles.flipBack, true)}
        </div>
        <div className={styles.spiral} aria-hidden />
      </div>
    </main>
  )
}
