import { ApiError } from '../../api/dispatch'

export function extractApiMessage(data: unknown): string | undefined {
  if (typeof data === 'string') {
    const text = data.trim()
    if (!text) {
      return undefined
    }

    try {
      return extractApiMessage(JSON.parse(text))
    } catch {
      return text
    }
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (typeof record.message === 'string' && record.message.length > 0) {
      return record.message
    }
    if (typeof record.error === 'string' && record.error.length > 0) {
      return record.error
    }
  }

  return undefined
}

export function isUnauthorizedResponse(status: number | undefined, data: unknown): boolean {
  if (status === 401) {
    return true
  }

  if (status === 403 && data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (record.ILLEGAL_TOKEN || record.EXPIRED_TOKEN) {
      return true
    }
    return typeof record.message === 'string' && /token/i.test(record.message)
  }

  return false
}

export function getApiErrorMessage(err: unknown, fallback = '请求失败'): string {
  if (err instanceof ApiError) {
    return err.message || fallback
  }

  if (err instanceof Error && err.message) {
    return err.message
  }

  if (typeof err === 'string' && err.length > 0) {
    return err
  }

  return fallback
}
