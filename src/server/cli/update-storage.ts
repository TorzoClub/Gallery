import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { updateStorage } from '../storage/update'

function printHelp(): void {
  console.log(`更新 storage schema 版本

用法:
  pnpm update-storage [--storage-path <path>] [--json]

参数:
  --storage-path <path>  storage 目录；默认读取 STORAGE_PATH，否则 ./storage
  --json                 输出 JSON
  --help                 显示帮助

行为:
  - 按顺序执行 storage updater，将旧 schema 升级到当前版本
  - 升级前请备份 storage 目录
  - storage 正在被服务占用时拒绝执行
`)
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

  const storage_path = path.resolve(
    parsed.values['storage-path']
      ?? process.env.STORAGE_PATH
      ?? './storage',
  )
  const result = await updateStorage(storage_path)

  if (parsed.values.json) {
    console.log(JSON.stringify({ storage_path, ...result }))
    return
  }

  if (!result.changed) {
    console.log(`storage 已经是 schema v${result.to}，无需更新: ${storage_path}`)
    return
  }

  console.log(`storage 已更新: v${result.from} -> v${result.to}`)
  console.log(`迁移头像文件: ${result.renamed_avatars}`)
  console.log(`storage 路径: ${storage_path}`)
}

const is_entry = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (is_entry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
