# 配置

本文记录根目录单体应用的安装、运行配置、instance 配置、构建、缓存和部署。旧的 `server/`、`web/` 配置已从当前分支移除，归档在 [`legacy-v3`](https://github.com/TorzoClub/Gallery/tree/legacy-v3) 分支，不再维护。

## 环境要求

- Node.js >= 24.22.1
- pnpm >= 10.24.0

```bash
nvm use
node -v
```

## 安装与开发

```bash
pnpm install
cp .env.example .env.development
pnpm storage:init
pnpm dev
```

- 只有一个端口：`HTTP_PORT`（默认 `7001`）。
- Hono 在 Node HTTP Server 最前面处理 API。
- development 下非 API 请求进入同进程的 Vite middleware；production 下进入 Hono 的 `dist/client` 静态服务。
- 公开页 `/explore`（`/` 重定向），About 页 `/behind`，取消投稿频道 `/cancelSubmission`（别名 `/removingSubmission`），后台入口 `/admin`。
- 单体 SPA 服务要求 `API_BASE_PATH=/`；`VITE_BASE_PATH` 也按根路径部署。
- 不再有独立的 Vite 3000 端口或 proxy。

从局域网访问时，示例：

```dotenv
HTTP_HOSTNAME=0.0.0.0
HTTP_PORT=3000
PUBLIC_BASE_URL=http://10.0.0.5:3000
CORS_ORIGINS=http://10.0.0.5:3000
```

`PUBLIC_BASE_URL` 必须是浏览器实际访问的 origin，否则 API 返回的图片 URL 会指向 `localhost`。

本机需要代理时，在根 `.npmrc` 配置。`.npmrc`、`.env`、`.env.*` 已忽略，不要提交。

## 环境变量

进程启动后不可变，来自 `.env.development` / `.env.production` 或进程环境。完整模板见 `.env.example`。

| 变量 | 默认 | 说明 |
|---|---|---|
| `APP_ENV` | `development` | `development` / `test` / `production` |
| `HTTP_PORT` | `7001` | 唯一 HTTP 端口（development/production 共用） |
| `HTTP_HOSTNAME` | `0.0.0.0` | 监听地址，不是公网域名；兼容旧 `HTTP_HOST` |
| `STORAGE_PATH` | 必填 | JSON 和图片 storage 目录 |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `ADMIN_PASSWORD` | 必填 | 后台登录密码 |
| `JWT_SECRET` | 必填 | JWT HS256 密钥；production 至少 32 字符 |
| `JWT_EXPIRES_IN_SECONDS` | `43200` | token 有效期，最少 60 秒 |
| `CORS_ORIGINS` | dev `*`，prod 空 | 逗号分隔的 CORS 白名单；同源部署通常留空 |
| `API_BASE_PATH` | `/` | API 基础路径；SPA 部署要求 `/` |
| `PUBLIC_BASE_URL` | `http://localhost:<port>` | 浏览器访问的 origin，用于图片 URL；production 必须显式设置 |
| `HTTP_BODY_HARD_LIMIT_BYTES` | `67108864` | 请求体硬上限 |
| `ALLOW_EMPTY_DATA` | `false` | 仅首次初始化生产空 storage 时临时设为 `true` |

生产模式缺少 `ADMIN_PASSWORD`、`JWT_SECRET` 或 `PUBLIC_BASE_URL` 会退出；`JWT_SECRET` 少于 32 字符也会退出。

### 监听地址与公开 URL

- `HTTP_HOSTNAME` 是服务器绑定地址，不是域名，也不是 `Host` 校验：`0.0.0.0` 监听所有网卡，`127.0.0.1` 仅本机，`10.0.0.5` 仅该网卡。浏览器不能直接访问 `0.0.0.0`。
- `HTTP_PORT` 是唯一 HTTP 端口。development 和 production 都使用它；Vite 不再单独监听端口。
- `PUBLIC_BASE_URL` 是浏览器实际访问的 origin，用于生成图片绝对 URL；它不控制监听。远程访问时若仍写 `http://localhost:<port>`，图片会指向访问者自己的机器。
- 三者示例：监听 `0.0.0.0:3000`，并通过 `http://10.0.0.5:3000` 访问时，应设置 `HTTP_HOSTNAME=0.0.0.0`、`HTTP_PORT=3000`、`PUBLIC_BASE_URL=http://10.0.0.5:3000`。
- `HTTP_HOST` 是旧的兼容别名；优先使用 `HTTP_HOSTNAME`。

前端构建变量：

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_API_PREFIX` | `/` | 同源 API 前缀，末尾自动补 `/` |
| `VITE_BASE_PATH` | `/` | 站点 base path；当前单体服务按根路径部署 |
| `VITE_CACHE_WORKER_URL` | 空 | 公开展示图片的可选缓存 worker |
| `VITE_BUILD_DESCRIPTION` | 空 | 公开页构建说明 |

前端变量在 `pnpm build:client` 时读取，修改后需要重新构建。

## instance 配置

运行期可修改，保存在 `<STORAGE_PATH>/instance-config.json`。首次启动自动写入默认值。

| 字段 | 默认 | 范围 | 用途 |
|---|---:|---:|---|
| `avatar_thumb_size` | 128 | 16–2048 | 头像缩略图边长 |
| `image_thumb_size` | 640 | 32–4096 | 相片缩略图边长 |
| `image_thumb_quality` | 40 | 1–100 | 缩略图 AVIF 质量 |
| `avif_source_quality` | 75 | 1–100 | 全尺寸 optimized AVIF 质量 |
| `image_processing_effort` | 8 | 0–9 | 所有图片处理的 sharp effort |
| `max_image_dimension` | 3840 | 256–16384 | optimized 全尺寸图最大边 |
| `max_upload_bytes` | 16777216 | 1024–1GiB | 上传大小上限，且不能超过请求体硬上限 |

通过新后台 `/admin` 的“运行期配置”修改，或调用：

```text
adminGetInstanceConfig
adminUpdateInstanceConfig
```

修改只影响后续上传和 optimized/缩略图生成，不会自动重做已有图片。source 始终保留原图，不受这些图像处理配置影响。已有图片可以在后台用“重新生成图片”处理。

## 临时文件

上传先写入：

```text
<STORAGE_PATH>/stored-images/
├── source/       # 原图原始字节：photo-...-<crc>.<format> / avatar-<member-id>-<crc>.<format>
├── optimized/    # photo-...-<crc>-sdr.avif
├── thumb/        # photo-...-<crc>.avif；头像 avatar-<member-id>-<crc>.avif，SDR AVIF
└── temp/         # <uuidv7>.<format>
```

- `temp_id` 是 UUIDv7，响应中不带扩展名。
- 上传流在 `createUploadHandler` 里边读边算 CRC32，并在超过 `max_upload_bytes` 时中止。
- 创建相片/头像后临时文件立即删除。
- image pipeline 每 24 小时清理超过 24 小时的 UUIDv7 临时文件。
- API 进程关闭时会停止清理定时器。

## 命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 单进程、单端口的后端优先开发模式（Vite middleware） |
| `pnpm storage:init` | 初始化 storage 目录和空数据 |
| `pnpm update-storage` | 将旧 storage schema 升级到当前版本 |
| `pnpm typecheck` | client + server TypeScript 检查 |
| `pnpm lint` | oxlint |
| `pnpm test` | Vitest 服务端测试 |
| `pnpm build` | 构建 `dist/client` + `dist/server` |
| `pnpm analyze` | 构建前端并生成 `dist/client/stats.html` 包分析 |
| `pnpm start` | 构建后启动生产服务 |
| `pnpm start:prod` | 直接启动已构建的生产服务 |

`pnpm start` 先执行前端和服务端构建，然后由 Hono 提供 `dist/client`。

前端全局样式由 `src/web/index.css` 引入 Tailwind CSS v4，Vite 使用 `@tailwindcss/vite` 处理。

### gzip / Brotli 预压缩

`pnpm build` 的前端构建完成后会对 `dist/client` 中的文件生成：

```text
<file>.gz
<file>.br
```

- gzip 使用 level 9。
- Brotli 使用 quality 11，扩展名是标准的 `.br`。
- 已存在的 `.gz` / `.br` / `.zst` 文件不会再次压缩。
- `pnpm start` 通过 `pnpm build` 自动生成这些副本；`pnpm start:prod` 使用已经构建好的产物。

生产服务使用 Hono 的 `serveStatic({ precompressed: true })`，按客户端 `Accept-Encoding` 选择：

```text
br -> gzip -> 原文件
```

压缩响应会设置 `Content-Encoding`、`Content-Length` 和 `Vary: Accept-Encoding`。没有压缩副本时自动回退到原文件。SPA fallback 的 `index.html` 也会优先使用 `.br` / `.gz` 副本。

`pnpm analyze` 只生成包分析报告，不额外生成压缩副本。

构建时会注入 `build_date` 和 `git_hash`，并随 ClientPool 暴露给 Behind 页面；development 下两者都是 `N/A`。`git_hash` 取 `git rev-parse --short HEAD`，没有 git 元数据时回退 `N/A`。

## Storage 初始化

```bash
pnpm storage:init
pnpm storage:init --storage-path ./storage-dev
pnpm storage:init --storage-path ./storage-dev --json
```

创建 `pool.json`、`members.json`、`galleries/`、`stored-images/{source,optimized,thumb,temp}` 和 `instance-config.json`。已存在的 storage 只加载校验，不覆盖；如果 API 正在持有 lock，会失败。

Docker 内：

```bash
docker compose run --rm api node dist/server/cli/init-storage.js --storage-path /data
```

### Storage schema 更新

当前 storage schema 为 v2。新初始化的 storage 直接使用 v2。

从旧 storage 升级前先备份整个 storage 目录，然后在服务停止、storage lock 未被占用时执行：

```bash
pnpm update-storage
pnpm update-storage --storage-path ./storage
pnpm update-storage --json
```

v1 -> v2 会把成员头像文件从：

```text
avatar-<qq_num>-<crc32>.<format>
```

重命名为：

```text
avatar-<member-id>-<crc32>.<format>
```

并同步更新 `members.json` 的 `avatar_src` 和 `pool.json` 的 `schema_version`。

v1 storage 不能直接启动；服务会提示运行 `pnpm update-storage`。v3 或更高版本也会被拒绝。updater 是可重复执行的；如果中途失败，不会推进版本，已完成的文件重命名会尽量回滚。

## 构建与缓存

构建产物：

```text
dist/
├── client/
│   ├── index.html
│   └── assets/<name>-<hash>.js|css|png...
└── server/
    ├── index.js
    ├── cli/init-storage.js
    └── cli/update-storage.js
```

缓存策略：

| 路径 | Cache-Control |
|---|---|
| `/assets/*` | `public, max-age=31536000, immutable` |
| `/images/source/*`、`/images/optimized/*`、`/images/thumb/*` | `public, max-age=31536000, immutable` |
| `/`、`index.html`、SPA fallback | `no-cache` |
| `public` 下的图片 | `public, max-age=31536000, immutable` |
| 其他静态文件（如 manifest） | `public, max-age=3600` |

前端 bundle 由 Vite 生成 hash 文件名。HTML 不 hash，所以使用 `no-cache`，确保每次先重新验证 HTML，再加载新的 hash bundle。source 文件名为 `photo-<gallery_id>-<photo_id>-<crc32>.<format>`；photo optimized 固定为 `-sdr.avif`，photo thumb 为无后缀 `.avif`。头像 source 为 `avatar-<member-id>-<crc32>.<format>`，thumb 为 `avatar-<member-id>-<crc32>.avif`。

当前 Phase 0 所有输入都只生成 8-bit SDR optimized/thumb；HDR optimized 暂不生成。后续 HDR 方案见 [todo/hdr-supports.md](todo/hdr-supports.md)。

派生图 URL 带 `?v=<instance_hash>`；`instance_hash` 是当前 instance_config 的 CRC32。修改 instance 配置后，API 返回新的版本 URL，避免 immutable 缓存命中旧图。旧命名的相片变体会在“重新生成图片”时清理。

production 下 Hono 的静态服务顺序（development 的非 API 请求先由 Vite middleware 处理）：

1. API 路由；
2. `dist/client` 真实文件；
3. SPA fallback 到 `index.html`；
4. API-like GET 和缺失的 `/assets/*` 返回 JSON 404，不返回 HTML（development 的 `/assets/*` 由 Vite 处理）。

## 部署

根路径部署：

```bash
cp .env.example .env.production
# 填写 ADMIN_PASSWORD、JWT_SECRET、PUBLIC_BASE_URL、STORAGE_PATH
pnpm start
```

生产环境要求：

- `API_BASE_PATH=/`
- `VITE_BASE_PATH=/`
- `PUBLIC_BASE_URL` 是浏览器可访问的站点 origin
- 同一 storage 只运行一个 API 进程
- 反向代理直接转发到 Hono，不需要单独的静态服务器

Docker：

```bash
docker compose up -d --build
```

镜像构建阶段执行 `pnpm build`，运行阶段执行 `node dist/server/index.js`，不重新构建前端。数据卷挂载到 `/data`。

## 安全边界

- 不提交 `.npmrc`、`.env`、`.env.*`、密码、JWT secret、storage 数据。
- 前端 `VITE_` 变量是公开的，不放服务端密钥。
- `ADMIN_PASSWORD` 和 `JWT_SECRET` 只放服务端环境。
- 修改 `JWT_SECRET` 会使已有 token 失效，需要重新登录。

遇到问题见 [troubleshooting.md](troubleshooting.md)。
