import { useEffect, useState } from 'react'
import { Wait, Memo, Signal, nextTick } from 'new-vait'
import { findListByProperty, removeListItemByIdx } from './common'

import download from './download'

type Load = {
  blob: Blob;
  blobUrl: string;
}

function searchCache(src: string | undefined): readonly [boolean, string] {
  if (src === undefined) {
    return [false, '']
  } else {
    const task = global_cache.get(src)
    if (task) {
      return [false, task.blobUrl]
    } else {
      return [false, '']
    }
  }
}

export function useQueueload(src: string | undefined) {
  const [ cached, url ] = searchCache(src)
  const [ loaded, setLoaded ] = useState(cached)
  const [ blobSrc, setBlobSrc ] = useState<string>(url)

  useEffect(() => {
    if (src) {
      let mounted = true
      globalQueueLoad(src).then(res => {
        if (mounted) {
          setBlobSrc(res.blobUrl)
          setLoaded(true)
        }
      })
      return () => { mounted = false }
    }
  }, [src])

  return [loaded, blobSrc] as const
}

export const MAX_PARALLEL_NUMBER = 3

type Src = string
type LoadTask = {
  src: Src
  priority: number
}

const [ globalQueueLoad, [getGlobalQueue, setGlobalQueue], global_cache ] = QueueLoad()
export { globalQueueLoad, getGlobalQueue, setGlobalQueue, global_cache }

export function QueueLoad() {
  const [getQueue, setQueue] = Memo<LoadTask[]>([])
  const [getConcurrentTasks, setConcurrentTasks] = Memo<LoadTask[]>([])
  const cache = new Map<Src, Load>()
  const loaded_signal = Signal<{ src: string, data: Load }>()

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
      ( getConcurrentTasks().length >= MAX_PARALLEL_NUMBER )
    ) {
      return
    } else {
      setLoading(true)

      const [ task, ...remain_queue ] = getQueue()
      setConcurrentTasks([ task, ...getConcurrentTasks() ])

      setQueue(remain_queue)

      download({
        url: task.src
      }).then(blob => {
        return {
          blob,
          blobUrl: URL.createObjectURL(blob)
        }
      }).then(data => {
        const concurrent_tasks = getConcurrentTasks()
        setConcurrentTasks(removeTaskBySrc(concurrent_tasks, task.src))

        setLoading(false)
        loaded_signal.trigger({
          src: task.src,
          data
        })
        startLoad()
      })
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

  async function load(src: string, priority?: number): Promise<Load> {
    const cached_data = cache.get(src)
    if (cached_data) {
      return cached_data
    } else {
      const [data, setData] = Wait<Load>()

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
            { src, priority: priority === undefined ? task.priority : priority }
          )
        )
      }

      loaded_signal.receive(
        function loadedHandler(loaded: { src: Src, data: Load }) {
          if (loaded.src === src) {
            loaded_signal.cancelReceive(loadedHandler)
            setData(loaded.data)
          }
        }
      )

      return data
    }
  }

  return [ load, [ getQueue, setQueue ], cache ] as const
}
