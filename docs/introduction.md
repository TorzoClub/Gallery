# 项目概览

同装相册（Torzo Gallery）是一个面向活动照片征集、展示和投票的相册站点。公开页用于浏览相册、投稿和投票；后台用于管理相册、相片、成员、投票和运行期配置。

## 当前范围

- 根目录是单体 SPA + dispatch API：一个 Hono HTTP 服务同时提供前端、API、图片和健康检查。
- 前端在 `src/web/`，后端在 `src/server/`，共享 wire 类型在 `src/shared/`。
- 测试在 `test/`，当前覆盖服务端业务逻辑、storage、图片、登录、静态服务和缓存。
- `legacy/` 归档旧 `server/`、`web/`、脚本和 CI，不参与构建、测试、lint、部署。
- 后台页面和样式按路由异步加载，公开页首屏不会加载后台代码。

更细的状态和待办见 [TODOS.md](../TODOS.md)。

## 项目结构

```text
.
├── src/
│   ├── web/                 React SPA：公开页 + 后台
│   ├── server/              Hono dispatch API、storage、图片、CLI
│   └── shared/              DTO、instance config 类型
├── test/                    服务端测试
├── public/                  favicon、bg、manifest
├── index.html               Vite SPA 入口
├── docs/                    项目文档
├── legacy/                  冻结的旧实现
├── dist/
│   ├── client/              Vite 产物（hash assets）
│   └── server/              tsup 产物
├── README.md
├── TODOS.md
└── AGENTS.md
```

前端内部大致分为：

- 公开页组件、布局、hooks 和资源；
- `admin/` 后台页面、组件和样式；
- `api/` 同源 dispatch 客户端。

后端内部：

- `api/`：Hono 路由、登录、上传和静态服务；
- `instance/`：instance 生命周期、action registry、序列化、图片准备；
- `core/`：Immutable 领域模型；
- `storage/`：JSON/图片持久化、lock、codec；
- `config/`：env 和 instance 配置。

## 请求流

development 和 production 都由同一个 Node HTTP Server 监听唯一端口。Hono 始终在后端最前面；development 的 Vite 只是同进程 middleware，不单独监听端口。

```text
浏览器
  │  HTTP / WebSocket：唯一端口 HTTP_PORT
  ▼
Node HTTP Server
  │
  ├── API 路径（isApiLikePath）
  │     ├── POST /query/*, /mutate/*
  │     ├── POST /admin/query/*, /admin/mutate/*
  │     ├── POST /auth/login, /upload-image
  │     ├── GET /images/source|optimized|thumb/*
  │     └── GET /healthz
  │           ▼
  │        Hono API listener
  │           ├── dispatch action
  │           ├── instance / core / storage
  │           └── sharp 图片流程
  │
  ├── development：其他请求
  │     ▼
  │   Vite middleware（同进程，不单独监听）
  │     ├── index.html / SPA 路由
  │     ├── /src/*、/@vite/client
  │     ├── public 静态资源
  │     └── HMR WebSocket（同一端口）
  │
  └── production：其他请求
        ▼
      Hono static
        ├── dist/client 真实文件
        ├── SPA fallback 到 index.html
        └── hash assets / 图片强缓存
```

- API 路径不会进入 Vite。
- development 的 HMR WebSocket 也使用同一个端口，没有独立的 Vite 端口。
- production 不加载 Vite，所有非 API 请求由 Hono 静态服务和 SPA fallback 处理。

## 技术栈

- React 19
- Vite 8
- TypeScript 7
- React Router
- Hono + `@hono/node-server`
- Zod
- Immutable.js
- Vitest
- sharp
- pnpm

后台没有引入第三方 UI 框架；表格、弹窗、提示、上传和搜索选择器都在项目内实现。

## 关键决策

- 单体同源：前端与 API 在同一个 HTTP 服务下，避免 CORS 和跨服务部署。
- 前端 bundle 使用 hash 文件名并强缓存；HTML 使用 `no-cache` 弱缓存；source 保存原始上传字节，optimized/thumb 使用实体 ID + 内容 CRC32 文件名并强缓存；上传临时文件使用 UUIDv7。
- 公开页和后台共用前端入口，后台整体异步加载。
- 图片分三类：`source` 原图、`optimized` 全尺寸 SDR/HDR AVIF、`thumb` SDR/HDR AVIF 缩略图；相片 optimized/thumb 固定为 `-sdr.avif`/`-hdr.avif`，头像 source/thumb 同名。派生图 URL 带 instance hash 版本参数。
- 后台保持轻依赖和工具化，不套用公开页视觉风格。
- 后端通过 dispatch action 执行业务，admin action 只能从 admin 路由调用。
- storage 是单实例 JSON + 图片池；同一 storage 只允许一个进程写。
- 旧 `server/`、`web/` 冻结在 `legacy/`，不再继续开发。

公开页的视觉风格和设计原则见 [designs.md](designs.md)。

## 术语

相册、稿件、成员、投稿、投票、dispatch、instance 配置等术语见 [glossary.md](glossary.md)。

## 文档索引

| 文档 | 内容 |
|---|---|
| [README.md](../README.md) | 项目入口、快速开始 |
| [docs/introduction.md](introduction.md) | 项目结构、架构、技术栈、文档索引 |
| [docs/configure.md](configure.md) | 环境、安装、命令、环境变量、instance 配置、缓存、部署 |
| [docs/api.md](api.md) | HTTP 接口、dispatch action、上传和错误码 |
| [docs/auth.md](auth.md) | 后台登录、JWT、权限边界 |
| [docs/troubleshooting.md](troubleshooting.md) | 常见问题排查 |
| [docs/designs.md](designs.md) | 设计原则与公开页 UI 风格 |
| [docs/glossary.md](glossary.md) | 领域术语简表 |
| [TODOS.md](../TODOS.md) | 当前状态、范围、后续待办 |
| [AGENTS.md](../AGENTS.md) | AI agent 工作边界和验证要求 |
| [legacy/README.md](../legacy/README.md) | 冻结的旧实现说明 |
