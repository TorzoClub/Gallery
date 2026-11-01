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

export function isAdminPath(pathname: string): boolean {
  const normalized = normalizePath(pathname)
  return normalized === '/admin' || normalized.startsWith('/admin/')
}

export function isCancelSubmissionPath(pathname: string): boolean {
  const normalized = normalizePath(pathname)
  return normalized === '/cancelSubmission'
    || normalized.startsWith('/cancelSubmission/')
    || normalized === '/removingSubmission'
    || normalized.startsWith('/removingSubmission/')
}
