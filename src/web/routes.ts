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
  return normalized === '/explore/cancelSubmission'
    || normalized.startsWith('/explore/cancelSubmission/')
}

export function isLegacyCancelSubmissionPath(pathname: string): boolean {
  const normalized = normalizePath(pathname)
  return normalized === '/cancelSubmission'
    || normalized.startsWith('/cancelSubmission/')
    || normalized === '/removingSubmission'
    || normalized.startsWith('/removingSubmission/')
}

/** Staff 页：参与项目的人的留言 */
export function isStaffPath(pathname: string): boolean {
  const normalized = normalizePath(pathname)
  return normalized === '/staff' || normalized.startsWith('/staff/')
}

/** 单独的成员笔记本：/member/<member_id>，直接打开这位成员的成员页 */
export function isMemberPath(pathname: string): boolean {
  const normalized = normalizePath(pathname)
  return normalized === '/member' || normalized.startsWith('/member/')
}

/** /member/12 → '12'；不是数字就是 null */
export function memberIdFromPath(pathname: string): string | null {
  const match = /^\/member\/(\d+)$/.exec(normalizePath(pathname))
  return match?.[1] ?? null
}

export function memberPath(member_id: number | string): string {
  return `/member/${member_id}`
}
