import React, { ReactNode, useContext, useEffect, useMemo, useState } from 'react'
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
import { Gallery, PhotoNormal } from 'api/photo'
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
      setPhoto: (photo) => set(() => ({ photo }))
    }),
    // {  },
    { name: 'submission-store' },
  ),
)
Object.assign(window, { useSubmissionStore })

function RenderContent({ Content, changeScript }: { Content: Content; changeScript(s: Script): void }) {
  return useMemo(() => {
    if (typeof Content === 'function') {
      return <Content changeScript={changeScript} />
    } else {
      return <>{Content}</>
    }
  }, [Content, changeScript])
}

function ScriptPlayerSelects({
  selects,
  onClickSelect,
  changeScript,
}: { selects: Select[]; onClickSelect: (i: number) => void; changeScript: (s: Script) => void }) {
  if (!selects.length) {
    return <></>
  } else {
    return (
      <ul className={s.ScriptPlayerSelects}>
        {
          selects.map((s, idx) => (
            <li
              className="script-player-select"
              key={idx}
              onClick={thunkify(onClickSelect)(idx)}
            >
              <RenderContent Content={ s.Content } changeScript={changeScript} />
            </li>
          ))
        }
      </ul>
    )
  }
}

function ScriptPlayer({ script, changeScript }: { script: Script; changeScript: (s: Script) => void }) {
  return (
    <div className={s.ScriptPlayer}>
      <div className="script-player-text">
        <RenderContent Content={ script.Content } changeScript={changeScript} />
      </div>
      <ScriptPlayerSelects
        selects={script.selects}
        changeScript={changeScript}
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
