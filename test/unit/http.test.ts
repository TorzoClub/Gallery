import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getJson, postJson, unwrapApiResponse } from '../../src/web/api/http'
import { getApiErrorMessage } from '../../src/web/admin/utils/errors'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('native fetch API helper', () => {
  it('posts JSON and parses a JSON response', async () => {
    const fetch_mock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: true, data: { ok: 1 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetch_mock)

    const response = await postJson('/query/example', { value: 1 }, { timeout: 500 })
    expect(fetch_mock).toHaveBeenCalledTimes(1)
    const call = fetch_mock.mock.calls[0]!
    const [url, init] = call
    expect(url).toBe('/query/example')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ value: 1 }))
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(unwrapApiResponse<{ ok: number }>(response.status, response.data)).toEqual({ ok: 1 })
  })

  it('keeps a non-JSON response as text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('plain text', { status: 200 })))
    const response = await postJson('/query/text', {})
    expect(response.data).toBe('plain text')
  })

  it('does not throw on an HTTP error; unwrap does', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: false, code: 'BAD_REQUEST', message: 'bad input' }),
      { status: 400 },
    )))
    const response = await postJson('/mutate/example', {})
    expect(response.status).toBe(400)
    expect(() => unwrapApiResponse(response.status, response.data)).toThrowError(
      expect.objectContaining({ status: 400, code: 'BAD_REQUEST', message: 'bad input' }),
    )
  })

  it('sends GET without a body', async () => {
    const fetch_mock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: true, data: { ok: true } }),
      { status: 200 },
    ))
    vi.stubGlobal('fetch', fetch_mock)
    const response = await getJson('/auth/check', {
      timeout: 500,
      headers: { Authorization: 'Bearer token' },
    })
    const call = fetch_mock.mock.calls[0]!
    const [, init] = call
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer token' })
    expect(response.status).toBe(200)
  })

  it('maps a network failure to ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(postJson('/query/example', {})).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    })
  })

  it('maps a timeout to ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        reject(new DOMException('aborted', 'AbortError'))
      })
    })))
    await expect(postJson('/query/slow', {}, { timeout: 5 })).rejects.toMatchObject({
      status: 0,
      code: 'TIMEOUT',
    })
  })

  it('uses the timeout message in getApiErrorMessage', () => {
    expect(getApiErrorMessage(new ApiError(0, 'TIMEOUT', '请求超时，请稍后重试'))).toBe('请求超时，请稍后重试')
  })
})
