import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INSTANCE_CONFIG,
  InstanceConfigUpdateSchema,
  assertInstanceConfigWithinHardLimit,
  loadEnvConfig,
  mergeInstanceConfig,
  parseInstanceConfig,
} from '../../src/config'

const base_env = {
  APP_ENV: 'test',
  HTTP_PORT: '7011',
  HTTP_HOST: '127.0.0.1',
  STORAGE_PATH: './tmp-test-storage',
  LOG_LEVEL: 'info',
  ADMIN_PASSWORD: 'pass',
  JWT_SECRET: '01234567890123456789012345678901',
  CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001',
  API_BASE_PATH: '/torzo-gallery-server/',
  PUBLIC_BASE_URL: 'http://example.test/',
  HTTP_BODY_HARD_LIMIT_BYTES: String(32 * 1024 * 1024),
}

describe('env config', () => {
  it('normalizes paths and CORS', () => {
    const config = loadEnvConfig(base_env)
    expect(config.api_base_path).toBe('/torzo-gallery-server')
    expect(config.public_base_url).toBe('http://example.test')
    expect(config.cors_origins).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ])
    expect(config.app_env).toBe('test')
    expect(config.http_port).toBe(7011)
  })

  it('defaults to wildcard CORS in non-production and empty in production', () => {
    const dev = loadEnvConfig({ ...base_env, CORS_ORIGINS: undefined })
    expect(dev.cors_origins).toEqual(['*'])

    const prod = loadEnvConfig({
      ...base_env,
      APP_ENV: 'production',
      CORS_ORIGINS: undefined,
    })
    expect(prod.cors_origins).toEqual([])
  })

  it('requires production secrets and public base url', () => {
    expect(() => loadEnvConfig({
      ...base_env,
      APP_ENV: 'production',
      JWT_SECRET: 'short',
    })).toThrowError(/JWT_SECRET/)

    expect(() => loadEnvConfig({
      ...base_env,
      APP_ENV: 'production',
      PUBLIC_BASE_URL: undefined,
    })).toThrowError(/PUBLIC_BASE_URL/)
  })
})

describe('instance config', () => {
  it('fills defaults and validates ranges', () => {
    const config = parseInstanceConfig({})
    expect(config).toEqual(DEFAULT_INSTANCE_CONFIG)

    expect(() => parseInstanceConfig({
      ...DEFAULT_INSTANCE_CONFIG,
      image_thumb_size: 1,
    })).toThrowError()
  })

  it('merges partial updates and enforces the hard upload limit', () => {
    const next = mergeInstanceConfig(DEFAULT_INSTANCE_CONFIG, {
      image_thumb_size: 800,
      max_upload_bytes: 1024 * 1024,
    })
    expect(next.image_thumb_size).toBe(800)
    expect(next.max_upload_bytes).toBe(1024 * 1024)
    expect(next.image_thumb_quality).toBe(DEFAULT_INSTANCE_CONFIG.image_thumb_quality)

    expect(() => InstanceConfigUpdateSchema.parse({
      image_thumb_size: 800,
      APP_ENV: 'production',
    })).toThrowError()

    expect(() => assertInstanceConfigWithinHardLimit(next, 512 * 1024))
      .toThrowError(/HTTP_BODY_HARD_LIMIT_BYTES/)
  })
})
