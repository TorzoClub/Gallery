# AGENTS.md

本文件面向接手项目的 AI agent。开始前先读本文，再读文档索引和现有代码。

## 阅读顺序

1. `AGENTS.md`
2. `README.md`
3. `docs/introduction.md`（完整文档索引）
4. `docs/configure.md`
5. `docs/designs.md`
6. 按任务需要读 `docs/troubleshooting.md`、`docs/glossary.md`、`TODOS.md`

文档索引只在 [docs/introduction.md](docs/introduction.md) 维护，不要在其他文件重复一份。

## 当前事实

- `web/` 是当前默认前端；`web-new/` 是对接新 API 的迁移客户端。
- `front/`、`dashboard/` 已从 `v4` 删除；旧历史在 `dev`，不要恢复或继续开发。
- `api/` 是新的活动后端，使用 Hono/Zod/Vitest/Immutable；`web-new/` 已开始对接，`web/` 仍指向旧 API。
- `server/` 默认不修改，不依赖其内部细节，也不要把 server 内部信息写进文档。
- 现有旧 CI 仍指向旧目录；`.github/workflows/api.yml` 只覆盖 `api/`，不要假设它覆盖前端。

当前状态和后续待办见 [TODOS.md](TODOS.md)。

## 硬边界

- 未明确要求时，不修改 `server/`；新后端工作放在 `api/`。
- 未明确要求时，不恢复或修改已删除的 `front/`、`dashboard/`；需要参考时看 `dev` 历史。
- 不新增运行时依赖、UI 框架、动画库、日期库，除非先向用户确认。
- 不提交 `.npmrc`、`.env.local`、`.env.*.local`、密码、token。
- 文档与代码冲突时，以代码和实际配置为准，并修正文档。
- 不在文档中记录 server 的接口、数据库、鉴权、配置、部署或内部模块。

## 工作流程

1. 先读文档，再读相关代码和现有组件。
2. 修改范围优先限制在 `web/`、`web-new/` 或 `api/`。
3. 保持后台路由和后台样式异步加载，不要把后台代码带回公开页首屏。
4. 优先复用现有组件和样式，不引入新框架。
5. 改完后更新相关文档。
6. 用下面的命令验证。

## 验证命令

```bash
cd web
pnpm typecheck
pnpm lint
pnpm build

cd api
pnpm typecheck
pnpm lint
pnpm test
pnpm build

cd web-new
pnpm typecheck
pnpm lint
pnpm build
```

必要时启动 `pnpm dev` 做浏览器冒烟；API 测试使用临时 storage，不需要 MySQL。

## 设计规则

- 精确：直接操作要跟手，状态变化默认瞬时，不给普通交互加过渡。
- 有趣：只有明确叙事价值的时刻才用动画，例如灭霸消散、致命错误关闭荧幕。
- 克制：少即是多；瞬时状态足够就不加动画；没有比“精确”更好的方案就不加。
- 公开页是“纸质独立刊物 + 早期日式个人网站 + 早期 OS X 式轻拟物”；后台保持工具化，不要把公开页风格搬进后台。

完整原则和公开页 UI 风格见 [docs/designs.md](docs/designs.md)。

## 对用户疏漏的提示义务

用户可能疏忽、错漏或记不清。agent 如果意识到用户存在这类问题，应根据严重程度主动提示，不要沉默。

分级：

- **贴士**：细节遗漏、存在可选项。
- **提醒**：可能导致潜在 bug、体验或美学偏差。
- **建议**：技术选型、代码实现、优化项。
- **强烈建议**：安全问题，或继续这样下去项目会走向失控。

提示时说清判断依据。重大问题不要越过用户直接执行，先提出风险和建议。

## 文档维护规则

- 命令、环境变量、路由边界变化时，更新 `README.md`、`docs/configure.md`。
- 设计原则或公开页风格变化时，更新 `docs/designs.md`。
- 项目状态、范围、CI 变化时，更新 `TODOS.md`。
- 新增领域术语时，更新 `docs/glossary.md`。
- `web/README.md` 只介绍 `package.json` 和 scripts，不重复配置文档。

## 完成标准

- 变更范围明确，没有波及 `server/` 和废弃目录。
- 类型检查、lint、构建通过；需要时完成浏览器冒烟。
- 没有引入未经确认的依赖。
- 相关文档已同步。
- 没有提交本地敏感配置。
