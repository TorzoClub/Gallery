import { describe, expect, it } from 'vitest'
import {
  AVIF_MAX_DIMENSION,
  MIN_DERIVED_SHORT_EDGE,
  assertDerivableImage,
  avatarThumbSize,
  photoOptimizedSize,
  photoThumbSize,
} from '../../src/server/storage/image'

const CONFIG = { image_thumb_size: 640, max_image_dimension: 3840, avatar_thumb_size: 128 }

describe('derived image sizes', () => {
  it('keeps the old rules: thumb by width, optimized by the long edge, no enlargement', () => {
    expect(photoThumbSize({ width: 3000, height: 2000 }, 640)).toEqual({ width: 640, height: 427 })
    expect(photoThumbSize({ width: 1500, height: 3000 }, 640)).toEqual({ width: 640, height: 1280 })
    expect(photoThumbSize({ width: 500, height: 400 }, 640)).toEqual({ width: 500, height: 400 })
    expect(photoOptimizedSize({ width: 6000, height: 4000 }, 3840)).toEqual({ width: 3840, height: 2560 })
    expect(photoOptimizedSize({ width: 3000, height: 1500 }, 3840)).toEqual({ width: 3000, height: 1500 })
  })

  it('never lets the short edge of photo thumb / optimized drop below 256', () => {
    expect(MIN_DERIVED_SHORT_EDGE).toBe(256)
    // 6:1 的横长图：宽 640 只有 107 高 → 顶回 256
    expect(photoThumbSize({ width: 6000, height: 1000 }, 640)).toEqual({ width: 1536, height: 256 })
    // 配置得很小的缩略图同样顶回 256
    expect(photoThumbSize({ width: 800, height: 600 }, 100)).toEqual({ width: 341, height: 256 })
    // 下限优先于 max_image_dimension：长边可以超过它
    expect(photoOptimizedSize({ width: 20000, height: 1000 }, 3840)).toEqual({ width: 5120, height: 256 })
    // 原图短边本来就不到 256：保持原尺寸，不放大
    expect(photoThumbSize({ width: 3000, height: 100 }, 640)).toEqual({ width: 3000, height: 100 })
    expect(photoOptimizedSize({ width: 3000, height: 100 }, 640)).toEqual({ width: 3000, height: 100 })
  })

  it('does not apply the 256 floor to avatars', () => {
    expect(avatarThumbSize({ width: 1000, height: 500 }, 128)).toEqual({ width: 128, height: 64 })
  })

  it('rejects images whose derived files would exceed the AVIF limit', () => {
    expect(AVIF_MAX_DIMENSION).toBe(16384)
    expect(() => assertDerivableImage({ width: 4000, height: 3000 }, CONFIG)).not.toThrow()
    // 1:30 竖条：缩略图 640×19200
    expect(() => assertDerivableImage({ width: 1000, height: 30000 }, CONFIG)).toThrow(/图片太长了/)
    // 1:100 横条：缩略图短边顶到 256 → 25600×256
    expect(() => assertDerivableImage({ width: 100000, height: 1000 }, CONFIG)).toThrow(/图片太长了/)
    // 1:25 竖条刚好放得下：640×16000
    expect(() => assertDerivableImage({ width: 1000, height: 25000 }, CONFIG)).not.toThrow()
  })
})
