# TODOS / 项目状态

本文记录当前状态和后续清理事项，不是详细设计文档。

## 当前状态

- 根目录是单体 SPA + dispatch API：Hono 同源提供前端、API、图片和健康检查。
- development 和 production 都只有一个 HTTP 端口；development 的 Vite 以 middleware 挂在后端进程内，不单独监听。
- 前端在 `src/web/`，后端在 `src/server/`，共享 wire 类型在 `src/shared/`。
- 前端由 Vite 构建到 `dist/client`，服务端由 tsup 构建到 `dist/server`。
- 静态缓存：HTML 弱缓存，hash assets 强缓存，API/图片强缓存。
- 服务端与前端纯逻辑测试 235 个用例通过；不包含浏览器 UI 交互测试。
- 旧 `server/`、`web/`、脚本和 CI 已从当前分支移除，归档在 [`legacy-v3`](https://github.com/TorzoClub/Gallery/tree/legacy-v3) 分支。
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
- [x] 删除当前分支的旧实现目录，归档到 `legacy-v3` 分支。
- [x] storage schema v2：头像改用 member id，加入 `pnpm update-storage`。
- [x] 所见即所得新后台 `/admin`：完整 Pool 查询、通用 Waterfall、照片编辑/删除、成员头像 popover、AdminConsole 数据/设置/重建面板、名单簿成员新增/修改/条件删除、PhotoPopover 相片描述编辑/替换/删除、空相册创建与倒序排列、相册标题折叠、空相册虚线图标、展开后的相册编辑、相片排序固化（批量写 index）、成员投票统计、重投、未投票/未投稿成员筛选、相册拖拽排序与排序模式悬浮。
- [x] PhotoBox 改名 PhotoCard：拍立得 + 纸胶带，瀑布流里按相片 id 斜贴、错落且不碰撞（公开页与后台一致）；公开页投票改为放蓝色磁粒、底部磁粒托盘；查看大图从倾角放大并转正。
- [x] `/admin` 相片投票记录：PhotoCard 图片区显示蓝色 1 票、红色 5 票的圆形磁粒，管理面板与瀑布流之间展示图例，点击查看该相片的投票人及时间；磁粒先蓝后红，useRef 缓存轻微偏移，图例支持投稿时间/获票数的前端升降序排序，不提交服务端更改。
- [x] Node.js 26.13.0 LTS 工具链：`.nvmrc`、`engines`、`@types/node` 26、tsup target 与 Docker 基础镜像同步。

## 后续待办

- [x] 图片管线 Phase 0：SDR-only 回退，thumb 无后缀，头像 thumb 使用 `.avif`，`has_hdr_optimized` 持久化默认值为 `false`。
- [x] HEIC/HEIF：原生上传、pillow_heif SDR、Apple HEIC HDR gain map；前端不再使用 heic-convert。
- [x] 图片管线 Phase 1：libavif HDR AVIF、CICP/gain map 探测、HDR 详情回退和 Docker-first 环境，见 [docs/images.md#hdr](docs/images.md#hdr)。
- [x] 低内存保护：图片转换全局串行；图片请求等待上限 360 秒；Vitest 单测/集成测试超时 180 秒。
- [ ] 浏览器 UI 交互测试（公开页投稿/投票、后台编辑、配置表单）。
- [ ] 真实部署的 CI/CD 和密钥管理：镜像构建/发布已完成；服务器部署仍手动执行，GHCR 包可见性需手动设置。
- [ ] 取消投稿脚本的 lint 警告 `react-hooks(exhaustive-deps)`：`src/web/components/Submission/scripts.tsx` 里 `selects` 的 `useMemo(..., [])` 缺少依赖 `RemovingSubmission`。这是当前 `pnpm lint` 唯一一条警告，刻意保留未修。
  - 原因：`RemovingSubmission` 定义在 `Content` 组件内部，闭包了 `photo`、`qq_num`、`navigate`、`location`、`changeScript`，每次渲染都是一个新的组件函数。`useMemo` 的空依赖正是为了让“是，取消掉吧”选项里的 `script(RemovingSubmission, [])` 只生成一次、组件类型保持不变。
  - 不能照警告补依赖：补上后每次渲染都换一个新组件类型，React 会卸载再重新挂载它；它挂载时的 effect 会再次 `Signal.once(_EVENT_.canceled, ...)` 并再次 `navigate('/explore/cancelSubmission', ...)`，造成重复监听和重复跳转（碎纸机页面被反复进入）。
  - 也不宜只加忽略注释了事：现在能正常工作，依赖的是“空依赖时闭包捕获首次渲染的值”这一隐含前提，加注释只是把问题藏起来。
  - 正确修法：把 `RemovingSubmission` 提到 `Content` 外部成为模块级组件，用 props 传入 `photo`、`qq_num`、`return_to`、`changeScript`，组件内部自己调用 `useNavigate()`；`useMemo` 的依赖随之写全。
  - 暂缓原因：这会改动取消投稿流程（`cancelSubmission` / `PaperShredder` 链路），该链路曾经返工，按 AGENTS.md 的协作契约需单独立项、明确验收条件后再改。
  - 验收：`pnpm lint` 0 警告；浏览器走一遍“取消投稿 → 是，取消掉吧”，碎纸机页只进入一次，返回后显示“投稿已撤回”且只出现一次，后续两个选项可点。

状态变化时同步更新本文、[README.md](README.md)、[AGENTS.md](AGENTS.md) 和相关 docs。
