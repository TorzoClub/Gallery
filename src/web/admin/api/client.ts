import axios from 'axios'

import {
  API_BASE,
  ApiError,
  unwrapApiResponse,
} from '../../api/dispatch'
import { getToken, removeToken } from '../auth/token'

export const UNAUTHORIZED_EVENT = 'admin:unauthorized'

export function notifyUnauthorized(): void {
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
}

function maybeUnauthorized(status: number, raw: unknown): void {
  const body = raw as { message?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message : ''
  if (status === 401 || (status === 403 && /token/i.test(message))) {
    removeToken()
    notifyUnauthorized()
  }
}

const http = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  validateStatus: () => true,
})

function headers(): Record<string, string> {
  const token = getToken()
  return token.length > 0 ? { Authorization: `Bearer ${token}` } : {}
}

async function adminDispatch<T>(
  kind: 'query' | 'mutation',
  name: string,
  payload: unknown,
): Promise<T> {
  try {
    const route = kind === 'query' ? 'query' : 'mutate'
    const response = await http.post(`admin/${route}/${name}`, { payload }, {
      headers: headers(),
    })
    maybeUnauthorized(response.status, response.data)
    return unwrapApiResponse<T>(response.status, response.data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response === undefined) {
      throw new ApiError(0, 'NETWORK_ERROR', '无法连接服务器，请检查网络或 API 地址')
    }
    throw error
  }
}

export function adminQuery<T>(name: string, payload: unknown = {}): Promise<T> {
  return adminDispatch<T>('query', name, payload)
}

export function adminMutate<T>(name: string, payload: unknown = {}): Promise<T> {
  return adminDispatch<T>('mutation', name, payload)
}

export async function adminLogin(password: string): Promise<{ token: string }> {
  try {
    const response = await http.post('auth/login', { password })
    return unwrapApiResponse<{ token: string }>(response.status, response.data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response === undefined) {
      throw new ApiError(0, 'NETWORK_ERROR', '无法连接服务器，请检查网络或 API 地址')
    }
    throw error
  }
}
