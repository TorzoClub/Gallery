import { describe, expect, it } from 'vitest'
import { isHdrCicp, parseAvifCicp, parseAvifInfo, parsePngCicp } from '../../src/server/storage/hdr'
import { supportsHdrDisplay } from '../../src/web/utils/browser'
import { chooseDetailSource } from '../../src/web/components/Detail/hdr'
import { HDR_TAPE_MATRIX, hdrTapeWords, photoCardTapeHdr } from '../../src/web/components/PhotoCard/hdr'
import { formatFromFilename, mimeTypeOf } from '../../src/server/common/image-name'

function pngWithCicp(values: readonly [number, number, number, number]): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const type = Buffer.from('cICP')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(values.length)
  return Buffer.concat([signature, length, type, Buffer.from(values), Buffer.alloc(4)])
}

describe('HDR detection', () => {
  it('recognizes HEIC/HEIF filenames and MIME', () => {
    expect(formatFromFilename('photo.heic')).toBe('heic')
    expect(formatFromFilename('photo.heif')).toBe('heic')
    expect(mimeTypeOf('photo.heic')).toBe('image/heic')
  })

  it('treats PQ and HLG transfer as HDR', () => {
    expect(isHdrCicp({ primaries: 9, transfer: 16, matrix: 9, full_range: true })).toBe(true)
    expect(isHdrCicp({ primaries: 9, transfer: 18, matrix: 9, full_range: true })).toBe(true)
    expect(isHdrCicp({ primaries: 1, transfer: 13, matrix: 1, full_range: true })).toBe(false)
    expect(isHdrCicp(null)).toBe(false)
  })

  it('reads PNG cICP', () => {
    expect(parsePngCicp(pngWithCicp([9, 16, 9, 1]))).toEqual({
      primaries: 9,
      transfer: 16,
      matrix: 9,
      full_range: true,
    })
  })

  it('does not treat a PNG without cICP as HDR', () => {
    expect(parsePngCicp(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
  })

  it('reads avifdec --info CICP fields', () => {
    const output = [
      ' * Resolution     : 100x50',
      ' * Range          : Limited',
      ' * Color Primaries: 9',
      ' * Transfer Char. : 18',
      ' * Matrix Coeffs. : 9',
      ' * Gain map       : Absent',
    ].join('\n')
    expect(parseAvifCicp(output)).toEqual({
      primaries: 9,
      transfer: 18,
      matrix: 9,
      full_range: false,
    })
  })

  it('detects a gain map in avifdec --info output', () => {
    const with_gain = [
      ' * Color Primaries: 1',
      ' * Transfer Char. : 13',
      ' * Matrix Coeffs. : 1',
      ' * Gain map       : 320x200 pixels, 8 bit',
    ].join('\n')
    const without_gain = with_gain.replace(' * Gain map       : 320x200 pixels, 8 bit', ' * Gain map       : Absent')
    expect(parseAvifInfo(with_gain).gain_map).toBe(true)
    expect(parseAvifInfo(without_gain).gain_map).toBe(false)
  })
})

describe('HDR detail selection', () => {
  const input = {
    from: { left: 0, top: 0, width: 10, height: 10, rotate: 0 },
    thumb: 'thumb',
    src: 'sdr.avif',
    srcHdr: 'hdr.avif',
    width: 100,
    height: 50,
  }

  it('uses HDR only when the display advertises it', () => {
    expect(chooseDetailSource(input, true)).toEqual({ src: 'hdr.avif', fallback_src: 'sdr.avif' })
    expect(chooseDetailSource(input, false)).toEqual({ src: 'sdr.avif', fallback_src: null })
  })

  it('uses SDR when there is no HDR file', () => {
    expect(chooseDetailSource({ ...input, srcHdr: null }, true)).toEqual({ src: 'sdr.avif', fallback_src: null })
  })
})

describe('HDR display detection', () => {
  it('reads dynamic-range: high safely', () => {
    expect(supportsHdrDisplay(query => ({ matches: query === '(dynamic-range: high)' }))).toBe(true)
    expect(supportsHdrDisplay(() => ({ matches: false }))).toBe(false)
    expect(supportsHdrDisplay(() => { throw new Error('unavailable') })).toBe(false)
  })
})

describe('HDR tape', () => {
  it('marks the tape only when the photo has HDR and the display supports it', () => {
    expect(photoCardTapeHdr(true, true)).toBe(true)
    expect(photoCardTapeHdr(true, false)).toBe(false)
    expect(photoCardTapeHdr(false, true)).toBe(false)
    expect(photoCardTapeHdr(false, false)).toBe(false)
    expect(photoCardTapeHdr(undefined, true)).toBe(false)
  })
})

describe('HDR tape words', () => {
  const rad = HDR_TAPE_MATRIX.rotate * Math.PI / 180
  const half_w = (HDR_TAPE_MATRIX.word_width * Math.abs(Math.cos(rad))
    + HDR_TAPE_MATRIX.word_height * Math.abs(Math.sin(rad))) / 2
  const half_h = (HDR_TAPE_MATRIX.word_width * Math.abs(Math.sin(rad))
    + HDR_TAPE_MATRIX.word_height * Math.abs(Math.cos(rad))) / 2

  it('keeps only words whose rotated box intersects the tape', () => {
    for (const width of [38, 68, 96]) {
      const words = hdrTapeWords(width, 17)
      expect(words.length).toBeGreaterThan(0)
      for (const word of words) {
        expect(word.x + half_w).toBeGreaterThan(0)
        expect(word.x - half_w).toBeLessThan(width)
        expect(word.y + half_h).toBeGreaterThan(0)
        expect(word.y - half_h).toBeLessThan(17)
      }
    }
  })

  it('reaches every tape edge instead of only the middle', () => {
    for (const width of [38, 68, 96]) {
      const words = hdrTapeWords(width, 17)
      expect(Math.min(...words.map(word => word.x - half_w))).toBeLessThanOrEqual(0)
      expect(Math.max(...words.map(word => word.x + half_w))).toBeGreaterThanOrEqual(width)
      expect(Math.min(...words.map(word => word.y - half_h))).toBeLessThanOrEqual(0)
      expect(Math.max(...words.map(word => word.y + half_h))).toBeGreaterThanOrEqual(17)
    }
  })

  it('culls fully hidden words: fewer than the old fixed 30 at the widest tape', () => {
    expect(hdrTapeWords(96, 17).length).toBeLessThan(30)
    expect(hdrTapeWords(38, 17).length).toBeLessThan(hdrTapeWords(96, 17).length)
  })

  it('returns no words for invalid dimensions', () => {
    expect(hdrTapeWords(0, 17)).toEqual([])
    expect(hdrTapeWords(96, 0)).toEqual([])
    expect(hdrTapeWords(Number.NaN, 17)).toEqual([])
    expect(hdrTapeWords(-1, 17)).toEqual([])
  })
})
