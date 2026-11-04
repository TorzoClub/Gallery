import { describe, expect, it } from 'vitest'
import {
  estimatePhotoCardHeight,
  getPhotoCardScatter,
  photoCardCover,
  photoCardFrame,
  PHOTO_CARD_TAPE_ROOM,
  SCATTER_ROTATE_MAX,
  SCATTER_ROTATE_MIN,
  TALL_FROM,
  TALL_ROTATE,
  TALL_UPRIGHT,
  uprightFor,
} from '../../src/web/components/PhotoCard/scatter'

/** 与 Gallery 的断点一致：[列宽, 列间距, tight] */
const LAYOUTS: Array<[number, number, boolean]> = [
  [(1200 - 32 * 3) / 4, 32, false],
  [(900 - 32 * 3) / 4, 32, false],
  [(750 - 32 * 2) / 3, 32, false],
  [(600 - 20 * 2) / 3, 20, true],
  [(375 - 40 - 20) / 2, 20, true],
  [232, 27, false],
]

const PHOTOS: ReadonlyArray<{ width: number; height: number }> = [
  { width: 4000, height: 3000 },
  { width: 3000, height: 4000 },
  { width: 1000, height: 3000 },
  { width: 3000, height: 1000 },
  { width: 1000, height: 1000 },
]

function rotatedWidth(width: number, height: number, deg: number) {
  const rad = (Math.abs(deg) * Math.PI) / 180
  return width * Math.cos(rad) + height * Math.sin(rad)
}

