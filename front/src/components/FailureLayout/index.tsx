import React, {createContext, useMemo, useState } from 'react'
import s from './index.module.css'

type FailureLayoutContextType = string[]
export const FailureLayoutContext = createContext<FailureLayoutContextType>([])

export function useFailureLayout() {
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
    <FailureLayout errors={errors} />
  ] as const
}

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
  return (
    <article className={`${s.FailureLayout} ${s.crt}`}>
      <section>
        <p className={s.Title}>TORZO GALLERY FAILURE</p>
        <p>如果你看到了这个画面，<br />说明《同装相册》已经无法提供正常服务。</p>
        <p>你可以等会儿再来，说不定就好了。</p>
        <p>当然，幸灾乐祸也是可以的。</p>
      </section>

      <aside>
        <p className={s.Title}>ERROR DETAILS</p>
        {failures.map((f, idx) => {
          return <DetailsItem key={idx} failure={f} />
        })}
      </aside>
    </article>
  )
}
