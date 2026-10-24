import { adminQuery } from './client'
import type { Statistic } from './types'

export function getStatistic(): Promise<Statistic> {
  return adminQuery<Statistic>('adminStatistic')
}
