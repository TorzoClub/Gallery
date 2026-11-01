import { createHash, timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'
import { sign, verify } from 'hono/jwt'
import { apiError, isApiError } from '../common/error'
import type { EnvConfig } from '../config'
import type { Logger } from '../logger'

function constantTimeEqual(left: string, right: string): boolean {
  const left_hash = createHash('sha256').update(left).digest()
  const right_hash = createHash('sha256').update(right).digest()
  return timingSafeEqual(left_hash, right_hash)
}

export function createAdminAuth(env: EnvConfig, logger: Logger): {
  login: MiddlewareHandler
  auth: MiddlewareHandler
} {
  const login: MiddlewareHandler = async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      throw apiError(400, 'BAD_REQUEST', '请求体不是合法 JSON')
    }

    if (typeof body !== 'object' || body === null) {
      throw apiError(400, 'BAD_REQUEST', '请求体格式错误')
    }

    const record = body as Record<string, unknown>
    const password = typeof record.password === 'string'
      ? record.password
      : typeof record.pass === 'string'
        ? record.pass
        : undefined

    if (password === undefined) {
      throw apiError(400, 'BAD_REQUEST', '缺少 password')
    }

    if (!constantTimeEqual(password, env.admin_password)) {
      throw apiError(401, 'UNAUTHORIZED', '密码错误')
    }

    const exp = Math.floor(Date.now() / 1000) + env.jwt_expires_in_seconds
    const token = await sign({
      role: 'admin',
      exp,
    }, env.jwt_secret, 'HS256')

    return c.json({
      success: true,
      data: { token },
    })
  }

  const auth: MiddlewareHandler = async (c, next) => {
    const header = c.req.header('authorization')
    if (header === undefined || header.trim() === '') {
      throw apiError(401, 'UNAUTHORIZED', '未提供 Token')
    }

    const token = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : header.trim()

    try {
      const payload = await verify(token, env.jwt_secret, 'HS256')
      if (payload.role !== 'admin') {
        throw apiError(403, 'FORBIDDEN', '权限不足')
      }
      await next()
    } catch (error) {
      if (isApiError(error)) {
        throw error
      }
      if (error instanceof Error && error.name === 'JwtTokenExpired') {
        throw apiError(401, 'UNAUTHORIZED', 'Token 已过期')
      }
      logger.warn('admin token rejected', { error: String(error) })
      throw apiError(403, 'FORBIDDEN', '非法 Token')
    }
  }

  return { login, auth }
}
