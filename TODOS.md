# TODOS / 项目状态

本文记录项目当前状态和后续清理事项，不是详细设计文档。

## 当前状态

- `web/` 是唯一活动前端，包含公开相册和后台管理。
- `front/`、`dashboard/` 已在 `v4` 分支中删除；旧实现只保留在 `dev` 分支历史中。
- `server/` 是后端 API，暂不进入文档范围；后续重构完成后再单独补文档。
- 现有 CI workflow 仍指向旧目录，尚未迁移到 `web/`；迁移完成前，`v4` 上相关 CI 任务会失败。

## 后续待办

- [x] 已在 `v4` 分支删除 `front/` 和 `dashboard/`。
- [ ] 将 CI 迁移到 `web/`，使用 Node 24.22.1 + pnpm，构建产物为 `web/dist`。
- [ ] server 重构完成后，补充 server 自己的文档。
- [ ] 清理仓库中不再使用的临时文件和旧构建配置。

状态变化时同步更新本文、[README.md](README.md) 和 [AGENTS.md](AGENTS.md)。
