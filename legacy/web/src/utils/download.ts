export type Opts = {
  url: string
  headers?: HeadersInit,
  onProgress?: (info: { loaded: number, total: number, percent: number }) => void
}

const __success_status = [200, 304]

export default async function download(opts: Opts): Promise<Blob> {
  const {
    url,
    headers = {},
    onProgress,
  } = opts

  const res = await fetch(url, { headers, redirect: 'manual', credentials: 'omit' })

  if (res.status === 0) {
    throw new Error('network error: res.status = 0')
  } else if (res.status === 302 || res.status === 301) {
    const redirect_url = res.headers.get('Location')
    if (typeof redirect_url !== 'string' || redirect_url.length === 0) {
      throw new Error('redirect url invalid')
    } else {
      return await download({
        ...opts,
        url: redirect_url,
        headers: { ...headers, 'Origin': window.location.origin }
      })
    }
  } else if ( !__success_status.includes(res.status) ) {
    throw new Error(`fetch failed: ${res.status}`)
  } else {
    const content_encoding = res.headers.get('content-encoding')
    const content_length = res.headers.get(content_encoding ? 'x-file-size' : 'content-length')
    const has_content_length = content_length !== null
    const need_use_progress = has_content_length && (typeof onProgress === 'function')

    if (res.body && has_content_length && need_use_progress) {
      const body = res.body
      const total = parseInt(content_length, 10)
      const callProgress = onProgress
      let loaded = 0
      const new_res = new Response(
        new ReadableStream({
          start(controller) {
            const reader = body.getReader()
            readChunk()
            function readChunk() {
              reader.read().then(({done, value}) => {
                if (done) {
                  controller.close()
                } else {
                  loaded += value.byteLength
                  callProgress({ loaded, total, percent: loaded / total })
                  controller.enqueue(value)
                  readChunk()
                }
              }).catch(error => {
                console.error(error)
                controller.error(error)
              })
            }
          }
        })
      )
      return await new_res.blob()
    } else {
      return await res.blob()
    }
  }
}
