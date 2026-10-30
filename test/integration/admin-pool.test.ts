import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestContext, type TestContext } from '../helpers/app'

let ctx: TestContext

beforeEach(async () => {
  ctx = await createTestContext()
})

afterEach(async () => {
  await ctx.close()
})

describe('adminFetchPool', () => {
  it('returns the complete admin Pool through one query', async () => {
    const member = await ctx.createMember({ qq_num: 81001, name: 'Admin view' })
    const gallery = await ctx.createGallery({ name: 'Full pool' })
    await ctx.createPhoto({
      gallery_id: gallery.id as number,
      member_id: member.id as number,
      desc: 'visible in admin',
    })

    const response = await ctx.adminQuery('adminFetchPool')
    expect(response.status).toBe(200)

    const pool = response.body.data
    expect(pool.schema_version).toBe(2)
    expect(pool.galleries).toHaveLength(1)
    expect(pool.galleries[0].name).toBe('Full pool')
    expect(pool.galleries[0].photos[0].desc).toBe('visible in admin')
    expect(pool.galleries[0].vote_records).toEqual([])
    expect(pool.members[0].qq_num).toBe(81001)

    const no_auth = await ctx.app.request('/admin/query/adminFetchPool', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: {} }),
    })
    expect(no_auth.status).toBe(401)
  })
})
