import { adminQuery } from './client'
import type { AdminPoolDTO } from '@shared/dto'

export function fetchAdminPool(): Promise<AdminPoolDTO> {
  return adminQuery<AdminPoolDTO>('adminFetchPool')
}
