import { describe, expect, it } from 'vitest'
import { isApiLikePath } from '../../src/server/api'

describe('isApiLikePath', () => {
  it('routes backend paths to Hono', () => {
    for (const pathname of [
      '/query/listGalleries',
      '/mutate/vote',
      '/admin/query/adminFetchPool',
      '/admin/mutate/adminCreatePhoto',
      '/auth/login',
      '/upload-image',
      '/images/source/a.png',
      '/healthz',
    ]) {
      expect(isApiLikePath(pathname)).toBe(true)
    }
  })

  it('leaves SPA and Vite paths for the frontend handler', () => {
    for (const pathname of [
      '/',
      '/admin/login',
      '/admin/dashboard',
      '/@vite/client',
      '/src/main.tsx',
      '/node_modules/.vite/deps/react.js',
    ]) {
      expect(isApiLikePath(pathname)).toBe(false)
    }
  })

  it('supports a non-root API base path', () => {
    expect(isApiLikePath('/api/query/listGalleries', '/api')).toBe(true)
    expect(isApiLikePath('/api/images/source/a.png', '/api')).toBe(true)
    expect(isApiLikePath('/api/admin/login', '/api')).toBe(false)
    expect(isApiLikePath('/admin/dashboard', '/api')).toBe(false)
  })
})
