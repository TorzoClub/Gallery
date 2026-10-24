import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestContext, type TestContext } from '../helpers/app'

const clients: string[] = []
let active: TestContext | undefined

afterEach(async () => {
  if (active !== undefined) {
    await active.close()
    active = undefined
  }
  for (const dir of clients.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

async function makeClient(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'torzo-client-'))
  clients.push(dir)
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true })
  await fs.writeFile(path.join(dir, 'index.html'), '<!doctype html><title>Torzo</title><div id="root"></div>')
  await fs.writeFile(path.join(dir, 'assets', 'app-abc123.js'), 'console.log("app")')
  await fs.writeFile(path.join(dir, 'bg.png'), 'png')
  await fs.writeFile(path.join(dir, 'manifest.json'), '{}')
  return dir
}

describe('SPA static serving', () => {
  it('serves HTML weak-cached, hashed assets and images strong-cached', async () => {
    const client_dir = await makeClient()
    active = await createTestContext({ client_dir })

    const root = await active.app.request('/')
    expect(root.status).toBe(200)
    expect(root.headers.get('cache-control')).toBe('no-cache')
    expect(await root.text()).toContain('id="root"')

    const deep = await active.app.request('/admin/dashboard')
    expect(deep.status).toBe(200)
    expect(deep.headers.get('cache-control')).toBe('no-cache')
    expect(await deep.text()).toContain('id="root"')

    const asset = await active.app.request('/assets/app-abc123.js')
    expect(asset.status).toBe(200)
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')

    const image = await active.app.request('/bg.png')
    expect(image.status).toBe(200)
    expect(image.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')

    const manifest = await active.app.request('/manifest.json')
    expect(manifest.status).toBe(200)
    expect(manifest.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  it('does not turn missing assets or API GETs into the SPA', async () => {
    const client_dir = await makeClient()
    active = await createTestContext({ client_dir })

    const missing_asset = await active.app.request('/assets/missing.js')
    expect(missing_asset.status).toBe(404)
    expect((await missing_asset.json() as any).code).toBe('NOT_FOUND')

    for (const pathname of ['/query/unknown', '/auth/login', '/images/x/y.png', '/healthz/unknown']) {
      const response = await active.app.request(pathname)
      expect(response.status).toBe(404)
      expect((await response.json() as any).code).toBe('NOT_FOUND')
    }
  })

  it('keeps API POSTs working alongside the SPA', async () => {
    const client_dir = await makeClient()
    active = await createTestContext({ client_dir })

    const query = await active.query('listGalleries')
    expect(query.status).toBe(200)
    expect(query.body.success).toBe(true)

    const login = await active.app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: active.env.admin_password }),
    })
    expect(login.status).toBe(200)
    expect((await login.json() as any).success).toBe(true)
  })
})
