import type { EnvConfig } from '../config'
import type { InstanceConfig } from '../config/instance'
import { galleryCanSubmission, galleryInEvent } from '../core/Gallery'
import { poolGalleriesSorted, type Pool } from '../core/Pool'
import type { ClientPhotosEvent, ClientMembersEvent } from '../../shared/client-pool'
import { BUILD_DATE, GIT_HASH } from '../../shared/build-info'
import { adminPoolDto } from './serializers'
import { toClientPool } from './to-client-pool'

export type PoolJsonCache = {
  pool: Pool
  instance_config: InstanceConfig
  instance_hash: string
  in_event_key: string
  photos_json: string
  members_json: string
  client_pool_json: string
  admin_pool_json: string
}

export type PoolEventsSnapshot = {
  photos_json: string
  members_json: string
  admin_json: string
}

export function poolInEventKey(pool: Pool, now: Date): string {
  return poolGalleriesSorted(pool)
    .map(gallery => (
      `${Number(gallery.id)}:${galleryInEvent(now, gallery) ? 1 : 0}:${galleryCanSubmission(now, gallery) ? 1 : 0}`
    ))
    .join('|')
}

export function nextGalleryBoundary(pool: Pool, now: Date): number | null {
  const now_ms = now.getTime()
  let next: number | null = null
  for (const gallery of poolGalleriesSorted(pool)) {
    for (const boundary of [
      gallery.event_start.getTime(),
      gallery.submission_expire.getTime(),
      gallery.event_end.getTime(),
    ]) {
      if (boundary > now_ms && (next === null || boundary < next)) {
        next = boundary
      }
    }
  }
  return next
}

export function buildPoolJsonCache(options: {
  pool: Pool
  env: EnvConfig
  instance_config: InstanceConfig
  instance_hash: string
  app_startup_time: number
  now: Date
}): PoolJsonCache {
  const { pool, env, instance_config, instance_hash, app_startup_time, now } = options
  const version_time = Date.now()

  const client_pool = toClientPool(pool, now, {
    instance_hash,
    app_startup_time,
    version_time,
    build_date: BUILD_DATE,
    git_hash: GIT_HASH,
  })

  const galleries = client_pool.galleries.map((gallery) => {
    if (gallery.in_event) {
      return { id: gallery.id, in_event: true as const, photos: gallery.photos }
    }
    return { id: gallery.id, in_event: false as const, photos: gallery.photos }
  })
  const photos_event: ClientPhotosEvent = { galleries }
  const members_event: ClientMembersEvent = { members: client_pool.members }

  const admin_pool = adminPoolDto({
    pool,
    env,
    instance_hash,
    app_startup_time,
    version_time,
    build_date: BUILD_DATE,
    git_hash: GIT_HASH,
    now,
    instance_config,
  })

  return {
    pool,
    instance_config,
    instance_hash,
    in_event_key: poolInEventKey(pool, now),
    photos_json: JSON.stringify(photos_event),
    members_json: JSON.stringify(members_event),
    client_pool_json: JSON.stringify(client_pool),
    admin_pool_json: JSON.stringify(admin_pool),
  }
}

export function getPoolEventsSnapshot(cache: PoolJsonCache): PoolEventsSnapshot {
  return {
    photos_json: cache.photos_json,
    members_json: cache.members_json,
    admin_json: cache.admin_pool_json,
  }
}
