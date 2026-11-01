import { conflict } from '../common/error'
import { poolGalleriesSorted, type Pool } from './Pool'
import type { Gallery } from './Gallery'

export function galleryEventPeriodsOverlap(left: Gallery, right: Gallery): boolean {
  return (
    left.event_start.getTime() <= right.event_end.getTime() &&
    right.event_start.getTime() <= left.event_end.getTime()
  )
}

export function assertNoOverlappingGalleryEvents(pool: Pool): void {
  const galleries = poolGalleriesSorted(pool)
  for (let i = 0; i < galleries.length; i += 1) {
    for (let j = i + 1; j < galleries.length; j += 1) {
      const left = galleries[i]
      const right = galleries[j]
      if (left !== undefined && right !== undefined && galleryEventPeriodsOverlap(left, right)) {
        throw conflict('相册的活动期间不能有重合')
      }
    }
  }
}

/** Checks performed on every candidate Pool before it is installed. */
export function checkPool(pool: Pool): void {
  assertNoOverlappingGalleryEvents(pool)
}
