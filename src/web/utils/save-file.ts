/**
 * 用系统自带的“存储为”对话框保存文件，并且能知道用户点的是“存储”还是“取消”。
 *
 * 只有 Chromium 系（Chrome / Edge 等）在安全上下文（https / localhost）里有 showSaveFilePicker；
 * Safari / Firefox 没有，网页也拿不到 <a download> 那个对话框的结果，这时返回 'unsupported'，由调用方在动画结束后下载。
 * 必须在用户点击的同一个调用栈里调用，否则浏览器会拒绝弹出对话框。
 */

type SaveFilePickerOptions = {
  suggestedName?: string
  types?: Array<{ description?: string; accept: Record<string, string[]> }>
}
type WritableFileStream = WritableStream & {
  write(data: Blob): Promise<void>
  close(): Promise<void>
  abort(): Promise<void>
}
export type SaveFileHandle = { createWritable(): Promise<WritableFileStream> }
type WindowWithPicker = Window & { showSaveFilePicker?: (opts?: SaveFilePickerOptions) => Promise<SaveFileHandle> }

export type SavePick =
  | { kind: 'saved'; handle: SaveFileHandle }
  | { kind: 'canceled' }
  /** 浏览器不支持，或因安全限制弹不出来：调用方改为直接下载 */
  | { kind: 'unsupported' }

export function canPickSaveFile(): boolean {
  return typeof (window as WindowWithPicker).showSaveFilePicker === 'function'
}

const IMAGE_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
}

/** 弹出系统“存储为”对话框。不支持时同步返回 null，调用方还在点击里，可以直接下载 */
export function pickSaveFile(suggested_name: string): Promise<SavePick> | null {
  const picker = (window as WindowWithPicker).showSaveFilePicker
  if (typeof picker !== 'function') {
    return null
  }
  const ext = suggested_name.split('.').pop()?.toLowerCase() ?? ''
  const mime = IMAGE_EXT[ext]
  return picker.call(window, {
    suggestedName: suggested_name,
    types: mime === undefined ? undefined : [{ description: '图片', accept: { [mime]: [`.${ext}`] } }],
  }).then(
    (handle): SavePick => ({ kind: 'saved', handle }),
    (err: unknown): SavePick => (
      err instanceof DOMException && err.name === 'AbortError'
        ? { kind: 'canceled' }
        : { kind: 'unsupported' }
    ),
  )
}

/** 用户已经选好位置之后，把文件内容写进去。拿不到内容时返回 false */
export async function writeSaveFile(handle: SaveFileHandle, url: string): Promise<boolean> {
  let writable: WritableFileStream | null = null
  try {
    const res = await fetch(url, { credentials: 'omit' })
    if (!res.ok) {
      throw new Error(`fetch failed: ${res.status}`)
    }
    const blob = await res.blob()
    writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  } catch {
    await writable?.abort().catch(() => undefined)
    return false
  }
}
