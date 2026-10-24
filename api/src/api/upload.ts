import { Hono } from 'hono'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const app = new Hono()

app.post('/', async (c) => {
  // 1. 解析 multipart/form-data 表单数据
  const body = await c.req.parseBody()
  const file = body['file']

  // 2. 校验是否为合法的 File 对象
  if (!file || typeof file !== 'object' || !('name' in file)) {
    return c.json({ success: false, message: '请上传有效的文件' }, 400)
  }

  try {
    // 3. 生成目标路径 /tmp/[timestamp].[extname]
    const extname = path.extname(file.name) // 获取扩展名 (如 .png, .jpg)
    const filename = `${Date.now()}${extname}`

    const tmpDir = path.resolve('/tmp')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    const targetPath = path.join(tmpDir, filename)

    // 4. 将 Web 标准 ReadableStream 转换为 Node.js Readable 流
    const webStream = file.stream()
    const nodeReadable = fs.ReadStream.fromWeb(webStream)

    // 5. 创建写入流，并通过 pipeline 执行流式管道传输（自动管理背压与资源释放）
    const nodeWritable = fs.createWriteStream(targetPath)
    await pipeline(nodeReadable, nodeWritable)

    return c.json({
      success: true,
      message: '图片流式写入成功！',
      data: {
        filename,
        savedPath: targetPath,
        size: file.size,
      }
    })
  } catch (error: any) {
    console.error('文件流写入失败:', error)
    return c.json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    }, 500)
  }
})

export default app
