# TODOS / 项目状态

本文记录当前状态和后续清理事项，不是详细设计文档。

## 当前状态

- 根目录是单体 SPA + dispatch API：Hono 同源提供前端、API、图片和健康检查。
- development 和 production 都只有一个 HTTP 端口；development 的 Vite 以 middleware 挂在后端进程内，不单独监听。
- 前端在 `src/web/`，后端在 `src/server/`，共享 wire 类型在 `src/shared/`。
- 前端由 Vite 构建到 `dist/client`，服务端由 tsup 构建到 `dist/server`。
- 静态缓存：HTML 弱缓存，hash assets 强缓存，API/图片强缓存。
- 服务端测试 64 个用例通过；不包含浏览器 UI 交互测试。
- `legacy/server/`、`legacy/web/` 已冻结，旧 CI 归档到 `legacy/.github/workflows/`。
- storage 仍为单实例 JSON + 图片池；没有 MySQL 运行时依赖。

## 已完成

- [x] 新 dispatch API：query/mutate、admin 权限、instance 配置、图片准备/GC。
- [x] web-new 接入新 API，并合并到根目录 `src/web/`。
- [x] Hono 单进程 SPA serving、SPA fallback、API 404 隔离。
- [x] development 单端口：后端 HTTP Server 前置，Vite middleware 同进程提供页面/HMR。
- [x] Vite hash bundle、HTML 弱缓存、assets/images 强缓存。
- [x] `/admin/dashboard` 的 instance 配置设置区。
- [x] 根单包、TypeScript 7、统一 oxlint、根 CI。
- [x] 服务端静态/缓存、登录、storage、业务逻辑测试。
- [x] 服务端图片测试覆盖 EXIF Orientation、流式上传、UUIDv7 temp、CRC32 文件名和清理定时器。

## 后续待办

- [ ] 浏览器 UI 交互测试（公开页投稿/投票、后台编辑、配置表单）。
- [ ] 旧 server/web 数据迁移工具（如仍需要旧数据）。
- [ ] 真实部署的 CI/CD 和密钥管理。
- [ ] 如果未来需要多实例，设计跨进程 storage 写锁/共享存储方案。
- [ ] 视需要清理 `legacy/` 中不再需要的大文件和旧构建产物。

状态变化时同步更新本文、[README.md](README.md)、[AGENTS.md](AGENTS.md) 和相关 docs。
