import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'

// 定义 JWT 密钥（生产环境请使用环境变量 process.env.JWT_SECRET）
const JWT_SECRET = 'my-super-secret-key-2026'

// ==========================================
// 1. 创建子应用：Admin 模块
// ==========================================
const adminApp = new Hono()

// (1) 公开路由：登录接口（必须放在拦截中间件的前面）
adminApp.post('/login', async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>()
  const { username, password } = body

  if (username === 'admin' && password === '123456') {
    const payload = {
      username: 'admin',
      role: 'super_admin',
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1小时后过期
    }
    const token = await sign(payload, JWT_SECRET)
    return c.json({ success: true, message: '登录成功', token })
  }

  return c.json({ success: false, message: '用户名或密码错误' }, 401)
})

// (2) JWT 校验中间件（拦截该子应用下的所有后续路由）
adminApp.use('/*', async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, code: 401, message: '未提供 Token 或 Token 格式错误' }, 401)
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = await verify(token, JWT_SECRET)
    // 将解析出的 payload 挂载到上下文中
    c.set('jwtPayload', payload)
    await next()
  } catch (error: any) {
    let message = 'Token 无效'
    if (error.name === 'JwtTokenExpired' || error.message?.includes('exp')) {
      message = 'Token 已超时，请重新登录'
    }
    return c.json({ success: false, code: 401, message }, 401)
  }
})

// (3) 受保护的子路由
adminApp.get('/', (c) => {
  const payload = c.get('jwtPayload')
  return c.json({ success: true, message: '欢迎来到管理后台首页', user: payload })
})

adminApp.get('/test', (c) => {
  return c.json({ success: true, data: { test: 'tjioajfioasijf' } })
})

export default adminApp
