import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { migrateLegacy } from '../migration/legacy'

function printHelp(): void {
  console.log(`从 Legacy Gallery admin API 迁移数据

用法:
  pnpm migration:legacy --storage_path <path> --api_url <url> --admin-password <password>

参数:
  --storage_path <path>    新的 storage 目录；目标必须不存在
  --api_url <url>          Legacy API 地址，例如 http://127.0.0.1:7001/
  --admin-password <pw>    Legacy admin 密码
  --json                   只向 stdout 输出最终 JSON
  --help                   显示帮助

行为:
  - 不连接 MySQL，只使用 Legacy admin API 和其静态 source 图片
  - 所有 Legacy gallery/member/photo/vote ID 都会重新映射
  - 迁移在临时 staging 目录完成，成功后才 rename 到 storage_path
  - 目标已存在、API 不可达、图片或数据校验失败时不会留下目标 storage

示例:
  pnpm migration:legacy \\
    --storage_path ./storage-migrated \\
    --api_url http://127.0.0.1:7001/ \\
    --admin-password '...'
`)
}

async function main(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: false,
    options: {
      storage_path: { type: 'string' },
      api_url: { type: 'string' },
      'admin-password': { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })

  if (parsed.values.help) {
    printHelp()
    return
  }

  const storage_path = parsed.values.storage_path
  const api_url = parsed.values.api_url
  const admin_password = parsed.values['admin-password']

  if (storage_path === undefined || storage_path.length === 0) {
    printHelp()
    throw new Error('缺少 --storage_path')
  }
  if (api_url === undefined || api_url.length === 0) {
    printHelp()
    throw new Error('缺少 --api_url')
  }
  if (admin_password === undefined || admin_password.length === 0) {
    printHelp()
    throw new Error('缺少 --admin-password')
  }

  const result = await migrateLegacy({
    api_url,
    admin_password,
    storage_path,
    on_progress: (message) => {
      process.stderr.write(`${message}\n`)
    },
  })

  if (parsed.values.json) {
    console.log(JSON.stringify(result))
    return
  }

  console.log(`迁移完成: ${result.storage_path}`)
  console.log(`galleries: ${result.galleries}`)
  console.log(`members: ${result.members}`)
  console.log(`photos: ${result.photos}`)
  console.log(`votes: ${result.votes}`)
  if (result.warnings.length > 0) {
    console.log('warnings:')
    for (const warning of result.warnings) {
      console.log(`- ${warning}`)
    }
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
