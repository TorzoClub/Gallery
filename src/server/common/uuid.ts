import { v7, validate, version } from 'uuid'

export type UuidV7Options = {
  msecs?: number
}

export function uuidv7(options?: UuidV7Options): string {
  return v7(options)
}

export function isUuidV7(value: string): boolean {
  return validate(value) && version(value) === 7
}

export function uuidV7Timestamp(value: string): number | null {
  if (!isUuidV7(value)) {
    return null
  }

  const hex = value.slice(0, 8) + value.slice(9, 13)
  return Number.parseInt(hex, 16)
}
