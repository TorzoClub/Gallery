import {
  boundView, INITIAL_VIEW, shouldDismiss, TAP_DISTANCE, zoomView,
  type Point, type Size, type View,
} from './geometry'

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function createGestures(image: Size, viewport: Size, onChange: (view: View) => void, onDismiss: () => void) {
  const pointers = new Map<number, Point>()
  let view = { ...INITIAL_VIEW }
  let origin: Point = { x: 0, y: 0 }
  let startView = view
  let moved = false
  let multiple = false
  let canDismiss = true

  function update(next: View) {
    view = next
    onChange(view)
  }

  function rebase() {
    const first = pointers.values().next().value
    if (first !== undefined) origin = first
    startView = view
  }

  function down(id: number, point: Point) {
    if (pointers.size === 0) {
      moved = false
      multiple = false
      canDismiss = view.scale === 1
    }
    pointers.set(id, point)
    if (pointers.size > 1) {
      multiple = true
      canDismiss = false
      // A second finger cancels any one-finger dismissal displacement.
      update(boundView(view, image, viewport))
    }
    rebase()
  }

  function move(id: number, point: Point) {
    if (!pointers.has(id)) return
    const before = [...pointers.values()]
    pointers.set(id, point)
    const after = [...pointers.values()]
    const [a, b] = before
    const [c, d] = after
    if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
      const previousDistance = distance(a, b)
      if (previousDistance > 0) {
        update(zoomView(view, view.scale * distance(c, d) / previousDistance,
          midpoint(a, b), midpoint(c, d), image, viewport))
      }
      moved = true
      return
    }
    const dx = point.x - origin.x
    const dy = point.y - origin.y
    moved ||= Math.hypot(dx, dy) > TAP_DISTANCE
    if (!moved) return
    if (startView.scale > 1) {
      update(boundView({ ...startView, x: startView.x + dx, y: startView.y + dy }, image, viewport))
    } else if (canDismiss && !multiple) {
      update({ ...INITIAL_VIEW, y: dy })
    }
  }

  function up(id: number, point: Point) {
    if (!pointers.has(id)) return
    move(id, point)
    pointers.delete(id)
    if (pointers.size > 0) {
      rebase()
      return
    }
    if (!multiple && (!moved || (canDismiss && shouldDismiss(origin, point)))) {
      onDismiss()
    } else {
      update(boundView(view, image, viewport))
    }
  }

  function cancel(id: number) {
    if (!pointers.delete(id)) return
    multiple = true
    canDismiss = false
    update(boundView(view, image, viewport))
    rebase()
  }

  function zoom(factor: number, from: Point, to = from) {
    if (!Number.isFinite(factor) || factor <= 0) return
    canDismiss = false
    if (pointers.size > 0) multiple = true
    update(zoomView(view, view.scale * factor, from, to, image, viewport))
    rebase()
  }

  return {
    down, move, up, cancel, zoom,
    get view() { return view },
    get pointerCount() { return pointers.size },
    wheel(deltaX: number, deltaY: number, deltaMode: number, zooming: boolean, point: Point) {
      const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? viewport.height : 1
      if (zooming) {
        zoom(Math.exp(-deltaY * unit * 0.01), point)
      } else if (view.scale > 1) {
        update(boundView({ ...view, x: view.x - deltaX * unit, y: view.y - deltaY * unit }, image, viewport))
        rebase()
      }
    },
    resize(nextImage: Size, nextViewport: Size) {
      image = nextImage
      viewport = nextViewport
      canDismiss = false
      multiple = true
      update(boundView(view, image, viewport))
      rebase()
    },
  }
}
