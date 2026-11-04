import { describe, expect, it } from 'vitest'
import { isWebKitSafari } from '../../src/web/utils/browser'

const UA = {
  mac_safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  ios_safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  ios_chrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  mac_chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  win_edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  android_webview: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:132.0) Gecko/20100101 Firefox/132.0',
}

describe('isWebKitSafari', () => {
  it('treats Safari and every iOS browser as WebKit Safari', () => {
    expect(isWebKitSafari(UA.mac_safari)).toBe(true)
    expect(isWebKitSafari(UA.ios_safari)).toBe(true)
    expect(isWebKitSafari(UA.ios_chrome)).toBe(true)
  })

  it('does not match Chromium, Android or Gecko', () => {
    expect(isWebKitSafari(UA.mac_chrome)).toBe(false)
    expect(isWebKitSafari(UA.win_edge)).toBe(false)
    expect(isWebKitSafari(UA.android_webview)).toBe(false)
    expect(isWebKitSafari(UA.firefox)).toBe(false)
  })
})
