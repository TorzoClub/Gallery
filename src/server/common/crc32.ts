import { crc32 } from 'node:zlib'

export function crc32ToHex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0')
}

export function crc32Hex(buffer: Buffer): string {
  return crc32ToHex(crc32(buffer))
}
