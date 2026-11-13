import { describe, expect, it } from 'vitest'
import {
  MAX_TIMER_DELAY_MS,
  clampTimerDelay,
} from '../../src/server/instance/pool-json-cache'

describe('clampTimerDelay', () => {
  it('keeps normal delays unchanged', () => {
    expect(clampTimerDelay(0)).toBe(0)
    expect(clampTimerDelay(15_000)).toBe(15_000)
  })

  it('does not pass negative delays to setTimeout', () => {
    expect(clampTimerDelay(-1)).toBe(0)
    expect(clampTimerDelay(-3_000_000_000)).toBe(0)
  })

  it('caps delays at the Node.js maximum', () => {
    expect(clampTimerDelay(MAX_TIMER_DELAY_MS)).toBe(MAX_TIMER_DELAY_MS)
    expect(clampTimerDelay(MAX_TIMER_DELAY_MS + 1)).toBe(MAX_TIMER_DELAY_MS)
    expect(clampTimerDelay(3_290_286_769)).toBe(MAX_TIMER_DELAY_MS)
  })
})
