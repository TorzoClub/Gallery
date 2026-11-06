import { describe, expect, it, vi } from 'vitest'
import { createGestures } from '../../src/web/components/Detail/gestures'
import { boundView, fitImage, INITIAL_VIEW, shouldDismiss, zoomView } from '../../src/web/components/Detail/geometry'

const viewport = { width: 1000, height: 800 }
const image = { width: 1000, height: 800 }
const center = { x: 500, y: 400 }
function setup() {
  const change = vi.fn()
  const dismiss = vi.fn()
  return { gestures: createGestures(image, viewport, change, dismiss), change, dismiss }
}

describe('detail geometry', () => {
  it('preserves the existing landscape, near-full-height and portrait fit', () => {
    expect(fitImage({ width: 2000, height: 1000 }, viewport)).toEqual({ width: 1000, height: 500, left: 0, top: 150 })
    expect(fitImage({ width: 1000, height: 800 }, viewport)).toEqual({ width: 900, height: 720, left: 50, top: 40 })
    expect(fitImage({ width: 600, height: 1200 }, viewport)).toEqual({ width: 350, height: 700, left: 325, top: 50 })
    expect(fitImage({ width: 600, height: 1200 }, { width: 60, height: 60 }).height).toBeGreaterThan(0)
  })

  it('keeps a moving pinch anchor on the same image point', () => {
    const result = zoomView(INITIAL_VIEW, 2, { x: 600, y: 450 }, { x: 630, y: 480 }, image, viewport)
    expect(result).toEqual({ scale: 2, x: -70, y: -20 })
    expect(500 + result.x + 100 * result.scale).toBe(630)
    expect(400 + result.y + 50 * result.scale).toBe(480)
  })

  it('clamps zoom to 1–5 and keeps image edges within the viewport', () => {
    expect(boundView({ scale: 10, x: 9999, y: -9999 }, image, viewport)).toEqual({ scale: 5, x: 2000, y: -1600 })
    expect(boundView({ scale: 0.2, x: 300, y: -300 }, image, viewport)).toEqual(INITIAL_VIEW)
    expect(boundView({ scale: 2, x: 100, y: 100 }, { width: 200, height: 200 }, viewport)).toEqual({ scale: 2, x: 0, y: 0 })
  })

  it('requires a vertical displacement greater than 100px in either direction', () => {
    expect(shouldDismiss(center, { x: 500, y: 500 })).toBe(false)
    expect(shouldDismiss(center, { x: 500, y: 299 })).toBe(true)
    expect(shouldDismiss(center, { x: 500, y: 501 })).toBe(true)
    expect(shouldDismiss(center, { x: 800, y: 550 })).toBe(false)
  })
})

describe('detail gestures', () => {
  it.each([-120, 120])('dismisses on a %ipx single-finger vertical drag', offset => {
    const { gestures, dismiss } = setup()
    gestures.down(1, center)
    gestures.move(1, { x: 500, y: 400 + offset })
    expect(gestures.view.y).toBe(offset)
    gestures.up(1, { x: 500, y: 400 + offset })
    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('preserves tap-to-close with small touch jitter', () => {
    const { gestures, dismiss } = setup()
    gestures.down(1, center)
    gestures.up(1, { x: 502, y: 401 })
    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('resets a short or horizontal drag without closing', () => {
    const { gestures, dismiss } = setup()
    gestures.down(1, center)
    gestures.up(1, { x: 700, y: 480 })
    expect(dismiss).not.toHaveBeenCalled()
    expect(gestures.view).toEqual(INITIAL_VIEW)
  })

  it('pinches, then pans with the remaining finger without a jump or dismissal', () => {
    const { gestures, dismiss } = setup()
    gestures.down(1, { x: 400, y: 400 })
    gestures.down(2, { x: 600, y: 400 })
    gestures.move(1, { x: 300, y: 400 })
    gestures.move(2, { x: 700, y: 400 })
    expect(gestures.view.scale).toBeCloseTo(2)
    expect(gestures.view.x).toBeCloseTo(0)
    gestures.up(2, { x: 700, y: 400 })
    gestures.move(1, { x: 340, y: 550 })
    expect(gestures.view.x).toBeCloseTo(40)
    expect(gestures.view.y).toBeCloseTo(150)
    gestures.up(1, { x: 340, y: 550 })
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('does not close when a pinch returns to 1x and a remaining finger drags', () => {
    const { gestures, dismiss } = setup()
    gestures.down(1, { x: 400, y: 400 })
    gestures.down(2, { x: 600, y: 400 })
    gestures.move(1, { x: 450, y: 400 })
    gestures.up(2, { x: 600, y: 400 })
    gestures.up(1, { x: 450, y: 600 })
    expect(gestures.view).toEqual(INITIAL_VIEW)
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('cancels a pending dismissal when another finger arrives', () => {
    const { gestures, dismiss } = setup()
    gestures.down(1, center)
    gestures.move(1, { x: 500, y: 550 })
    gestures.down(2, { x: 700, y: 550 })
    expect(gestures.view.y).toBe(0)
    gestures.up(2, { x: 700, y: 550 })
    gestures.up(1, { x: 500, y: 550 })
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('handles pointer cancellation and allows a fresh gesture afterward', () => {
    const { gestures, dismiss } = setup()
    gestures.down(1, center)
    gestures.move(1, { x: 500, y: 600 })
    gestures.cancel(1)
    gestures.up(1, { x: 500, y: 600 })
    expect(gestures.view).toEqual(INITIAL_VIEW)
    expect(dismiss).not.toHaveBeenCalled()
    gestures.down(2, center)
    gestures.up(2, center)
    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('supports ctrl-wheel trackpad zoom and ordinary two-finger pan', () => {
    const { gestures, dismiss } = setup()
    gestures.wheel(0, -Math.log(2) / 0.01, 0, true, center)
    expect(gestures.view.scale).toBeCloseTo(2)
    gestures.wheel(40, -60, 0, false, center)
    expect(gestures.view.x).toBe(-40)
    expect(gestures.view.y).toBe(60)
    gestures.wheel(0, 10000, 0, true, center)
    expect(gestures.view).toEqual(INITIAL_VIEW)
    gestures.wheel(0, 500, 0, false, center)
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('normalizes wheel lines and supports Safari scale gestures', () => {
    const { gestures } = setup()
    gestures.wheel(0, -1, 1, true, center)
    expect(gestures.view.scale).toBeCloseTo(Math.exp(0.16))
    gestures.zoom(2, center)
    expect(gestures.view.scale).toBeCloseTo(Math.exp(0.16) * 2)
    gestures.zoom(Number.NaN, center)
    expect(Number.isFinite(gestures.view.scale)).toBe(true)
  })

  it('pans zoomed images without dismissing and clamps after resize', () => {
    const { gestures, dismiss } = setup()
    gestures.zoom(2, center)
    gestures.down(1, center)
    gestures.up(1, { x: 500, y: 700 })
    expect(dismiss).not.toHaveBeenCalled()
    expect(gestures.view.y).toBe(300)
    gestures.resize({ width: 200, height: 200 }, viewport)
    expect(gestures.view).toEqual({ scale: 2, x: 0, y: 0 })
  })
})
