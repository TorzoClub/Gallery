import axios, { AxiosRequestConfig } from 'axios'

import { removeToken, getToken } from '../auth/token'
import { isUnauthorizedResponse } from '../utils/errors'

const rawBase = import.meta.env.VITE_API_PREFIX || '/torzo-gallery-server/'
export const API_BASE = rawBase.endsWith('/') ? rawBase : `${rawBase}/`
export const UNAUTHORIZED_EVENT = 'admin:unauthorized'

export function apiURL(path: string): string {
  return `${API_BASE}${path.replace(/^\/+/, '')}`
}

export function notifyUnauthorized(): void {
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
}

const http = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
})

http.interceptors.request.use(config => {
  const token = getToken()
  if (token) {
    config.headers.set('Authorization', token)
  }
  return config
})

http.interceptors.response.use(
  response => response,
  err => {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status
      const data = err.response?.data
      if (isUnauthorizedResponse(status, data)) {
        removeToken()
        notifyUnauthorized()
      }
    }
    return Promise.reject(err)
  },
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<T>(config)
  return response.data
}
