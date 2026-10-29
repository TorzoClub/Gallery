# AGENTS.md

本文件面向接手项目的 AI agent。开始前先读本文，再读文档索引和现有代码。

## 阅读顺序

1. `AGENTS.md`
2. `README.md`
3. `docs/introduction.md`（完整文档索引）
4. `docs/configure.md`
5. `docs/api.md`、`docs/auth.md`
6. 按任务需要读 `docs/troubleshooting.md`、`docs/glossary.md`、`TODOS.md`

文档索引只在 [docs/introduction.md](docs/introduction.md) 维护，不要在其他文件重复一份。

## 当前事实

- 根目录是单体 SPA + dispatch API：一个 Node HTTP Server 监听唯一端口；Hono 始终在后端最前面，development 的非 API 请求进入同进程 Vite middleware，production 由 Hono 提供前端静态文件。
- 前端在 `src/web/`，后端在 `src/server/`，共享 wire 类型在 `src/shared/`。
- 服务端测试在 `test/`；当前没有浏览器 UI 交互测试。
- 前端 bundle 由 Vite 生成 hash 文件；HTML 弱缓存，assets/images 强缓存。
- `legacy/server/`、`legacy/web/` 已冻结，不参与构建、测试、lint、CI 或部署。
- storage 是单实例 JSON + 图片池；同一 storage 同时只允许一个进程写。
- 当前没有 MySQL 运行时依赖。

## 硬边界

- 未明确要求时，不修改 `legacy/`。
- 不新增运行时依赖、UI 框架、动画库、日期库，除非先向用户确认。
- 不提交 `.npmrc`、`.env`、`.env.*`、密码、token 或 storage 数据。
- 文档与代码冲突时，以代码和实际配置为准，并修正文档。
- 不在文档中记录密码、JWT secret、真实部署地址等敏感信息。
- 不做网页 UI 交互测试，除非明确要求；服务端测试是当前默认验证方式。

## 与用户协作的契约

这一节来自 `PaperShredder` / `cancelSubmission` 的返工经验，属于硬规则，不是建议。

- 视觉、交互、第三方组件任务，先把验收条件写成具体数值或可观察结果，再改代码。
- “等宽”“最大宽度”“居中偏下”“慢”“移除掉最开始的那些”等说法必须先落到具体对象和数值；不能靠猜。
- 指令互相冲突时立即停下，给出 2 个明确选项，不沉默地选择其中一个继续做。
- 第三方组件只有一种所有权：原样接入、明确允许改组件、或外层包装。不能同时要求“逐字使用”又要求重做它的核心行为。
- 先读组件当前真实 API，再改调用方。用户更新组件后，第一步是 `typecheck` 和 API 对齐，不能继续按旧 props 写页面。
- 一次只改一个视觉变量。尺寸、位置、时间、音效、缩放方式分批验收。
- 同一视觉区域连续两轮没有达到预期时，停止继续改实现，先重写验收契约。
- 优先复用组件已有能力。不要先造悬浮层、自定义音效、模拟键盘事件等平行实现，除非契约明确要求。
- 提交流必须可构建。组件依赖和调用方要么放进同一提交，要么紧邻提交并明确说明。
- 只 stage 用户指定范围；不把 pnpm 修复、无关页面、未完成重构混进“单个组件”提交。
- 工具链错误先诊断并固定版本，不要在错误的 pnpm / 包管理器状态上继续改业务代码。

面向用户的协作规范见 [HOW_USE_AGENTS.md](HOW_USE_AGENTS.md)。

## 工作流程

1. 先读文档，再读相关代码。
2. 修改范围优先限制在 `src/`、`test/`、`docs/` 或根配置。
3. 修改 API 路由、action、缓存策略或登录流程时，同步更新 `docs/api.md`、`docs/auth.md`、`docs/configure.md`。
4. 改完后运行验证命令。
5. 需要提交时只 stage 相关路径，不使用全仓库 `git add -A`。

## 验证命令

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

需要启动服务时：

```bash
pnpm storage:init
pnpm dev
```

生产形态可以 `pnpm start` 或 `node dist/server/index.js`（已构建）。服务器静态/缓存行为由 `test/integration/static.test.ts` 覆盖。

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

- 命令、环境变量、缓存或部署变化时，更新 `README.md`、`docs/configure.md`。
- API 路由、action、错误码或登录流程变化时，更新 `docs/api.md`、`docs/auth.md`。
- 设计原则或公开页风格变化时，更新 `docs/designs.md`。
- 项目状态、范围、CI 变化时，更新 `TODOS.md`。
- 新增领域术语时，更新 `docs/glossary.md`。

## 完成标准

- 变更范围明确，没有波及 `legacy/` 或本地 storage。
- 类型检查、lint、服务端测试、构建通过。
- 没有引入未经确认的依赖。
- 相关文档已同步。
- 没有提交本地敏感配置或构建产物。