describe('PhotoCard scatter', () => {
  it('is deterministic per photo id', () => {
    const input = { id: 42, column_width: 270, column_gutter: 32, photo: PHOTOS[0]!, desc_length: 20, has_member: true, tight: false }
    expect(getPhotoCardScatter(input)).toEqual(getPhotoCardScatter({ ...input }))
    expect(getPhotoCardScatter(input)).not.toEqual(getPhotoCardScatter({ ...input, id: 43 }))
  })

  it('never reaches into the neighbouring column, at any breakpoint', () => {
    for (const [column_width, column_gutter, tight] of LAYOUTS) {
      for (const photo of PHOTOS) {
        for (const [desc_length, has_member] of [[0, true], [12, true], [80, true], [0, false], [30, false]] as const) {
          for (let id = 1; id <= 200; id += 1) {
            const s = getPhotoCardScatter({ id, column_width, column_gutter, photo, desc_length, has_member, tight })
            const height = estimatePhotoCardHeight(s.card_width, photo, desc_length, has_member)
            const half = rotatedWidth(s.card_width, height, s.rotate) / 2
            // 外接框的左右边，相对列左边
            const left = column_width / 2 + s.offset_x - half
            const right = column_width / 2 + s.offset_x + half
            expect(left).toBeGreaterThanOrEqual(-column_gutter / 2)
            expect(right).toBeLessThanOrEqual(column_width + column_gutter / 2)
            expect(s.card_width).toBeLessThanOrEqual(column_width)
          }
        }
      }
    }
  })

  it('keeps tilt within ±0.8°～3° for cards that are not tall, and leaves room for the tape', () => {
    const not_tall = [PHOTOS[0]!, PHOTOS[3]!, PHOTOS[4]!]
    for (let id = 1; id <= 500; id += 1) {
      const s = getPhotoCardScatter({ id, column_width: 270, column_gutter: 32, photo: not_tall[id % not_tall.length]!, desc_length: 0, has_member: true, tight: false })
      expect(Math.abs(s.rotate)).toBeGreaterThanOrEqual(SCATTER_ROTATE_MIN - 0.01)
      expect(Math.abs(s.rotate)).toBeLessThanOrEqual(SCATTER_ROTATE_MAX + 0.01)
      expect(s.pad_top).toBeGreaterThanOrEqual(PHOTO_CARD_TAPE_ROOM)
      expect(s.pad_bottom).toBeGreaterThanOrEqual(0)
    }
  })

  it('stands tall cards (tall photo or long description) almost upright', () => {
    const cases = [
      { photo: { width: 1000, height: 3000 }, desc_length: 0, has_member: true },
      { photo: { width: 4000, height: 3000 }, desc_length: 400, has_member: false },
    ]
    for (const [column_width, column_gutter, tight] of LAYOUTS) {
      for (const c of cases) {
        for (let id = 1; id <= 200; id += 1) {
          const s = getPhotoCardScatter({ id, column_width, column_gutter, tight, ...c })
          const aspect = estimatePhotoCardHeight(s.card_width, c.photo, c.desc_length, c.has_member) / s.card_width
          if (aspect >= TALL_UPRIGHT + 0.05) {
            expect(Math.abs(s.rotate)).toBeLessThanOrEqual(TALL_ROTATE + 0.01)
            expect(Math.abs(s.rotate)).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('eases the tilt toward upright between the tall thresholds', () => {
    expect(uprightFor(2.5, TALL_FROM)).toBe(2.5)
    expect(uprightFor(2.5, 1)).toBe(2.5)
    expect(uprightFor(2.5, TALL_UPRIGHT)).toBeCloseTo(TALL_ROTATE)
    expect(uprightFor(2.5, 10)).toBeCloseTo(TALL_ROTATE)
    const mid = uprightFor(2.5, (TALL_FROM + TALL_UPRIGHT) / 2)
    expect(mid).toBeLessThan(2.5)
    expect(mid).toBeGreaterThan(TALL_ROTATE)
  })

  it('drops the writing area when an in-event photo has no description', () => {
    const photo = { width: 4000, height: 3000 }
    const frame = photoCardFrame(200)
    const { cover_height } = photoCardCover(200, photo)
    // 活动中（无作者）且无描述：四周同宽的白边
    expect(estimatePhotoCardHeight(200, photo, 0, false)).toBeCloseTo(frame + cover_height + frame)
    // 非活动（有作者）即使无描述，仍有写头像的位置
    expect(estimatePhotoCardHeight(200, photo, 0, true)).toBeGreaterThan(frame + cover_height + 40)
    // 活动中但有描述，也保留写字区
    expect(estimatePhotoCardHeight(200, photo, 10, false)).toBeGreaterThan(frame + cover_height + 40)
  })

  it('jitters the tape within translateX -55%～-45% and rotate -3°～3°', () => {
    const xs = new Set<number>()
    for (let id = 1; id <= 500; id += 1) {
      const s = getPhotoCardScatter({ id, column_width: 270, column_gutter: 32, photo: PHOTOS[0]!, desc_length: 0, has_member: true, tight: false })
      expect(s.tape_x).toBeGreaterThanOrEqual(-55)
      expect(s.tape_x).toBeLessThanOrEqual(-45)
      expect(s.tape_rotate).toBeGreaterThanOrEqual(-3)
      expect(s.tape_rotate).toBeLessThanOrEqual(3)
      xs.add(s.tape_x)
    }
    expect(xs.size).toBeGreaterThan(20)
  })

  it('makes tight layouts smaller than wide ones', () => {
    const avg = (tight: boolean) => {
      let total = 0
      for (let id = 1; id <= 200; id += 1) {
        total += getPhotoCardScatter({ id, column_width: 200, column_gutter: 24, photo: PHOTOS[0]!, desc_length: 0, has_member: true, tight }).card_width
      }
      return total / 200
    }
    expect(avg(true)).toBeLessThan(avg(false))
  })

  it('keeps the cover inside the polaroid frame', () => {
    const { frame, cover_width, cover_height } = photoCardCover(200, { width: 4000, height: 3000 })
    expect(frame).toBe(9)
    expect(cover_width).toBe(182)
    expect(cover_height).toBeCloseTo(136.5)
  })
})
