export function formatQQ(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }
  return String(value)
}

export function memberDisplayName(member: { id: number; name?: string } | null | undefined): string {
  if (!member) {
    return '未知成员'
  }
  return member.name?.trim() || `成员 #${member.id}`
}

export function errorMessage(error: unknown, fallback = '操作失败'): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string' && error.length > 0) {
    return error
  }
  return fallback
}
