import { describe, expect, it } from 'vitest'
import {
  DESC_VOTE_ROOM,
  estimateDescLines,
  estimatePhotoCardHeight,
  getPhotoCardScatter,
  photoCardCover,
  photoCardFrame,
  photoIsSideways,
  PHOTO_CARD_TAPE_ROOM,
  SIDEWAYS_RATIO,
  SCATTER_ROTATE_MAX,
  SCATTER_ROTATE_MIN,
  TALL_FROM,
  TALL_ROTATE,
  TALL_UPRIGHT,
  uprightFor,
} from '../../src/web/components/PhotoCard/scatter'

/** 与 Gallery 的断点一致：[列宽, 列间距, tight, duo] */
const LAYOUTS: Array<[number, number, boolean, boolean?]> = [
  [(1200 - 32 * 3) / 4, 32, false],
  [(900 - 32 * 3) / 4, 32, false],
  [(750 - 32 * 2) / 3, 32, false],
  [(600 - 20 * 2) / 3, 20, true],
  [(375 - 16 - 10) / 2, 10, true, true],
  [(320 - 16 - 10) / 2, 10, true, true],
  [(640 - 16 - 10) / 2, 10, true, true],
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
    const input = { id: 42, column_width: 270, column_gutter: 32, photo: PHOTOS[0]!, desc: '字'.repeat(20), has_member: true, tight: false }
    expect(getPhotoCardScatter(input)).toEqual(getPhotoCardScatter({ ...input }))
    expect(getPhotoCardScatter(input)).not.toEqual(getPhotoCardScatter({ ...input, id: 43 }))
  })

  it('never reaches into the neighbouring column, at any breakpoint', () => {
    for (const [column_width, column_gutter, tight, duo] of LAYOUTS) {
      for (const photo of PHOTOS) {
        for (const [desc, has_member] of [
          ['', true], ['字'.repeat(12), true], ['字'.repeat(80), true], ['', false], ['字'.repeat(30), false],
          ['第一行\n第二行\n\n第四行\n第五行\n第六行', false], ['A handwritten note in English, '.repeat(6), true],
        ] as const) {
          for (let id = 1; id <= 200; id += 1) {
            const s = getPhotoCardScatter({ id, column_width, column_gutter, photo, desc, has_member, tight, duo })
            const height = estimatePhotoCardHeight(s.card_width, photo, desc, has_member)
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
    // 3000×1000 的横长图会转 90° 竖着贴，变成竖长卡片，所以这里用 16:9 的普通宽图
    const not_tall = [PHOTOS[0]!, { width: 1920, height: 1080 }, PHOTOS[4]!]
    for (let id = 1; id <= 500; id += 1) {
      const s = getPhotoCardScatter({ id, column_width: 270, column_gutter: 32, photo: not_tall[id % not_tall.length]!, desc: '', has_member: true, tight: false })
      expect(Math.abs(s.rotate)).toBeGreaterThanOrEqual(SCATTER_ROTATE_MIN - 0.01)
      expect(Math.abs(s.rotate)).toBeLessThanOrEqual(SCATTER_ROTATE_MAX + 0.01)
      expect(s.pad_top).toBeGreaterThanOrEqual(PHOTO_CARD_TAPE_ROOM)
      expect(s.pad_bottom).toBeGreaterThanOrEqual(0)
    }
  })

  it('stands tall cards (tall photo or long description) almost upright', () => {
    const cases = [
      { photo: { width: 1000, height: 3000 }, desc: '', has_member: true },
      { photo: { width: 4000, height: 3000 }, desc: '字'.repeat(400), has_member: false },
      // 字不多但回车很多：一样是竖长卡片
      { photo: { width: 4000, height: 3000 }, desc: Array.from({ length: 30 }, (_, i) => `第${i + 1}行`).join('\n'), has_member: true },
    ]
    for (const [column_width, column_gutter, tight, duo] of LAYOUTS) {
      for (const c of cases) {
        for (let id = 1; id <= 200; id += 1) {
          const s = getPhotoCardScatter({ id, column_width, column_gutter, tight, duo, ...c })
          const aspect = estimatePhotoCardHeight(s.card_width, c.photo, c.desc, c.has_member) / s.card_width
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

  it('turns wide panoramas (width / height ≥ 2) sideways into a tall cover', () => {
    expect(photoIsSideways({ width: 1920, height: 1080 })).toBe(false)
    expect(photoIsSideways({ width: 1999, height: 1000 })).toBe(false)
    expect(photoIsSideways({ width: 2000, height: 1000 })).toBe(true)
    expect(photoIsSideways({ width: 6000, height: 1000 })).toBe(true)
    expect(photoIsSideways({ width: 0, height: 0 })).toBe(false)
    expect(SIDEWAYS_RATIO).toBe(2)

    const wide = photoCardCover(240, { width: 1920, height: 1080 })
    expect(wide.sideways).toBe(false)
    expect(wide.cover_height).toBeCloseTo(wide.cover_width * 1080 / 1920)

    const panorama = photoCardCover(240, { width: 6000, height: 1000 })
    expect(panorama.sideways).toBe(true)
    // 竖着的框：高 = 宽 × 6，<img> 宽高对调后转 90° 正好填满
    expect(panorama.cover_height).toBeCloseTo(panorama.cover_width * 6)

    // 转过之后就是竖长卡片：几乎摆正
    for (let id = 1; id <= 200; id += 1) {
      const s = getPhotoCardScatter({ id, column_width: 270, column_gutter: 32, photo: { width: 6000, height: 1000 }, desc: '', has_member: true, tight: false })
      expect(Math.abs(s.rotate)).toBeLessThanOrEqual(TALL_ROTATE + 0.01)
    }
  })

  it('drops the writing area when an in-event photo has no description', () => {
    const photo = { width: 4000, height: 3000 }
    const frame = photoCardFrame(200)
    const { cover_height } = photoCardCover(200, photo)
    // 活动中（无作者）且无描述：四周同宽的白边
    expect(estimatePhotoCardHeight(200, photo, '', false)).toBeCloseTo(frame + cover_height + frame)
    // 非活动（有作者）即使无描述，仍有写头像的位置
    expect(estimatePhotoCardHeight(200, photo, '', true)).toBeGreaterThan(frame + cover_height + 40)
    // 活动中但有描述，也保留写字区
    expect(estimatePhotoCardHeight(200, photo, '字'.repeat(10), false)).toBeGreaterThan(frame + cover_height + 40)
  })

  it('estimates description lines from line breaks and character widths', () => {
    expect(estimateDescLines('', 180)).toBe(0)
    expect(estimateDescLines('短', 180)).toBe(1)
    // 回车一定换行，空行也占一行（white-space: pre-line）
    expect(estimateDescLines('一\n二\n\n四', 180)).toBe(4)
    // 180px 一行大约 13 个全角字（首行还有引号）
    expect(estimateDescLines('字'.repeat(13), 180)).toBe(2)
    // 首行 12 字（扣掉开引号）+ 13 + 13 + 2 字和闭引号
    expect(estimateDescLines('字'.repeat(40), 180)).toBe(4)
    // 英文窄一些：同样字数占的行比中文少
    expect(estimateDescLines('a'.repeat(40), 180)).toBeLessThan(estimateDescLines('字'.repeat(40), 180))
  })

  it('makes a long description stand the card more upright', () => {
    const photo = { width: 4000, height: 3000 }
    const base = { id: 7, column_width: 270, column_gutter: 32, photo, has_member: true, tight: false }
    const short = getPhotoCardScatter({ ...base, desc: '' })
    const long = getPhotoCardScatter({ ...base, desc: '字'.repeat(300) })
    expect(Math.abs(long.rotate)).toBeLessThan(Math.abs(short.rotate))
  })

  it('reserves the magnet room for in-event photos regardless of who is looking', () => {
    const photo = { width: 4000, height: 3000 }
    const desc = '字'.repeat(60)
    // 无作者（活动中）的相片按右侧少 44px 估，行数更多
    expect(DESC_VOTE_ROOM).toBe(44)
    const { cover_width, cover_height, frame } = photoCardCover(240, photo)
    const lines = estimateDescLines(desc, cover_width - 4 - DESC_VOTE_ROOM)
    expect(lines).toBeGreaterThan(estimateDescLines(desc, cover_width - 4))
    expect(estimatePhotoCardHeight(240, photo, desc, false)).toBeCloseTo(frame + cover_height + lines * 18 + 20)
  })

  it('jitters the tape within translateX -55%～-45% and rotate -3°～3°', () => {
    const xs = new Set<number>()
    for (let id = 1; id <= 500; id += 1) {
      const s = getPhotoCardScatter({ id, column_width: 270, column_gutter: 32, photo: PHOTOS[0]!, desc: '', has_member: true, tight: false })
      expect(s.tape_x).toBeGreaterThanOrEqual(-55)
      expect(s.tape_x).toBeLessThanOrEqual(-45)
      expect(s.tape_rotate).toBeGreaterThanOrEqual(-3)
      expect(s.tape_rotate).toBeLessThanOrEqual(3)
      xs.add(s.tape_x)
    }
    expect(xs.size).toBeGreaterThan(20)
  })

  it('makes two-column cards bigger: 92%～100% of the column', () => {
    const column_width = (375 - 16 - 10) / 2
    let duo_total = 0
    let tight_total = 0
    for (let id = 1; id <= 200; id += 1) {
      const base = { id, column_width, column_gutter: 10, photo: PHOTOS[0]!, desc: '', has_member: true, tight: true }
      const s = getPhotoCardScatter({ ...base, duo: true })
      expect(s.card_width).toBeLessThanOrEqual(column_width)
      // 倾斜后放不下时会缩一点，但不会缩回原来的 78%
      expect(s.card_width).toBeGreaterThan(column_width * 0.85)
      duo_total += s.card_width
      tight_total += getPhotoCardScatter(base).card_width
    }
    expect(duo_total / 200).toBeGreaterThan(tight_total / 200)
  })

  it('makes tight layouts smaller than wide ones', () => {
    const avg = (tight: boolean) => {
      let total = 0
      for (let id = 1; id <= 200; id += 1) {
        total += getPhotoCardScatter({ id, column_width: 200, column_gutter: 24, photo: PHOTOS[0]!, desc: '', has_member: true, tight }).card_width
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
