import { API_BASE } from '../api/dispatch'
import type { ClientMember, ClientPool, ClientPhotoBase } from '@shared/client-pool'

function baseName(filename: string): string {
  const index = filename.lastIndexOf('.')
  return index < 0 ? filename : filename.slice(0, index)
}

export function photoThumbFilename(src: string): string {
  return `${baseName(src)}.avif`
}

export function photoOptimizedFilename(src: string): string {
  return `${baseName(src)}-sdr.avif`
}

export function avatarThumbFilename(src: string): string {
  return `${baseName(src)}.avif`
}

function imageUrl(
  pool: Pick<ClientPool, 'instance_hash'>,
  kind: 'source' | 'optimized' | 'thumb',
  filename: string,
): string {
  const encoded = encodeURIComponent(filename)
  const url = `${API_BASE}images/${kind}/${encoded}`
  return kind === 'source' ? url : `${url}?v=${encodeURIComponent(pool.instance_hash)}`
}

export function photoSourceUrl(pool: ClientPool, photo: Pick<ClientPhotoBase, 'src'>): string {
  return imageUrl(pool, 'source', photo.src)
}

export function photoThumbUrl(pool: ClientPool, photo: Pick<ClientPhotoBase, 'src'>): string {
  return imageUrl(pool, 'thumb', photoThumbFilename(photo.src))
}

export function photoOptimizedUrl(pool: ClientPool, photo: Pick<ClientPhotoBase, 'src'>): string {
  return imageUrl(pool, 'optimized', photoOptimizedFilename(photo.src))
}

export function memberAvatarUrl(pool: ClientPool, member: Pick<ClientMember, 'avatar_src'>): string {
  return imageUrl(pool, 'thumb', avatarThumbFilename(member.avatar_src))
}

export function canUseCacheWorker(): boolean {
  const cache_worker_url = import.meta.env.VITE_CACHE_WORKER_URL
  return !import.meta.env.DEV
    && typeof cache_worker_url === 'string'
    && cache_worker_url.length > 0
}

export function transformCacheWorkerURL(url: string): string {
  const cache_worker_url = import.meta.env.VITE_CACHE_WORKER_URL
  if (!canUseCacheWorker() || typeof cache_worker_url !== 'string') {
    return url
  }
  return `${cache_worker_url}?target=${encodeURIComponent(url)}`
}
