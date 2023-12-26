import React, { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import s from './index.module.scss'
import { nth, partialRight, pipe, prop, thunkify } from 'ramda'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { Gallery, GalleryCommon, Member, PhotoInActive, PhotoNormal } from 'api/photo'
import { init as initScript } from './scripts'
import { Memo, Signal } from 'new-vait'

const [ getScriptID, setScriptID ] = Memo(0)
const generateScriptID = () => {
  setScriptID(getScriptID() + 1)
  return getScriptID()
}

export function script(Content: Content, selects: Select[]): Script {
  return {
    id: generateScriptID(),
    Content,
    show_select_timeout: 1000,
    selects,
  }
}

export function scriptAdvance(opts: Omit<Script, 'id'>): Script {
  return {
    id: generateScriptID(),
    ...opts
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
  id: number | string
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

type QQNum = string | null
type GalleryID = number | null
type State = {
  qq_num: QQNum
  gallery_id: GalleryID
  submission_expire: GalleryCommon['submission_expire'] | null
  photo: PhotoInActive | null
  setQQNum(v: QQNum): void
  // setGalleryId(v: GalleryID): void
  // setPhoto(v: PhotoInActive): void
}

export const useSubmissionStore = create<State>()(
  devtools(
    (set) => ({
      qq_num: null,
      gallery_id: null,
      submission_expire: null,
      photo: null,
      setQQNum: (qq_num) => set(() => ({ qq_num })),
      // setGalleryId: (gallery_id) => set(() => ({ gallery_id })),
      // setPhoto: (photo) => set(() => ({ photo })),
    }),
    { name: 'submission-store' },
  ),
)

export const _EVENT_ = {
  created: Signal<PhotoInActive>(),
  updated: Signal<PhotoInActive>(),
  canceled: Signal<PhotoInActive['id']>()
} as const

if (process.env.NODE_ENV === 'development') {
  Object.assign(window, { useSubmissionStore, _EVENT_ })
  // useSubmissionStore.setState({
  //   qq_num: '2333',
  //   photo: {
  //     'src_urlpath':'/src/1703346623310.jpg',
  //     'src_url':'http://127.0.0.1:7001/src/1703346623310.jpg',
  //     'thumb':'1703346623310.jpg',
  //     'thumb_urlpath':'/thumb/1703346623310.jpg',
  //     // 'thumb_url':'http://127.0.0.1:7001/thumb/1703346623310.jpg',
  //     thumb_url: 'https://pache.blog/torzo-gallery-server-dev/thumb/1703432262903.jpg',
  //     'id':203,
  //     'desc':'test',
  //     'src':'1703346623310.jpg',
  //     'width':692,
  //     'height':642,
  //     'vote_count':0,
  //     'index':0,
  //     'created_at':'2023-12-23T15:50:23.000Z',
  //     'updated_at':'2023-12-23T15:50:23.000Z',
  //     'gallery_id':17,
  //     member_id: null,
  //     member: null,
  //     is_voted: false,
  //     // '_member_id':12,
  //     // '_member':{'avatar_thumb':'1639559679733.jpg','avatar_thumb_url':'http://127.0.0.1:7001/thumb/1639559679733.jpg','id':12,'qq_num':498302569,'avatar_src':'1639559679733.jpg','name':'Vec','created_at':'2020-01-08T23:50:00.000Z','updated_at':'2021-12-15T09:14:42.000Z', member: null, member_id: null }
  //   }
  // })
}

export function useSubmissionEvent({
  created,
  updated,
  canceled,
}: {
  created(p: PhotoInActive): void
  updated(p: PhotoInActive): void
  canceled(p: PhotoInActive['id']): void
}) {
  useEffect(() => {
    _EVENT_.created.receive(created)
    _EVENT_.updated.receive(updated)
    _EVENT_.canceled.receive(canceled)
    return () => {
      _EVENT_.created.cancelReceive(created)
      _EVENT_.updated.cancelReceive(updated)
      _EVENT_.canceled.cancelReceive(canceled)
    }
  }, [canceled, created, updated])
}

function TextContentEffectChar({
  show,
  ch,
  hideClassName,
  showClassName
}: { show: boolean; ch: string; hideClassName: string; showClassName: string }) {
  if (show) {
    return <span className={[s.TextContentEffectChar, hideClassName].join(' ')}>{ch}</span>
  } else {
    return <span className={[s.TextContentEffectChar, showClassName].join(' ')}>{ch}</span>
  }
}

const INTERVAL_TIME = 42
export function textContentEffectTotalTime(
  init_time: number,
  Content: Content,
  interval = INTERVAL_TIME
): number {
  if (typeof Content === 'string') {
    return init_time + (Content.length * interval)
  } else {
    return 0
  }
}
type TextContentEffectProps = {
  textContent: string
  showContentWaittime: number
  interval?: number,
  onPlaying?(): void
  hideClassName?: string;
  showClassName?: string
}
export function TextContentEffect({
  textContent,
  showContentWaittime,
  onPlaying,
  interval = INTERVAL_TIME,
  hideClassName = s.TextContentEffectCharHide,
  showClassName = s.TextContentEffectCharShow,
 }: TextContentEffectProps) {
  const [cursor, setShowingCursor] = useState(0)
  const [ is_playing, setPlaying ] = useState(false)
  const [ is_played, setPlayed ] = useState(false)

  useEffect(() => {
    if (is_playing) {
      onPlaying && onPlaying()
    }
  }, [is_playing, onPlaying])

  useEffect(() => {
    if (is_played) { return }

    let int_handler: undefined | NodeJS.Timeout = undefined

    function playInterval() {
      int_handler = setInterval(() => {
        setPlaying(true)
        setShowingCursor(cursor => {
          if (cursor < textContent.length) {
            return cursor + 1
          } else {
            setPlaying(false)
            setPlayed(true)
            return textContent.length
          }
        })
      }, interval)
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
  }, [cursor, interval, is_played, showContentWaittime, textContent.length])

  const chel_list = useMemo(() => {
    return textContent.split('').map((ch, idx) => {
      const show = cursor <= idx
      return (
        <TextContentEffectChar
          key={`${idx}-${ch}`}
          showClassName={showClassName}
          hideClassName={hideClassName}
          show={show}
          ch={ch}
        />
      )
    })
  }, [cursor, hideClassName, showClassName, textContent])

  return (
    <span className={s.TextContentEffect}>
      {chel_list}
    </span>
  )
}

export function RenderContent({
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
      style={{
        listStyleType: show_list_item_icon ? 'disclosure-closed' : 'none'
      }}
    >
      <button
        onClick={onPress}
        style={{
          WebkitAppearance: 'none',
          appearance: 'none',
          margin: 0,
          padding: 0,
          border: 0,
          background: 'none',
          fontSize: '16px',
        }}
      >
        {inner}
      </button>
    </li>
  )
}

export function ScriptPlayerSelects({
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

export default function Submission({ gallery }: { gallery: Gallery }) {
  useEffect(() => {
    useSubmissionStore.setState({
      gallery_id: gallery.id,
      submission_expire: gallery.submission_expire
    })
  }, [gallery.id, gallery.photos.length, gallery.submission_expire])
  const first_script = useMemo(() => (
    initScript({ submission_expire: gallery.submission_expire })()
  ), [gallery.submission_expire])

  const [current_script, setCurrentScript] = useState<Script>(first_script)
  return (
    <div className={s.Submission}>
      <ScriptPlayer
        key={current_script.id}
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
