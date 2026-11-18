import { describe, expect, it } from 'vitest'
import {
  getAdminGalleryLayoutForWidth,
  getGalleryLayoutForWidth,
  sameGalleryLayout,
} from '../../src/web/components/Gallery/layout'

describe('gallery layout', () => {
  it('keeps the public auto-column layout on a wide viewport', () => {
    expect(getGalleryLayoutForWidth(2405)).toMatchObject({
      gallery_width: 2304,
      column_count: 9,
      column_gutter: 27,
      tight: false,
    })
  })

  it('caps the admin layout before the public auto-column branch', () => {
    expect(getAdminGalleryLayoutForWidth(2405)).toMatchObject({
      gallery_width: 1200,
      column_count: 4,
      column_gutter: 32,
      tight: false,
    })
  })

  it('keeps the admin fixed layout at 1498 and 1200', () => {
    expect(getAdminGalleryLayoutForWidth(1498)).toMatchObject({
      gallery_width: 1200,
      column_count: 4,
    })
    expect(getAdminGalleryLayoutForWidth(1200)).toMatchObject({
      gallery_width: 900,
      column_count: 4,
    })
  })

  it('keeps the narrow admin layout unchanged', () => {
    expect(getAdminGalleryLayoutForWidth(640)).toMatchObject({
      gallery_width: 624,
      column_count: 2,
      duo: true,
      tight: true,
    })
  })
})

describe('gallery layout identity', () => {
  it('treats identical layouts as equal and changed layouts as different', () => {
    const a = getGalleryLayoutForWidth(2405)
    const b = getGalleryLayoutForWidth(2404)
    const c = getGalleryLayoutForWidth(1800)
    expect(sameGalleryLayout(a, b)).toBe(true)
    expect(sameGalleryLayout(a, c)).toBe(false)
  })
})
