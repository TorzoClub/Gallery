export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type ImageRect = Size & { left: number; top: number }
export type View = Point & { scale: number }

export const INITIAL_VIEW: View = { x: 0, y: 0, scale: 1 }
export const MAX_SCALE = 5
export const DISMISS_DISTANCE = 100
export const TAP_DISTANCE = 8

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Preserve the existing fit rules, including the 50px margin for tall images.
export function fitImage(image: Size, viewport: Size): ImageRect {
  const ratio = image.height / image.width
  let width = viewport.width
  let height = width * ratio
  if (height > viewport.height) {
    height = Math.max(1, viewport.height - 100)
    width = height / ratio
  } else if (height / viewport.height > 0.8) {
    width = Math.max(1, width - 100)
    height = width * ratio
  }
  return { width, height, left: (viewport.width - width) / 2, top: (viewport.height - height) / 2 }
}

export function boundView(view: View, image: Size, viewport: Size): View {
  const scale = clamp(view.scale, 1, MAX_SCALE)
  const maxX = Math.max(0, (image.width * scale - viewport.width) / 2)
  const maxY = Math.max(0, (image.height * scale - viewport.height) / 2)
  return {
    scale,
    x: maxX === 0 ? 0 : clamp(view.x, -maxX, maxX),
    y: maxY === 0 ? 0 : clamp(view.y, -maxY, maxY),
  }
}

// Keep the image point under the gesture center fixed, even when that center moves.
export function zoomView(view: View, scale: number, from: Point, to: Point, image: Size, viewport: Size): View {
  const nextScale = clamp(scale, 1, MAX_SCALE)
  const ratio = nextScale / view.scale
  const center = { x: viewport.width / 2, y: viewport.height / 2 }
  return boundView({
    scale: nextScale,
    x: to.x - center.x - (from.x - center.x - view.x) * ratio,
    y: to.y - center.y - (from.y - center.y - view.y) * ratio,
  }, image, viewport)
}

export function shouldDismiss(start: Point, end: Point): boolean {
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  return dy > DISMISS_DISTANCE && dy > dx
}

export function viewTransform(view: View): string {
  return `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`
}

export function thumbnailTransform(from: ImageRect, to: ImageRect): string {
  const x = from.left + from.width / 2 - to.left - to.width / 2
  const y = from.top + from.height / 2 - to.top - to.height / 2
  return `translate3d(${x}px, ${y}px, 0) scale(${from.width / to.width}, ${from.height / to.height})`
}
