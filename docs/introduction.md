# 项目概览

同装相册（Torzo Gallery）是一个面向活动照片征集、展示和投票的相册站点。它把公开相册和后台管理放在同一个前端应用里：

- 公开页 `/`：浏览相册、查看相片、参与投稿和投票。
- 后台 `/admin`：管理相册、相片、成员和投票数据。

## 当前范围

- `web/` 是当前维护的唯一前端入口。
- `front/`、`dashboard/` 已在 `v4` 分支中删除；旧实现只保留在 `dev` 分支历史中。
- `api/` 是新的后端服务，使用 Hono、Zod、Vitest、Immutable。
- `web-new/` 是对接新 dispatch API 的新客户端；当前默认前端仍是 `web/`。
- `server/` 是旧后端，保留只读，不再继续开发；本文档不展开其内部实现。
- 现有旧 CI 仍指向旧目录；新增的 API workflow 只覆盖 `api/`。

更细的状态和待办见 [TODOS.md](../TODOS.md)。

## 项目结构

```text
.
├── web/          当前默认前端：公开相册 + 后台
├── web-new/      对接新 API 的新客户端
├── api/          新后端：dispatch API + JSON/图片存储
├── server/       旧后端；只读，不再开发
├── docs/         项目文档
├── scripts/      仓库辅助脚本
├── README.md     项目入口
├── TODOS.md      当前状态与后续待办
└── AGENTS.md     AI agent 工作约定
```

`web/src/` 内部大致分为：

- 公开页组件、布局和资源；
- `admin/` 后台页面、组件和样式；
- 公共 API 客户端、hooks 和工具函数。

后台页面和样式按路由异步加载，公开页首屏不会加载后台代码。

## 高层架构

```text
浏览器
  ├── /        公开相册
  └── /admin   后台管理
        │
        ▼
      web/ 旧前端 ── HTTP ──> server/ 旧后端
      web-new/ 新前端 ── HTTP ──> api/ 新后端
```

前端只通过 HTTP API 与后端交互。旧 server 的模块、数据模型、鉴权、部署和内部配置不在本文件范围内。新后端的结构、配置和 dispatch 协议见 [api/README.md](../api/README.md)。

## 技术栈

- React 19
- Vite
- TypeScript
- React Router
- pnpm

新后端 `/api`：

- Hono + `@hono/node-server`
- Zod
- Immutable.js
- Vitest
- TypeScript 7
- sharp

后台没有引入第三方 UI 框架；表格、弹窗、提示、上传和搜索选择器都在项目内实现。

## 关键决策

- `web/` 是唯一活动前端；`front/`、`dashboard/` 已在 `v4` 删除。
- 公开页和后台共用同一前端入口，但后台整体异步加载。
- 后台保持轻依赖和工具化，不套用公开页的视觉风格。
- 文档覆盖前端、项目协作和新后端 `api/`；不覆盖旧 server 内部。
- 旧 CI 迁移单独处理；API 另有独立 workflow。
- 新后端先独立完成，再迁移 Web 客户端；`web-new/` 已开始对接，默认前端切换待定。

公开页的视觉风格和设计原则见 [designs.md](designs.md)。

## 术语

相册、稿件、成员、投稿、投票等术语的简要解释见 [glossary.md](glossary.md)。

## 文档索引

| 文档 | 内容 |
|---|---|
| [README.md](../README.md) | 项目入口、快速开始 |
| [docs/configure.md](configure.md) | 环境、安装、命令、环境变量、部署 |
| [docs/troubleshooting.md](troubleshooting.md) | 常见前端问题排查 |
| [docs/designs.md](designs.md) | 设计原则与公开页 UI 风格 |
| [docs/glossary.md](glossary.md) | 领域术语简表 |
| [TODOS.md](../TODOS.md) | 当前状态、范围、后续待办 |
| [AGENTS.md](../AGENTS.md) | AI agent 工作边界和验证要求 |
| [web/README.md](../web/README.md) | 前端 package 与 scripts 简介 |
| [api/README.md](../api/README.md) | 新后端配置、dispatch、存储、测试和 Docker |
| [web-new/README.md](../web-new/README.md) | 新客户端与 dispatch API 的对接说明 |
