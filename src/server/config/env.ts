import path from 'node:path'
import * as z from 'zod'

const EnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(7001),
  HOSTNAME: z.string().min(1).optional(),
  // Deprecated alias kept for existing env files.
  HTTP_HOST: z.string().min(1).optional(),
  STORAGE_PATH: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ADMIN_PASSWORD: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().min(60).default(12 * 60 * 60),
  CORS_ORIGINS: z.string().optional(),
  API_BASE_PATH: z.string().default('/'),
  PUBLIC_BASE_URL: z.string().optional(),
  HTTP_BODY_HARD_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .default(64 * 1024 * 1024),
  ALLOW_EMPTY_DATA: z.enum(['true', 'false']).default('false'),
})

export type AppEnv = z.infer<typeof EnvSchema>['APP_ENV']

export type EnvConfig = Readonly<{
  app_env: AppEnv
  http_port: number
  hostname: string
  storage_path: string
  log_level: 'debug' | 'info' | 'warn' | 'error'
  admin_password: string
  jwt_secret: string
  jwt_expires_in_seconds: number
  cors_origins: readonly string[]
  api_base_path: string
  public_base_url: string
  http_body_hard_limit_bytes: number
  allow_empty_data: boolean
}>

export function normalizeApiBasePath(value: string): string {
  const with_leading = value.startsWith('/') ? value : `/${value}`
  if (with_leading === '/') {
    return '/'
  }
  return with_leading.replace(/\/+$/, '')
}

function parseCorsOrigins(value: string | undefined, app_env: AppEnv): readonly string[] {
  if (value === undefined || value.trim() === '') {
    return app_env === 'production' ? [] : ['*']
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function loadEnvConfig(input: NodeJS.ProcessEnv = process.env): EnvConfig {
  const parsed = EnvSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`环境变量校验失败:\n${z.prettifyError(parsed.error)}`)
  }

  const env = parsed.data
  const storage_path = path.resolve(env.STORAGE_PATH)
  const hostname = env.HOSTNAME ?? env.HTTP_HOST ?? '0.0.0.0'

  const public_base_url = (
    env.PUBLIC_BASE_URL ?? `http://localhost:${env.HTTP_PORT}`
  ).replace(/\/+$/, '')

  if (env.APP_ENV === 'production') {
    if (env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET 在 production 模式下至少需要 32 个字符')
    }
    if (env.PUBLIC_BASE_URL === undefined) {
      throw new Error('PUBLIC_BASE_URL 在 production 模式下必须设置')
    }
  }

  return Object.freeze({
    app_env: env.APP_ENV,
    http_port: env.HTTP_PORT,
    hostname,
    storage_path,
    log_level: env.LOG_LEVEL,
    admin_password: env.ADMIN_PASSWORD,
    jwt_secret: env.JWT_SECRET,
    jwt_expires_in_seconds: env.JWT_EXPIRES_IN_SECONDS,
    cors_origins: Object.freeze(parseCorsOrigins(env.CORS_ORIGINS, env.APP_ENV)),
    api_base_path: normalizeApiBasePath(env.API_BASE_PATH),
    public_base_url,
    http_body_hard_limit_bytes: env.HTTP_BODY_HARD_LIMIT_BYTES,
    allow_empty_data: env.ALLOW_EMPTY_DATA === 'true',
  })
}
