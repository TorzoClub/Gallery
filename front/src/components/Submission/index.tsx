import React, { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import s from './index.module.scss'
import { nth, partialRight, pipe, prop, thunkify } from 'ramda'

export function script(Content: Content, selects: Select[]): Script {
  return {
    Content,
    show_select_timeout: 1000,
    selects,
  }
}
export function select(Content: Content, next_script: Script): Select {
  return {
    Content,
    next_script
  }
}

export function jumpScript<T>(scriptFn: (...args: T[]) => Script, args: T[], waiting_time?: number) {
  return componentScript([], ({ changeScript }) => {
    useEffect(() => {
      const change = () => changeScript(
        scriptFn(...args)
      )
      if (waiting_time === undefined) {
        change()
      } else {
        const h = setTimeout(change, waiting_time)
        return () => clearTimeout(h)
      }
    }, [changeScript])
    return <></>
  })
}

export function componentScript(selects: Select[], Content: Content): Script {
  return script(Content, selects)
}

export type ChangeScript = (s: Script) => void
export type Content = string | ((p: { changeScript: ChangeScript }) => React.JSX.Element)

export type Select = {
  Content: Content
  next_script: Script
}

export type Script = {
  Content: Content
  show_content_waittime?: number
  show_select_timeout: number
  selects: Select[]
}

export type SubmissionContextValue = { stored_qq_num: string | null }
const SubmissionContext = React.createContext<SubmissionContextValue>({
  stored_qq_num: null
})
Object.assign(window, { SubmissionContext })

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { Gallery, Member, PhotoNormal } from 'api/photo'
import { init as initScript } from './scripts'

type QQNum = string | null
type GalleryID = number | null
type State = {
  qq_num: QQNum
  gallery_id: GalleryID
  photo: PhotoNormal | null
  setQQNum(v: QQNum): void
  setGalleryId(v: GalleryID): void
  setPhoto(v: PhotoNormal): void
}

export const useSubmissionStore = create<State>()(
  devtools(
    (set) => ({
      qq_num: null,
      gallery_id: null,
      photo: null,
      setQQNum: (qq_num) => set(() => ({ qq_num })),
      setGalleryId: (gallery_id) => set(() => ({ gallery_id })),
      setPhoto: (photo) => set(() => ({ photo })),
    }),
    { name: 'submission-store' },
  ),
)
Object.assign(window, { useSubmissionStore })

function TextContentEffectChar({ show, ch }: { show: boolean; ch: string }) {
  if (show) {
    return <span style={{ opacity: 0 }} className={s.TextContentEffectChar}>{ch}</span>
  } else {
    return <span className={s.TextContentEffectChar}>{ch}</span>
  }
}

const INTERVAL_TIME = 42
export function textContentEffectTotalTime(init_time: number, Content: Content): number {
  if (typeof Content === 'string') {
    return init_time + (Content.length * INTERVAL_TIME)
  } else {
    return 0
  }
}
export function TextContentEffect({
  textContent,
  showContentWaittime,
  onPlaying,
 }: { textContent: string; showContentWaittime: number; onPlaying?(): void }) {
  const [cursor, setShowingCursor] = useState(0)
  const [ is_playing, setPlaying ] = useState(false)

  useEffect(() => {
    if (is_playing) {
      onPlaying && onPlaying()
    }
  })

  useEffect(() => {
    let int_handler: undefined | NodeJS.Timeout = undefined

    function playInterval() {
      int_handler = setInterval(() => {
        setPlaying(true)
        setShowingCursor(cursor => {
          if (cursor < textContent.length) {
            return cursor + 1
          } else {
            setPlaying(false)
            return textContent.length
          }
        })
      }, INTERVAL_TIME)
    }

    if (cursor === 0) {
      const h = setTimeout(() => {
        playInterval()
      }, showContentWaittime)
      return () => {
        clearTimeout(h)
        if (int_handler !== undefined) {
          clearInterval(int_handler)
        }
      }
    } else {
      playInterval()
      return () => {
        if (int_handler !== undefined) {
          clearInterval(int_handler)
        }
      }
    }
  }, [cursor, showContentWaittime, textContent.length])

  const chel_list = useMemo(() => {
    return textContent.split('').map((ch, idx) => {
      const show = cursor <= idx
      return <TextContentEffectChar show={show} ch={ch} key={`${idx}-${ch}`} />
    })
  }, [cursor, textContent])

  return <div className={s.TextContentEffect}>{chel_list}</div>
}

function RenderContent({
  Content,
  changeScript,
  showContentWaittime,
}: { Content: Content; changeScript(s: Script): void; showContentWaittime: number }) {
  const is_component = typeof Content === 'function'
  return useMemo(() => {
    if (is_component) {
      return <Content changeScript={changeScript} />
    } else {
      return <TextContentEffect textContent={ Content } showContentWaittime={showContentWaittime} />
    }
  }, [Content, changeScript, is_component, showContentWaittime])
}

function Select({
  Content,
  show_wait,
  changeScript,
  onPress,
}: { Content: Content; changeScript(s: Script): void; show_wait: number; onPress(): void }) {
  const [show_list_item_icon, setShow] = useState(
    typeof Content === 'function'
  )
  const is_component = typeof Content === 'function'
  const inner = useMemo(() => {
    if (is_component) {
      return <Content changeScript={changeScript} />
    } else {
      return <TextContentEffect
        textContent={ Content }
        showContentWaittime={show_wait}
        onPlaying={() => setShow(true)}
      />
    }
  }, [Content, changeScript, is_component, show_wait])
  return (
    <li
      className={s.ScriptPlayerSelect}
      onClick={onPress}
      style={{
        listStyleType: show_list_item_icon ? 'disclosure-closed' : 'none'
      }}
    >
      {inner}
    </li>
  )
}

function ScriptPlayerSelects({
  selects,
  onClickSelect,
  changeScript,
  waittime,
}: {
  selects: Select[];
  onClickSelect: (i: number) => void;
  changeScript: (s: Script) => void
  waittime: number
}) {
  if (!selects.length) {
    return <></>
  } else {
    const select_play_time_list = selects.map(
      s => textContentEffectTotalTime(0, s.Content)
    )
    const add = (a: number, b: number) => a + b
    const sum = (nums: number[]) => nums.reduce(add, 0)

    return (
      <ul className={s.ScriptPlayerSelects}>
        {
          selects.map((s, idx) => (
            <Select
              key={idx}
              onPress={thunkify(onClickSelect)(idx)}
              Content={s.Content}
              changeScript={changeScript}
              show_wait={
                waittime +
                sum(select_play_time_list.slice(0, idx)) +
                (INTERVAL_TIME * 10) * idx
              }
            />
          ))
        }
      </ul>
    )
  }
}

function ScriptPlayer({ script, changeScript }: { script: Script; changeScript: (s: Script) => void }) {
  const { show_content_waittime = 0 } = script
  const { show_select_timeout } = script

  const show_selects_waittime = useMemo(() => {
    const t = textContentEffectTotalTime(
      Number(show_content_waittime),
      script.Content
    )
    if (t === 0) {
      return 0 + show_select_timeout
    } else {
      return t + show_select_timeout
    }
  }, [script.Content, show_content_waittime, show_select_timeout])

  return (
    <div className={s.ScriptPlayer}>
      <div className="script-player-text">
        <RenderContent showContentWaittime={show_content_waittime} Content={ script.Content } changeScript={changeScript} />
      </div>
      <ScriptPlayerSelects
        selects={script.selects}
        changeScript={changeScript}
        waittime={show_selects_waittime}
        onClickSelect={
          pipe(
            partialRight(nth, [script.selects]),
            prop('next_script') as any,
            changeScript
          )
        }
      />
    </div>
  )
}

type ScriptPlayerContext = {
  changeCurrentScript(s: Script): Promise<void>
}

export default function Submission({ gallery }: { gallery: Gallery }) {
  useEffect(() => {
    useSubmissionStore.setState({ gallery_id: gallery.id })
  }, [gallery.id])
  const first_script = initScript()()
  const [current_script, setCurrentScript] = useState<Script>(first_script)
  return (
    <div className={s.Submission}>
      <ScriptPlayer
        key={Date.now()}
        script={current_script}
        changeScript={s => {
          setTimeout(() => {
            setCurrentScript(() => s)
          })
        }}
      />
    </div>
  )
}
