# 同装相册 / Torzo Gallery

同装相册是一个面向活动照片征集、展示和投票的相册站点。公开页用于浏览相册、投稿和投票；后台用于管理相册、相片、成员和投票数据。

当前前端入口是 `web/`，使用 React 19、Vite、TypeScript 和 React Router。`front/` 与 `dashboard/` 已在 v4 分支中删除，旧实现仍可从 `dev` 分支历史追溯；`server/` 是后端 API，不在本文档范围内。

当前状态和后续计划见 [TODOS.md](TODOS.md)。

## 快速开始

要求 Node.js >= 24.22.1、pnpm >= 10.24.0。

```bash
cd web
nvm use
pnpm install
pnpm dev
```

默认打开 `http://localhost:3000`。公开页在 `/`，后台在 `/admin`。

代理、环境变量、构建和部署说明见 [docs/configure.md](docs/configure.md)。遇到问题先看 [docs/troubleshooting.md](docs/troubleshooting.md)。

## 文档

完整文档索引在 [docs/introduction.md](docs/introduction.md)。参与开发或让 agent 接手前，请先阅读 [AGENTS.md](AGENTS.md)。
