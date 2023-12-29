import React, {ReactNode, createContext, useEffect, useMemo, useRef, useState } from 'react'
import s from './index.module.css'

type FailureLayoutContextType = string[]
export const FailureLayoutContext = createContext<FailureLayoutContextType>([])

export function useFailureLayout(innerContent?: ReactNode) {
  const [errors, setErrors] = useState<FailureLayoutContextType>([])

  function showFailure(s: string) {
    setErrors(v => {
      return [
        s,
        ...v
      ]
    })
  }

  return [
    showFailure,
    Boolean(errors.length),
    <FailureLayoutContainer errors={errors}>{innerContent}</FailureLayoutContainer>
  ] as const
}

function FailureLayoutContainer({ errors, children }: { errors: unknown[], children: ReactNode }) {
  const [t, setT] = useState(false)
  useEffect(() => {
    if (errors.length) {
      const h = setTimeout(() => {
        setT(true)
      }, 1000)
      return () => clearTimeout(h)
    } else {
      const h = setTimeout(() => {
        setT(false)
      }, 1000)
      return () => clearTimeout(h)
    }
  }, [errors.length])

  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    const h = setTimeout(() => {
      setShowErrors(t)
    }, 1500)
    return () => clearTimeout(h)
  }, [t])

  return (
    <div className={`${s.FailureLayoutContainer}`} style={{ background: t ? 'black': undefined }}>
      <div className={t ? s.TurnOffEffect : ''}>
        <div style={t ? { overflow: 'auto', height: '100vh' } : {}}>
          { children }
        </div>
      </div>
      {
        !errors.length ? null : (
          <div
            className={showErrors ? s.TurnOnEffect : ''}
            style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, opacity: showErrors ? 1: 0 }}
          >
            <FailureLayout key={errors.length} errors={errors} />
          </div>
        )
      }
    </div>
  )
}

import guanzhi_font_url from '../../assets/guanzhi 8x8.ttf'

function DetailsItem({ defaultSpread = true,failure: f }: { defaultSpread?: boolean, failure: FailureInfo }) {
  const [spread, setSpread] = useState(defaultSpread)

  const spread_icon = useMemo(() => {
    if (spread) {
      return <span style={{ display: 'inline-block', transform: 'rotate(90deg)' }}>{'>'}</span>
    } else {
      return <span>{'>'}</span>
    }
  }, [spread])

  const title = useMemo(() => {
    if (f.detail) {
      return (
        <div onClick={() => setSpread(!spread)}>
          { spread_icon }
          <span style={{ paddingLeft: '0.25em' }}>{f.title}</span>
        </div>
      )
    } else {
      return (
        <div>
          <span>-</span>
          <span style={{ paddingLeft: '0.25em' }}>{f.title}</span>
        </div>
      )
    }
  }, [f.detail, f.title, spread, spread_icon])

  return (
    <div className={s.DetailsItem} style={{ marginBottom: '2px' }}>
      { title }
      { spread && (
        <div style={{ paddingLeft: 'calc(0.25em + 0.5em)' }}>
          <pre style={{ padding: '0', margin: '0', fontFamily: 'inherit' }}>{f.detail}</pre>
        </div>
      ) }
    </div>
  )
}

type FailureInfo = {
  title: string
  detail: string | undefined
}

export default function FailureLayout({ errors }: { errors: unknown[] }) {
  const inner_ref = useRef<HTMLDivElement>(null)
  const failures: FailureInfo[] = errors.map((e) => {
    if (e instanceof Error) {
      return {
        title: e.message,
        detail: e.stack
      }
    } else {
      return {
        title: String(e),
        detail: undefined
      }
    }
  })

  const [paddingTop, setPaddingTop] = useState<number | string>(0)

  useEffect(() => {
    const el = inner_ref.current
    if (el) {
      reset(el)
      // eslint-disable-next-line no-inner-declarations
      function reset(el: HTMLElement) {
        const v = (innerHeight - el.offsetHeight) / 2
        if (v < 0) {
          setPaddingTop('3em')
        } else {
          setPaddingTop(v)
        }
      }
      window.addEventListener('resize', () => reset(el))
      return () => window.removeEventListener('resize', () => reset(el))
    }
  }, [])

  return (
    <div className={`${s.FailureLayoutWrapper} ${s.crt}`}>
      <article className={`${s.FailureLayout}`}>
        <div className={`${s.FailureLayoutInner}`} ref={inner_ref} style={{ paddingTop }}>
          <section className={s.Section}>
            <h1 className={s.Title}>TORZO GALLERY FAILURE</h1>
            <p>如果你看到了这个画面，<br />说明《同装相册》已经无法提供正常服务。</p>
            <p>你可以等会儿再来，说不定就好了。</p>
            <p>当然，幸灾乐祸也是可以的。</p>
          </section>

          <SectionDetails failures={failures} />
        </div>
      </article>
    </div>
  )
}

import { globalQueueLoad } from 'utils/queue-load'

function useGuanzhiCompleteFont() {
  const [url, setURL] = useState<undefined | string>(undefined)
  useEffect(() => {
    globalQueueLoad(guanzhi_font_url).then((loaded) => {
      setURL(loaded.blobUrl)
    }).catch(() => {
      // 也要考虑出现加载失败的情况，这时候就不要考虑什么字体美观度了
      // 能显示出错误信息才重要
      setURL(guanzhi_font_url)
    })
  }, [])
  return url
}

function FontLoading() {
  const [str, setStr] = useState('')
  useEffect(() => {
    const h = setInterval(() => {
      setStr((str) => {
        if (str.length < 7) {
          return str + '◼'
        } else {
          return '◼'
        }
      })
    }, 1000)
    return () => clearInterval(h)
  }, [])
  return <>{str}</>
}

function SectionDetails(p: { failures: FailureInfo[] }) {
  const font_url = useGuanzhiCompleteFont()
  const isLoading = useMemo(() => font_url === undefined, [font_url])
  return (
    <>
      <section className={s.Section}>
        <h1 className={s.Title}>ERROR DETAILS</h1>
        <div className="CompleteFont">
          {
            isLoading ? <FontLoading /> : p.failures.map((f, idx) => {
              return <DetailsItem key={idx} failure={f} />
            })
          }
        </div>
      </section>
      <style>{`
        .CompleteFont {
          font-family: "guanzhi 8x8 complete";
        }
        @font-face {
          font-family: 'guanzhi 8x8 complete';
          ${ font_url ? `src: url("${font_url}") format('truetype');` : '' }
        }
      `}</style>
    </>
  )
}
