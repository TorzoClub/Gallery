import { useCallback, useEffect, useState } from 'react'
import { Wait, Memo, Signal, nextTick, Queue, WithPayload, timeout } from 'new-vait'
import { findListByProperty, removeListItemByIdx } from './common'

import download from './download'
import useSafeState from 'hooks/useSafeState'

export const __MAX_PARALLEL_NUMBER__ = 3

type LoadResult = {
  blob: Blob;
  blobUrl: string;
}

const [ globalQueueLoad, [getGlobalQueue, setGlobalQueue], global_cache ] = QueueLoad()
export { globalQueueLoad, getGlobalQueue, setGlobalQueue, global_cache }

Object.assign(window, { globalQueueLoad, getGlobalQueue, setGlobalQueue, global_cache })

function searchCache(src: string | undefined): readonly [boolean, string] {
  if (src === undefined) {
    return [false, '']
  } else {
    const task = global_cache.get(src)
    if (task) {
      return [true, task.blobUrl]
    } else {
      return [false, '']
    }
  }
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('reader.result !== "string"'))
      }
    }
    reader.readAsDataURL(blob)
    reader.onerror = reject
  })
}

export function useQueueload(loadsrc: string | undefined, need_base64_url: boolean = false) {
  const [ status, setStatus ] = useSafeState<'NONE' | 'LOADING' | 'LOADED' | 'FAILURE'>('LOADING')

  const [ cached, url ] = searchCache(loadsrc)

  const [ back_src, setBackSrc ] = useSafeState<string>(url)

  const retry = useCallback(async () => {
    console.log('retry')
    setStatus('LOADING')
    try {
      const { blob, blobUrl } = await globalQueueLoad(loadsrc || '')
      if (need_base64_url) {
        setBackSrc(await blobToBase64(blob))
      } else {
        setBackSrc(blobUrl)
      }
      setStatus('LOADED')
    } catch (err) {
      setStatus('FAILURE')
    }
  }, [loadsrc, need_base64_url, setBackSrc, setStatus])

  useEffect(() => {
    // if ((loadsrc === undefined) || (loadsrc.trim().length === 0)) {
    //   setStatus('NONE')
    // } else {
    //   retry()
    // }
    // if (status === 'NONE') {
    // }
    // if (status !== 'LOADING') {
    // }
    if ((loadsrc === undefined) || (loadsrc.trim().length === 0)) {
      setStatus('LOADING')
    } else {
      if (status === 'LOADING') {
        const [ cached, url ] = searchCache(loadsrc)
        if (cached) {
          setStatus('LOADED')
          setBackSrc(url)
        } else {
          retry()
        }
      }
    }
  }, [loadsrc, retry, setBackSrc, setStatus, status])

  return [ status, back_src, retry ] as const
  // return [status, back_src] as const
}

type Src = string
type LoadTask = {
  src: Src
  priority: number
}

export function QueueLoad() {
  const queue = WithPayload<LoadTask>(Queue())

  const [getQueue, setQueue] = Memo<LoadTask[]>([])
  const [getConcurrentTasks, setConcurrentTasks] = Memo<LoadTask[]>([])
  const cache = new Map<Src, LoadResult>()
  const loaded_signal = Signal<{ src: string, data: LoadResult }>()
  const load_failure_signal = Signal<{ src: string, e: any }>()

  loaded_signal.receive(({ src, data }) => {
    cache.set(src, data)
  })

  const removeTaskBySrc = (queue: LoadTask[], src: Src) =>
    removeListItemByIdx(
      queue,
      findListByProperty(queue, 'src', src)
    )

  const [isLoading, setLoading] = Memo(false)
  function startLoad() {
    if (getQueue().length === 0) {
      setLoading(false)
      return
    } else if (
      isLoading() &&
      ( getConcurrentTasks().length >= __MAX_PARALLEL_NUMBER__ )
    ) {
      return
    } else {
      setLoading(true)

      const [ task, ...remain_queue ] = getQueue()
      setQueue(remain_queue)

      const idx = findListByProperty(getConcurrentTasks(), 'src', task.src)
      if (idx === -1) {
        setConcurrentTasks([ task, ...getConcurrentTasks() ]);
        (async () => {
          const cached_data = cache.get(task.src)
          if (cached_data) {
            return cached_data.blob
          } else {
            return download({ url: task.src })
          }
        })()
        // .then(b => timeout(1580 - Math.floor(Math.random()*750)).then(() => b)) // 测试用
        .then(blob => {
          const data = {
            blob,
            blobUrl: URL.createObjectURL(blob)
          }
          const concurrent_tasks = getConcurrentTasks()
          setConcurrentTasks(removeTaskBySrc(concurrent_tasks, task.src))

          setLoading(false)
          loaded_signal.trigger({
            src: task.src,
            data
          })

          startLoad()
        })
        .catch(e => {
          const concurrent_tasks = getConcurrentTasks()
          setConcurrentTasks(removeTaskBySrc(concurrent_tasks, task.src))
          setLoading(false)

          load_failure_signal.trigger({ src: task.src, e })

          startLoad()
        })
      }
    }
  }

  function addTask(queue: LoadTask[], new_task: LoadTask) {
    const idx = queue.findIndex(t => {
      if (new_task.priority < t.priority) {
        return false
      } else {
        return true
      }
    })
    if (idx === -1) {
      return [ ...queue, new_task ]
    } else {
      return [
        ...queue.slice(0, idx),
        new_task,
        ...queue.slice(idx, queue.length)
      ]
    }
  }

  async function load(src: string, priority?: number): Promise<LoadResult> {
    // console.log('load')
    const cached_data = cache.get(src)
    if (cached_data) {
      return cached_data
    } else {
      const [data, setData, failure] = Wait<LoadResult>()

      const queue = getQueue()
      const idx = findListByProperty(queue, 'src', src)
      if (idx === -1) {
        const p = (priority === undefined) ? 1 : priority
        setQueue(addTask(queue, { src, priority: p }))
        nextTick().then(startLoad)
      } else {
        const task = queue[idx]
        setQueue(
          addTask(
            removeListItemByIdx(queue, idx),
            {
              src,
              priority: priority === undefined ? task.priority : priority
            }
          )
        )
      }

      const cancelLoadedHandler = loaded_signal.receive(
        (loaded: { src: Src, data: LoadResult }) => {
          if (loaded.src === src) {
            cancelLoadedHandler()
            cancelFailureHandler()
            setData(loaded.data)
          }
        }
      )

      const id = getId()

      const cancelFailureHandler = load_failure_signal.receive(
        ({ src: failure_src, e }) => {
          // console.log('!', failure_src)
          if (failure_src === src) {
            // console.log('failure_src', id, failure_src, src)
            cancelFailureHandler()
            cancelLoadedHandler()
            // console.warn('f')
            failure(e)
          }
        }
      )

      return data
    }
  }

  return [ load, [ getQueue, setQueue ], cache ] as const
}

let _id = 0
function getId() {
  return ++_id
}
