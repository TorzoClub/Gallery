let cached: boolean | null = null

// Read the display capability once per page load. We intentionally do not
// listen for display or system HDR changes.
export function isHdrDisplay(): boolean {
  if (cached !== null) {
    return cached
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    cached = false
    return cached
  }
  try {
    cached = window.matchMedia('(dynamic-range: high)').matches
      || window.matchMedia('(video-dynamic-range: high)').matches
  } catch {
    cached = false
  }
  return cached
}
