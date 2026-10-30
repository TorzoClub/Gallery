# 同装相册 / Torzo Gallery

同装相册是一个面向活动照片征集、展示和投票的相册站点。公开页用于浏览相册、投稿和投票；后台用于管理相册、相片、成员、投票和运行期配置。

当前是**单体 SPA + dispatch API**：同一个 Node HTTP Server 监听唯一端口，Hono 在后端最前面处理 API；development 的非 API 请求进入同进程 Vite middleware，production 由 Hono 提供 `dist/client`。旧 `server/`、`web/` 已从当前分支移除，归档在 [`legacy-v3`](https://github.com/TorzoClub/Gallery/tree/legacy-v3) 分支，只作历史参考，不参与当前构建。

## 快速开始

要求 Node.js >= 24.22.1、pnpm >= 10.24.0。

```bash
nvm use
pnpm install
cp .env.example .env.development
pnpm storage:init
pnpm dev
```

默认打开 `http://localhost:7001`。development 和 production 一样，只有一个后端端口：Hono 处理 API，Vite 作为同进程 middleware 提供开发页面。公开页在 `/`，后台在 `/admin`。

首次启动 storage、环境变量和代理配置见 [docs/configure.md](docs/configure.md)。

## 生产运行

```bash
cp .env.example .env.production
# 填写 ADMIN_PASSWORD、JWT_SECRET、STORAGE_PATH、PUBLIC_BASE_URL 等
pnpm start
```

`pnpm start` 会先构建前端到 `dist/client`、服务端到 `dist/server`，然后由 Hono 提供 SPA、API 和图片。默认地址是 `http://localhost:7001`。

Docker：

```bash
docker compose up -d --build
```

## 文档

- [docs/introduction.md](docs/introduction.md)：项目结构、技术栈和文档索引
- [docs/configure.md](docs/configure.md)：环境变量、instance 配置、构建、缓存、部署
- [docs/api.md](docs/api.md)：HTTP 接口和 dispatch action
- [docs/auth.md](docs/auth.md)：后台登录、JWT 和权限边界
- [docs/troubleshooting.md](docs/troubleshooting.md)：常见问题
- [AGENTS.md](AGENTS.md)：协作和 agent 工作边界
- [TODOS.md](TODOS.md)：当前状态和后续待办
