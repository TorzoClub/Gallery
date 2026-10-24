const TOKEN_KEY = 'TORZO_GALLERY_DASHBOARD_TOKEN'

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // localStorage can be unavailable in private browsing; keep app usable
    // for the current tab but the token will not survive a reload.
  }
}

export function removeToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}
