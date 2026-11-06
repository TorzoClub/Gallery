type DownloadResult = { status: 'ready'; blob: Blob } | { status: 'failed' }
export type ImageDownload = {
  result: Promise<DownloadResult>
  abort: () => void
}

type Download = (url: string, signal: AbortSignal) => Promise<Blob>

async function fetchImage(url: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`)
  return response.blob()
}

// Called in the thumbnail click handler, before setting React state or starting animation.
// Fetch bytes only: creating an <img> here would allow AVIF decoding during the entrance.
export function downloadImage(url: string, download: Download = fetchImage): ImageDownload {
  const controller = new AbortController()
  const result = download(url, controller.signal).then<DownloadResult, DownloadResult>(
    blob => ({ status: 'ready', blob }),
    () => ({ status: 'failed' }),
  )
  return { result, abort: () => controller.abort() }
}

type PreparedImage<T> = { status: 'ready'; image: T } | { status: 'failed' | 'canceled' }

export async function prepareImage<T>(
  download: ImageDownload,
  entrance: Promise<unknown>,
  decode: (blob: Blob) => Promise<T>,
  signal: AbortSignal,
): Promise<PreparedImage<T>> {
  try {
    await entrance
    if (signal.aborted) return { status: 'canceled' }
    const result = await download.result
    if (signal.aborted) return { status: 'canceled' }
    if (result.status === 'failed') return result
    const image = await decode(result.blob)
    // A late decode must never update a closing or replaced viewer.
    return signal.aborted ? { status: 'canceled' } : { status: 'ready', image }
  } catch {
    return { status: signal.aborted ? 'canceled' : 'failed' }
  }
}
