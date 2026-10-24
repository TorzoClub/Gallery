import type { InstanceConfig } from '@shared/config'
import { adminMutate, adminQuery } from './client'

export type InstanceConfigUpdate = Partial<Omit<InstanceConfig, 'schema_version'>>

export function getInstanceConfig(): Promise<InstanceConfig> {
  return adminQuery<InstanceConfig>('adminGetInstanceConfig')
}

export function updateInstanceConfig(payload: InstanceConfigUpdate): Promise<InstanceConfig> {
  return adminMutate<InstanceConfig>('adminUpdateInstanceConfig', payload)
}
