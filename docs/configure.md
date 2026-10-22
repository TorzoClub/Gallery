# 配置

本文只记录 `web/` 前端的运行和构建配置。server 的配置与启动方式不在本文档维护。

## 环境要求

- Node.js >= 24.22.1
- pnpm >= 10.24.0

`web/.nvmrc` 固定为 Node 24.22.1：

```bash
nvm use
node -v
```

## 安装

```bash
cd web
pnpm install
```

本机需要代理时，在 `web/.npmrc` 配置。下面只是示例，端口和代理方式按本机情况替换：

```ini
registry=https://registry.npmjs.org/
proxy=socks5://127.0.0.1:503
http-proxy=socks5://127.0.0.1:503
https-proxy=socks5://127.0.0.1:503
```

`.npmrc`、`.env.local` 和 `.env.*.local` 已由 `.gitignore` 忽略，不要提交。

## 环境变量

前端只读取 `VITE_` 前缀的变量。

| 变量 | 开发默认 | 生产默认 | 用途 |
|---|---|---|---|
| `VITE_API_PREFIX` | `http://localhost:7001/` | `/torzo-gallery-server/` | HTTP API 前缀，末尾自动补 `/` |
| `VITE_CACHE_WORKER_URL` | 空 | `https://gallerystatic.torzo.club/` | 公开展示图片的缓存 worker，可留空 |
| `VITE_BUILD_DESCRIPTION` | `Development version.` | 空 | 公开页左上角构建说明 |
| `VITE_BASE_PATH` | `/` | `/` | 站点 base path，必须以 `/` 开头和结尾 |

本地覆盖使用不提交的 `web/.env.local`，例如：

```dotenv
VITE_API_PREFIX=http://localhost:7001/
```

修改环境变量后需要重启 `pnpm dev`。

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 启动 Vite 开发服务器，默认 `http://localhost:3000` |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm lint` | ESLint |
| `pnpm build` | 先类型检查，再构建到 `web/dist/` |
| `pnpm build:only` | 跳过类型检查直接构建 |
| `pnpm preview` | 预览构建产物 |

提交前至少运行：

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## 部署

构建产物是 `web/dist/`，可以部署到任意静态服务器。

默认部署在站点根路径，此时公开页是 `/`，后台是 `/admin`。

如果部署在子路径，例如 `https://example.com/torzo-gallery/`，设置：

```dotenv
VITE_BASE_PATH=/torzo-gallery/
```

后台地址会变成 `/torzo-gallery/admin`。资源路径由 Vite base 处理，不要手写死路径。

项目使用 `BrowserRouter`。直接访问或刷新后台深层路由时，静态服务器需要把请求回退到 `index.html`。Nginx 的通用写法：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

生产环境的 API 前缀默认与页面同源。如果反向代理路径不同，修改 `VITE_API_PREFIX`。

## 安全边界

- 不提交 `.npmrc`、`.env.local`、`.env.*.local`。
- 不在文档、代码或提交信息中记录密码、token、数据库地址。
- 本地代理配置只属于本机环境，不作为项目依赖提交。
- 前端环境变量只放公开配置，不放服务端密钥。

遇到问题见 [troubleshooting.md](troubleshooting.md)。
