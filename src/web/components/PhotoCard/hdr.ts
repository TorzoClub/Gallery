/**
 * 纸胶带是否换成 HDR 的样子：这张相片有 HDR optimized，且当前屏幕声明支持 HDR。
 * 只影响胶带外观；卡片本身始终加载 SDR thumb，HDR 图只在查看大图时加载。
 */
export function photoCardTapeHdr(has_hdr_optimized: boolean | undefined, hdr_display: boolean): boolean {
  return has_hdr_optimized === true && hdr_display
}

/** 胶带上每个 HDR 字的字盒、间距和整块网格的倾斜角；必须与 index.scss 的 .photo-card-tape-hdr-word 一致 */
export const HDR_TAPE_MATRIX = {
  word_width: 12,
  word_height: 6,
  gap_x: 4,
  gap_y: 2,
  rotate: -30,
} as const

export type HdrTapeWord = {
  key: string
  /** 字盒中心在胶带局部坐标系里的位置，px */
  x: number
  y: number
}

/**
 * 只返回和胶带区域有交集的 HDR 字。
 *
 * 字盒按 12 × 6 排列在一条倾斜 -30° 的网格上，网格以胶带中心为中心。
 * 每个字旋转后是一个 12 × 6 的矩形；先把它在胶带坐标里的外接框和胶带矩形求交，
 * 完全在胶带外的字不加入结果，所以胶带变宽时不会像固定矩阵那样只占中间一块，
 * 也不会为了铺满而渲染大量看不见的元素。
 *
 * 尺寸来自 photoCardTapeWidth() / PHOTO_CARD_TAPE_HEIGHT，已 clamp 在 38～96 × 17。
 */
export function hdrTapeWords(width: number, height: number): HdrTapeWord[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return []
  }

  const rad = HDR_TAPE_MATRIX.rotate * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const abs_cos = Math.abs(cos)
  const abs_sin = Math.abs(sin)

  const step_x = HDR_TAPE_MATRIX.word_width + HDR_TAPE_MATRIX.gap_x
  const step_y = HDR_TAPE_MATRIX.word_height + HDR_TAPE_MATRIX.gap_y

  // 字盒旋转后的半宽 / 半高
  const half_w = (HDR_TAPE_MATRIX.word_width * abs_cos + HDR_TAPE_MATRIX.word_height * abs_sin) / 2
  const half_h = (HDR_TAPE_MATRIX.word_width * abs_sin + HDR_TAPE_MATRIX.word_height * abs_cos) / 2

  // 把“胶带 + 字盒外扩”反旋到网格坐标系，得到需要考虑的列/行范围；最后仍用下面的相交判断精筛。
  const max_lx = (width / 2 + half_w) * abs_cos + (height / 2 + half_h) * abs_sin
  const max_ly = (width / 2 + half_w) * abs_sin + (height / 2 + half_h) * abs_cos
  const col_from = Math.floor(-max_lx / step_x) - 1
  const col_to = Math.ceil(max_lx / step_x) + 1
  const row_from = Math.floor(-max_ly / step_y) - 1
  const row_to = Math.ceil(max_ly / step_y) + 1

  const words: HdrTapeWord[] = []
  for (let col = col_from; col <= col_to; col += 1) {
    for (let row = row_from; row <= row_to; row += 1) {
      const x = width / 2 + col * step_x * cos - row * step_y * sin
      const y = height / 2 + col * step_x * sin + row * step_y * cos
      // 字盒的轴对齐外接框与胶带矩形无交集：完全看不到，直接丢掉
      if (x + half_w <= 0 || x - half_w >= width || y + half_h <= 0 || y - half_h >= height) {
        continue
      }
      words.push({ key: `${col}:${row}`, x, y })
    }
  }
  return words
}
