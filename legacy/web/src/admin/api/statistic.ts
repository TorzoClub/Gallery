import { request } from './client'
import type { Statistic } from './types'

export function getStatistic(): Promise<Statistic> {
  return request<Statistic>({
    url: 'admin/statistic',
    method: 'GET',
    timeout: 30000,
  })
}
