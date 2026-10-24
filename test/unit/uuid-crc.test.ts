import { describe, expect, it } from 'vitest'
import { crc32Hex, crc32ToHex } from '../../src/server/common/crc32'
import { isUuidV7, uuidV7Timestamp, uuidv7 } from '../../src/server/common/uuid'

describe('crc32', () => {
  it('returns unsigned lowercase hex', () => {
    expect(crc32Hex(Buffer.from('hello'))).toBe('3610a686')
    expect(crc32ToHex(0)).toBe('00000000')
    expect(crc32ToHex(0x1234)).toBe('00001234')
  })
})

describe('uuidv7', () => {
  it('generates version 7 UUIDs with a parseable timestamp', () => {
    const id = uuidv7({ msecs: 1_700_000_000_000 })
    expect(isUuidV7(id)).toBe(true)
    expect(id[14]).toBe('7')
    expect(uuidV7Timestamp(id)).toBe(1_700_000_000_000)
  })

  it('keeps time order across different milliseconds', () => {
    const first = uuidv7({ msecs: 1_700_000_000_000 })
    const second = uuidv7({ msecs: 1_700_000_001_000 })
    expect(first < second).toBe(true)
  })
})
