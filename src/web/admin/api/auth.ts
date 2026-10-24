import { adminLogin } from './client'
import type { LoginResult } from './types'

export function login(password: string): Promise<LoginResult> {
  return adminLogin(password)
}
