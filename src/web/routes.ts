function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

export function isBehindPath(pathname: string): boolean {
  const normalized = normalizePath(pathname)
  return normalized === '/behind' || normalized.startsWith('/behind/')
}

export function isExplorePath(pathname: string): boolean {
  const normalized = normalizePath(pathname)
  return normalized === '/explore' || normalized.startsWith('/explore/')
}
