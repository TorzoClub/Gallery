import { pipe } from 'ramda'
import { useId, useMemo } from 'react'
import { Wait, Memo, Signal, nextTick } from 'new-vait'
import { findListByProperty, removeListItemByIdx } from './common'
import useSWR from 'swr'

import download from './download'
import useSafeState from 'hooks/useSafeState'

export const __MAX_PARALLEL_NUMBER__ = 5

type LoadResult = {
  blob: Blob;
  blobUrl: string;
}

export const global_queue = QueueLoad()

function searchCache(src: string | undefined): readonly [boolean, string] {
  if (src === undefined) {
    return [false, '']
  } else {
    const task = global_queue.cache.get(src)
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

const __swr_cfg = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  shouldRetryOnError: false,
}
export function useQueueload(loadsrc: string | undefined, need_base64_url: boolean = false) {
  const id = useId()
  const res = useSWR(`${id}-${loadsrc}-${need_base64_url}`, async () => {
    const { blob, blobUrl } = await global_queue.load(loadsrc || '')
    return need_base64_url ? await blobToBase64(blob) : blobUrl
  }, __swr_cfg)

  const status = useMemo(() => {
    if (res.isLoading || res.isValidating) {
      return 'LOADING'
    } else if (res.error) {
      return 'FAILURE'
    } else if (res.data) {
      return 'LOADED'
    } else {
      return 'NONE'
    }
  }, [res.data, res.error, res.isLoading, res.isValidating])

  const url = useMemo(() => res.data || '', [res.data])

  const retry = res.mutate

  return [ status, url, retry ] as const
}

type Src = string
type LoadTask = {
  src: Src
  priority: number
}

function resortQueue(queue: LoadTask[]) {
  return queue.sort((a, b) => b.priority - a.priority)
}

function addTask(queue: LoadTask[], new_task: LoadTask) {
  const idx = queue.findIndex(t => new_task.priority >= t.priority)
  if (idx === -1) {
    return queue.concat(new_task)
  } else {
    return queue.slice(0, idx).concat(
      [ new_task ], queue.slice(idx, queue.length)
    )
  }
}

const removeTaskBySrc = (queue: LoadTask[], src: Src) =>
  removeListItemByIdx(
    queue,
    findListByProperty(queue, 'src', src)
  )

export function QueueLoad() {
  const [getWorkingStatus, setWorkingStatus] = Memo(false)
  const [getQueue, setQueue] = Memo<LoadTask[]>([])
  const setQueueSafely = pipe(resortQueue, setQueue)

  const [getConcurrentTasks, setConcurrentTasks] = Memo<LoadTask[]>([])
  const cache = new Map<Src, LoadResult>()
  const loaded_signal = Signal<{ src: string, data: LoadResult }>()
  const load_failure_signal = Signal<{ src: string, e: any }>()

  loaded_signal.receive(({ src, data }) => {
    cache.set(src, data)
  })

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

          loaded_signal.trigger({
            src: task.src,
            data
          })

          startLoad()
        })
        .catch(e => {
          const concurrent_tasks = getConcurrentTasks()
          setConcurrentTasks(removeTaskBySrc(concurrent_tasks, task.src))

          console.warn('QueueLoad load failure:', e)
          load_failure_signal.trigger({ src: task.src, e })

          startLoad()
        })
      }
    }
  }

  async function load(src: string, priority?: number): Promise<LoadResult> {
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
        // nextTick().then(startLoad)
        nextTick().then(() => getWorkingStatus() && startLoad())
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

      const cancelFailureHandler = load_failure_signal.receive(
        ({ src: failure_src, e }) => {
          if (failure_src === src) {
            cancelFailureHandler()
            cancelLoadedHandler()
            failure(e)
          }
        }
      )

      return data
    }
  }

  function startWorking() {
    setWorkingStatus(true)
    getWorkingStatus() && startLoad()
  }

  return {
    load,
    startWorking,
    getQueue,
    setQueueSafely,
    isLoading,
    cache,
  }
}
