import { Hono } from 'hono'
import adminApp from './admin'
import uploadApp from './upload'
import { __mutation_name } from '../instance'

export function constructApi() {
  const app = new Hono()

  app.route('/admin', adminApp)
  app.route('/upload', uploadApp)

  app.get('/', (c) => {
    return c.text('Hello World! 欢迎访问首页')
  })

  type MutationDTO = {
    mutate_name: __mutation_name
    parameters: any[]
  }

  app.post('/mutate', async (c) => {
    try {
      const body = await c.req.json<MutationDTO>()
      const { mutate_name, parameters } = body
      return c.json({
        success: true,
        message: 'success',
        data: {}
      }, 201)

    } catch (error: any) {
      // 捕获 JSON 解析错误（如请求体不是合法的 JSON）
      return c.json({
        success: false,
        message: '请求体 JSON 格式错误或解析失败',
        error: error.message
      }, 400)
    }
  })
  return app
}
