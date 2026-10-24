import { request } from './client'
import type { LoginResult } from './types'

export function login(pass: string): Promise<LoginResult> {
  return request<LoginResult>({
    url: 'admin/login',
    method: 'POST',
    data: { pass },
  })
}
