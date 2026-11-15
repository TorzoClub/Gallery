/**
 * 纸胶带是否换成 HDR 的样子：这张相片有 HDR optimized，且当前屏幕声明支持 HDR。
 * 只影响胶带外观；卡片本身始终加载 SDR thumb，HDR 图只在查看大图时加载。
 */
export function photoCardTapeHdr(has_hdr_optimized: boolean | undefined, hdr_display: boolean): boolean {
  return has_hdr_optimized === true && hdr_display
}
