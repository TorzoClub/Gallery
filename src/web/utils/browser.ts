/**
 * WebKit 内核的 Safari：macOS / iOS 的 Safari，以及 iOS 上所有浏览器（它们都只能用 WebKit）。
 * Chromium 系（含 Edge）的 UA 里也有 “AppleWebKit … Safari”，但会带 “Chrome/”，要排除。
 */
export function isWebKitSafari(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /AppleWebKit\//.test(ua) && !/(Chrome|Chromium)\//.test(ua) && !/Android/.test(ua)
}
