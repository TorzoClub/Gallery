import { useCallback, useEffect, useMemo, useRef } from 'react'
import { nextTick, Signal } from 'vait'

import { global_queue } from 'utils/queue-load'
import type { PhotoView } from 'pool/view'

const { isLoading: globalQueueIsLoading, load: globalQueueLoad } = global_queue

function useScrollDirection() {
  const previous_scroll_y = useRef<number>(window.scrollY)
  const direction = useRef<'down' | 'up'>('down')

  useEffect(() => {
    const on_scroll = () => {
      if (window.scrollY >= previous_scroll_y.current) {
        direction.current = 'down'
      } else {
        direction.current = 'up'
      }
      previous_scroll_y.current = window.scrollY
    }
    window.addEventListener('scroll', on_scroll)
    return () => window.removeEventListener('scroll', on_scroll)
  }, [])

  return useCallback(() => direction.current, [])
}

export function usePhotoPriority(
  photos: PhotoView[],
  refreshed: Signal,
): void {
  const get_direction = useScrollDirection()

  const thumb_by_id = useMemo(() => {
    return new Map(photos.map(photo => [photo.id, photo.thumb]))
  }, [photos])

  const resort = useCallback(() => {
    type Position = 'in_screen' | 'above' | 'bottom'
    const visible = photos.map((photo, index) => {
      const element = document.getElementById(`photo-${photo.id}`)
      if (element === null) {
        return undefined
      }
      const bounding = element.getBoundingClientRect()
      let position: Position
      if (bounding.y <= window.innerHeight && bounding.y + bounding.height > 0) {
        position = 'in_screen'
      } else if (bounding.y > window.innerHeight) {
        position = 'bottom'
      } else {
        position = 'above'
      }
      return { index, photo, bounding, position }
    }).filter((item): item is NonNullable<typeof item> => item !== undefined)

    visible.sort((left, right) => (
      left.bounding.y === right.bounding.y
        ? left.index - right.index
        : left.bounding.y - right.bounding.y
    ))

    const S_UP = 1
    const S_DOWN = -1
    const PRIORITY = {
      in_screen: { down: [S_DOWN, 60, 50], up: [S_UP, 60, 50] },
      bottom: { down: [S_DOWN, 40, 30], up: [S_DOWN, 30, 20] },
      above: { down: [S_UP, 30, 20], up: [S_UP, 40, 30] },
    } as const

    const member_priority = new Map<string, number>()
    visible.forEach(({ photo, position }, index) => {
      const src = thumb_by_id.get(photo.id)
      if (src === undefined) {
        return
      }
      const [direction, photo_coefficient, avatar_coefficient] = PRIORITY[position][get_direction()]
      const sort = direction * index
      globalQueueLoad(src, photo_coefficient * visible.length + sort)

      if (photo.member !== null) {
        const avatar = photo.member.avatar_thumb_url
        const next_priority = avatar_coefficient * visible.length + sort
        const current = member_priority.get(avatar)
        if (current === undefined || next_priority > current) {
          member_priority.set(avatar, next_priority)
          globalQueueLoad(avatar, next_priority)
        }
      }
    })
  }, [get_direction, photos, thumb_by_id])

  useEffect(() => {
    let mounted = true
    const resort_if_loading = () => {
      if (globalQueueIsLoading()) {
        void nextTick().then(() => {
          if (mounted) {
            resort()
          }
        })
      }
    }

    window.addEventListener('resize', resort_if_loading)
    window.addEventListener('scroll', resort_if_loading)
    const cancel = refreshed.receive(() => {
      resort()
      global_queue.startWorking()
    })

    return () => {
      mounted = false
      window.removeEventListener('resize', resort_if_loading)
      window.removeEventListener('scroll', resort_if_loading)
      cancel()
    }
  }, [refreshed, resort])
}
