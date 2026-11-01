import type { InstanceConfig } from '@shared/config'
import { adminMutate } from './client'

export type InstanceConfigUpdate = Partial<Omit<InstanceConfig, 'schema_version'>>

export function updateInstanceConfig(payload: InstanceConfigUpdate): Promise<InstanceConfig> {
  return adminMutate<InstanceConfig>('adminUpdateInstanceConfig', payload)
}
