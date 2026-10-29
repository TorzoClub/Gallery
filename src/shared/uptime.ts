const HOUR_MS = 60 * 60 * 1000
const DAY_HOURS = 24
const MONTH_DAYS = 30
const YEAR_DAYS = 365

function totalHoursSince(startupTime: number, now: number): number {
  const elapsed = Math.max(0, now - startupTime)
  return Math.floor(elapsed / HOUR_MS)
}

/**
 * Compact uptime:
 * - under one year: `<months>m <days>d <hours>h`
 * - one year or more: `<years>y <months>m <days>d`
 *
 * Uses fixed 365-day years and 30-day months; this is a display duration,
 * not a calendar difference.
 */
export function formatUptime(startupTime: number, now = Date.now()): string {
  const total_hours = totalHoursSince(startupTime, now)
  const total_days = Math.floor(total_hours / DAY_HOURS)

  if (total_days >= YEAR_DAYS) {
    const years = Math.floor(total_days / YEAR_DAYS)
    const remaining_days = total_days % YEAR_DAYS
    const months = Math.floor(remaining_days / MONTH_DAYS)
    const days = remaining_days % MONTH_DAYS
    return `${years}y ${months}m ${days}d`
  } else {
    const months = Math.floor(total_days / MONTH_DAYS)
    const days = total_days % MONTH_DAYS
    const hours = total_hours % DAY_HOURS
    return `${months}m ${days}d ${hours}h`
  }
}
