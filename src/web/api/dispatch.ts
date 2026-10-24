import axios from 'axios'

const rawBase = import.meta.env.VITE_API_PREFIX || '/'
export const API_BASE = rawBase.endsWith('/') ? rawBase : `${rawBase}/`

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
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
  }

  const code = typeof body?.code === 'string' ? body.code : 'REQUEST_FAILED'
  const message = typeof body?.message === 'string' && body.message.length > 0
    ? body.message
    : `请求失败（HTTP ${status}）`

  throw new ApiError(status, code, message, body?.details)
}

const http = axios.create({
  baseURL: API_BASE,
  timeout: 100_000,
  validateStatus: () => true,
})

async function dispatch<T>(
  kind: 'query' | 'mutation',
  name: string,
  payload: unknown,
  admin: boolean,
): Promise<T> {
  try {
    const route = kind === 'query' ? 'query' : 'mutate'
    const response = await http.post(`${admin ? 'admin/' : ''}${route}/${name}`, {
      payload,
    })
    return unwrapApiResponse<T>(response.status, response.data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response === undefined) {
      throw new ApiError(0, 'NETWORK_ERROR', '无法连接服务器，请检查网络或 API 地址')
    }
    throw error
  }
}

export function query<T>(name: string, payload: unknown = {}): Promise<T> {
  return dispatch<T>('query', name, payload, false)
}

export function mutate<T>(name: string, payload: unknown = {}): Promise<T> {
  return dispatch<T>('mutation', name, payload, false)
}
