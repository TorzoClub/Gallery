# 配置

本文记录根目录单体应用的安装、运行配置、instance 配置、构建、缓存和部署。旧的 `server/`、`web/` 配置已归档到 `legacy/`，不再维护。

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

- Vite：`http://localhost:3000`
- API：`http://127.0.0.1:7001`
- Vite 把 `/query`、`/mutate`、`/admin/query`、`/admin/mutate`、`/auth`、`/upload-image`、`/images`、`/healthz` 代理到 API。
- 公开页 `/`，后台 `/admin`。

本机需要代理时，在根 `.npmrc` 配置。`.npmrc`、`.env`、`.env.*` 已忽略，不要提交。

## 环境变量

进程启动后不可变，来自 `.env.development` / `.env.production` 或进程环境。完整模板见 `.env.example`。

| 变量 | 默认 | 说明 |
|---|---|---|
| `APP_ENV` | `development` | `development` / `test` / `production` |
| `HTTP_PORT` | `7001` | HTTP 端口 |
| `HOSTNAME` | `0.0.0.0` | `@hono/node-server` 监听 hostname；兼容旧 `HTTP_HOST` |
| `STORAGE_PATH` | 必填 | JSON 和图片 storage 目录 |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `ADMIN_PASSWORD` | 必填 | 后台登录密码 |
| `JWT_SECRET` | 必填 | JWT HS256 密钥；production 至少 32 字符 |
| `JWT_EXPIRES_IN_SECONDS` | `43200` | token 有效期，最少 60 秒 |
| `CORS_ORIGINS` | dev `*`，prod 空 | 逗号分隔的 CORS 白名单；同源部署通常留空 |
| `API_BASE_PATH` | `/` | API 基础路径；SPA 部署要求 `/` |
| `PUBLIC_BASE_URL` | `http://localhost:<port>` | 图片 URL 前缀；production 必须显式设置 |
| `HTTP_BODY_HARD_LIMIT_BYTES` | `67108864` | 请求体硬上限 |
| `ALLOW_EMPTY_DATA` | `false` | 仅首次初始化生产空 storage 时临时设为 `true` |

生产模式缺少 `ADMIN_PASSWORD`、`JWT_SECRET` 或 `PUBLIC_BASE_URL` 会退出；`JWT_SECRET` 少于 32 字符也会退出。

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
| `image_thumb_quality` | 40 | 1–100 | AVIF 质量 |
| `image_thumb_effort` | 8 | 0–9 | sharp effort |
| `max_image_dimension` | 3840 | 256–16384 | 原图归一化最大边 |
| `max_upload_bytes` | 16777216 | 1024–1GiB | 上传大小上限，且不能超过请求体硬上限 |

通过后台 `/admin/dashboard` 的“运行期配置”修改，或调用：

```text
adminGetInstanceConfig
adminUpdateInstanceConfig
```

修改只影响后续上传和缩略图生成，不会自动重做已有图片。已有图片可以在后台用缩略图重建功能处理。

## 临时文件

上传先写入：

```text
<STORAGE_PATH>/stored-images/temp/<uuidv7>.<format>
```

- `temp_id` 是 UUIDv7，响应中不带扩展名。
- 上传流在 `createUploadHandler` 里边读边算 CRC32，并在超过 `max_upload_bytes` 时中止。
- 创建相片/头像后临时文件立即删除。
- image pipeline 每 24 小时清理超过 24 小时的 UUIDv7 临时文件。
- API 进程关闭时会停止清理定时器。

## 命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | API watch + Vite |
| `pnpm dev:server` | 只启动 API watch |
| `pnpm dev:client` | 只启动 Vite |
| `pnpm storage:init` | 初始化 storage 目录和空数据 |
| `pnpm typecheck` | client + server TypeScript 检查 |
| `pnpm lint` | oxlint |
| `pnpm test` | Vitest 服务端测试 |
| `pnpm build` | 构建 `dist/client` + `dist/server` |
| `pnpm start` | 构建后启动生产服务 |
| `pnpm start:prod` | 直接启动已构建的生产服务 |

`pnpm start` 先执行前端和服务端构建，然后由 Hono 提供 `dist/client`。

## Storage 初始化

```bash
pnpm storage:init
pnpm storage:init --storage-path ./storage-dev
pnpm storage:init --storage-path ./storage-dev --json
```

创建 `pool.json`、`members.json`、`galleries/`、`stored-images/{source,thumb,temp}` 和 `instance-config.json`。已存在的 storage 只加载校验，不覆盖；如果 API 正在持有 lock，会失败。

Docker 内：

```bash
docker compose run --rm api node dist/server/cli/init-storage.js --storage-path /data
```

## 构建与缓存

构建产物：

```text
dist/
├── client/
│   ├── index.html
│   └── assets/<name>-<hash>.js|css|png...
└── server/
    ├── index.js
    └── cli/init-storage.js
```

缓存策略：

| 路径 | Cache-Control |
|---|---|
| `/assets/*` | `public, max-age=31536000, immutable` |
| `/images/source/*`、`/images/thumb/*` | `public, max-age=31536000, immutable` |
| `/`、`index.html`、SPA fallback | `no-cache` |
| `public` 下的图片 | `public, max-age=31536000, immutable` |
| 其他静态文件（如 manifest） | `public, max-age=3600` |

前端 bundle 由 Vite 生成 hash 文件名。HTML 不 hash，所以使用 `no-cache`，确保每次先重新验证 HTML，再加载新的 hash bundle。相片文件名为 `photo-<gallery_id>-<photo_id>-<crc32>.<format>`，头像为 `avatar-<qq_num>-<crc32>.<format>`，缩略图使用相同 basename 的 `.avif`；文件名由内容 CRC 驱动，因此可以长期强缓存。

Hono 的静态服务顺序：

1. API 路由；
2. `dist/client` 真实文件；
3. SPA fallback 到 `index.html`；
4. API-like GET 和缺失的 `/assets/*` 返回 JSON 404，不返回 HTML。

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
