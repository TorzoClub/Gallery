/// <reference types="vite/client" />

const rawBase = import.meta.env.VITE_API_PREFIX || '/'
export const API_BASE = rawBase.endsWith('/') ? rawBase : `${rawBase}/`

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type Envelope<T> = {
  success: boolean
  data?: T
  code?: string
  message?: string
  details?: unknown
}

export function unwrapApiResponse<T>(status: number, raw: unknown): T {
  const body = raw as Envelope<T> | null

  if (status >= 200 && status < 300 && body?.success === true) {
    return body.data as T
  } else {
    const code = typeof body?.code === 'string' ? body.code : 'REQUEST_FAILED'
    const message = typeof body?.message === 'string' && body.message.length > 0
      ? body.message
      : `请求失败（HTTP ${status}）`

    throw new ApiError(status, code, message, body?.details)
  }
}

export type JsonResponse = {
  status: number
  data: unknown
}

export type RequestOptions = {
  timeout?: number
  headers?: Record<string, string>
}

const __NETWORK_ERROR = '无法连接服务器，请检查网络或 API 地址'
const __TIMEOUT_ERROR = '请求超时，请稍后重试'

function parseBody(text: string): unknown {
  if (text === '') {
    return null
  } else {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }
}

async function requestJson(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  options: RequestOptions,
): Promise<JsonResponse> {
  const controller = new AbortController()
  let timed_out = false
  const timer = options.timeout === undefined
    ? null
    : setTimeout(() => {
        timed_out = true
        controller.abort()
      }, options.timeout)

  try {
    const init: RequestInit = {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      cache: 'no-store',
      signal: controller.signal,
      body: (body !== undefined) ? JSON.stringify(body) : undefined,
    }

    const response = await fetch(`${API_BASE}${path.replace(/^\/+/, '')}`, init)
    const text = await response.text()
    return { status: response.status, data: parseBody(text) }
  } catch {
    if (timed_out) {
      throw new ApiError(0, 'TIMEOUT', __TIMEOUT_ERROR)
    } else {
      throw new ApiError(0, 'NETWORK_ERROR', __NETWORK_ERROR)
    }
  } finally {
    if (timer !== null) {
      clearTimeout(timer)
    }
  }
}

export function postJson(
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<JsonResponse> {
  return requestJson('POST', path, body, options)
}

export function getJson(
  path: string,
  options: RequestOptions = {},
): Promise<JsonResponse> {
  return requestJson('GET', path, undefined, options)
}
