import { describe, expect, it, vi } from 'vitest'
import { downloadImage, prepareImage } from '../../src/web/components/Detail/image-loading'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const blob = new Blob(['image'])

describe('detail image loading', () => {
  it('starts the request synchronously, before any animation or rendering', async () => {
    const fetch = vi.fn(async () => blob)
    const download = downloadImage('/optimized.avif', fetch)
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('/optimized.avif', expect.any(AbortSignal))
    expect(await download.result).toEqual({ status: 'ready', blob })
  })

  it('does not decode a cached image until both entrance animations finish', async () => {
    const imageAnimation = deferred<void>()
    const maskAnimation = deferred<void>()
    const decode = vi.fn(async () => 'decoded image')
    const download = downloadImage('/optimized.avif', async () => blob)
    const ready = prepareImage(download, Promise.all([imageAnimation.promise, maskAnimation.promise]), decode, new AbortController().signal)
    await download.result
    expect(decode).not.toHaveBeenCalled()
    imageAnimation.resolve()
    await Promise.resolve()
    expect(decode).not.toHaveBeenCalled()
    maskAnimation.resolve()
    expect(await ready).toEqual({ status: 'ready', image: 'decoded image' })
    expect(decode).toHaveBeenCalledOnce()
  })

  it('waits for a slow download without holding up entrance completion', async () => {
    const network = deferred<Blob>()
    const decode = vi.fn(async () => 'decoded image')
    const download = downloadImage('/optimized.avif', () => network.promise)
    const ready = prepareImage(download, Promise.resolve(), decode, new AbortController().signal)
    await Promise.resolve()
    expect(decode).not.toHaveBeenCalled()
    network.resolve(blob)
    expect(await ready).toEqual({ status: 'ready', image: 'decoded image' })
  })

  it('aborts an in-flight network request on close', async () => {
    const download = downloadImage('/optimized.avif', (_url, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    download.abort()
    expect(await download.result).toEqual({ status: 'failed' })
  })

  it('never starts decoding if the viewer closes during entrance', async () => {
    const entrance = deferred<void>()
    const lifetime = new AbortController()
    const decode = vi.fn(async () => 'decoded image')
    const ready = prepareImage(downloadImage('/optimized.avif', async () => blob), entrance.promise, decode, lifetime.signal)
    lifetime.abort()
    entrance.resolve()
    expect(await ready).toEqual({ status: 'canceled' })
    expect(decode).not.toHaveBeenCalled()
  })

  it('does not publish a late decode after closing or replacing a session', async () => {
    const decoded = deferred<string>()
    const lifetime = new AbortController()
    const decodingStarted = deferred<void>()
    const ready = prepareImage(downloadImage('/optimized.avif', async () => blob), Promise.resolve(), () => {
      decodingStarted.resolve()
      return decoded.promise
    }, lifetime.signal)
    await decodingStarted.promise
    lifetime.abort()
    decoded.resolve('stale image')
    expect(await ready).toEqual({ status: 'canceled' })
  })

  it('handles network and decode failures without an unhandled rejection', async () => {
    const decode = vi.fn(async () => 'decoded image')
    const failedDownload = downloadImage('/optimized.avif', async () => { throw new Error('network failed') })
    await failedDownload.result
    expect(await prepareImage(failedDownload, Promise.resolve(), decode, new AbortController().signal)).toEqual({ status: 'failed' })
    expect(decode).not.toHaveBeenCalled()
    const failedDecode = await prepareImage(downloadImage('/optimized.avif', async () => blob), Promise.resolve(), async () => {
      throw new Error('invalid AVIF')
    }, new AbortController().signal)
    expect(failedDecode).toEqual({ status: 'failed' })
  })
})
