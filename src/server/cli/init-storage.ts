import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { createStorage } from '../storage'
import { fileExists } from '../storage/fs'
import { createLogger } from '../logger'

export type InitStorageResult = {
  storage_path: string
  initialized: boolean
}

export async function initStorage(input: {
  storage_path: string
}): Promise<InitStorageResult> {
  const storage_path = path.resolve(input.storage_path)
  const logger = createLogger({ level: 'error', pretty: true })
  const storage = await createStorage({
    storage_path,
    allow_empty_data: true,
    logger,
  })

  try {
    const already_initialized = await fileExists(storage.paths.pool_file)
    await storage.load()
    return {
      storage_path,
      initialized: !already_initialized,
    }
  } finally {
    await storage.close()
  }
}

function printHelp(): void {
  console.log(`初始化 API storage

用法:
  pnpm storage:init [--storage-path <path>] [--json]

参数:
  --storage-path <path>  storage 目录；默认读取 STORAGE_PATH，否则 ./storage
  --json                 输出 JSON，便于脚本使用
  --help                 显示帮助

行为:
  - 创建 storage 目录结构、空 pool、members 和 instance 配置
  - 已存在的 storage 只做加载与校验，不覆盖数据
  - 如果 storage 已被运行中的 API 锁定，会拒绝执行`)
}

async function main(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      'storage-path': { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })

  if (parsed.values.help) {
    printHelp()
    return
  }

  const storage_path = parsed.values['storage-path']
    ?? process.env.STORAGE_PATH
    ?? './storage'

  const result = await initStorage({ storage_path })

  if (parsed.values.json) {
    console.log(JSON.stringify(result))
  } else if (result.initialized) {
    console.log(`storage 已初始化: ${result.storage_path}`)
  } else {
    console.log(`storage 已存在，未覆盖: ${result.storage_path}`)
  }
}

const is_entry = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (is_entry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
