import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createTestContext,
  type TestContext,
} from '../helpers/app'

let ctx: TestContext

beforeEach(async () => {
  ctx = await createTestContext()
})

afterEach(async () => {
  await ctx.close()
})

describe('dispatch authentication and envelopes', () => {
  it('supports public queries and rejects admin actions from public routes', async () => {
    const public_result = await ctx.query('listGalleries')
    expect(public_result.status).toBe(200)
    expect(public_result.body).toEqual({
      success: true,
      data: { active: null, galleries: [] },
    })

    const admin_result = await ctx.query('adminGetInstanceConfig')
    expect(admin_result.status).toBe(403)
    expect(admin_result.body.code).toBe('ADMIN_ONLY')
  })

  it('requires admin authentication', async () => {
    const response = await ctx.app.request('/admin/query/adminGetInstanceConfig', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: {} }),
    })
    expect(response.status).toBe(401)
    expect((await response.json() as any).success).toBe(false)
  })

  it('logs in and allows admin queries', async () => {
    const wrong = await ctx.app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    })
    expect(wrong.status).toBe(401)

    const token = await ctx.login()
    expect(token.length).toBeGreaterThan(10)

    const config = await ctx.adminQuery('adminGetInstanceConfig')
    expect(config.status).toBe(200)
    expect(config.body.data.image_thumb_size).toBe(640)
    expect(config.body.data.avif_source_quality).toBe(75)
    expect(config.body.data.image_processing_effort).toBe(8)
    expect(config.body.data.max_upload_bytes).toBe(16 * 1024 * 1024)
  })

  it('returns 404 for unknown actions and 400 for malformed JSON', async () => {
    const unknown = await ctx.query('doesNotExist')
    expect(unknown.status).toBe(404)
    expect(unknown.body.code).toBe('UNKNOWN_ACTION')

    const removed = await ctx.adminMutate('adminCleanUnusedImages')
    expect(removed.status).toBe(404)
    expect(removed.body.code).toBe('UNKNOWN_ACTION')

    const malformed = await ctx.app.request('/query/listGalleries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(malformed.status).toBe(400)
    expect((await malformed.json() as any).code).toBe('BAD_REQUEST')
  })

  it('runs with a configured API base path', async () => {
    const prefixed = await createTestContext({ api_base_path: '/torzo-gallery-server' })
    try {
      const response = await prefixed.app.request('/torzo-gallery-server/query/listGalleries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload: {} }),
      })
      expect(response.status).toBe(200)

      const health = await prefixed.app.request('/torzo-gallery-server/healthz')
      expect(health.status).toBe(200)
    } finally {
      await prefixed.close()
    }
  })
})
