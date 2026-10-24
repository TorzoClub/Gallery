function pad(value: number) {
  return String(value).padStart(2, '0')
}

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime())
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (!isValidDate(date)) {
    return '—'
  }

  return [
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join(' ')
}

export function toDateTimeLocalValue(value?: string | null): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (!isValidDate(date)) {
    return ''
  }

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T')
}

export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (!isValidDate(date)) {
    return null
  }

  return date.toISOString()
}

export function nowDateTimeLocalValue() {
  return toDateTimeLocalValue(new Date().toISOString())
}

export function addDaysToDateTimeLocalValue(value: string, days: number): string {
  const date = new Date(value)
  if (!isValidDate(date)) {
    return value
  }
  date.setDate(date.getDate() + days)
  return toDateTimeLocalValue(date.toISOString())
}

export function compareDateTimeLocalValue(left: string, right: string): number {
  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return 0
  }
  return leftTime - rightTime
}
