# Torzo Gallery 4.1.1

- 发布日期：2026-11-01
- 版本：`4.1.1`
- Git tag：`v4.1.1`
- 对比基准：`v4.1.0` (`9ed219b`)
- 对比链接：https://github.com/TorzoClub/Gallery/compare/v4.1.0...v4.1.1

## 概览

4.1.1 是 4.1.0 的补丁版本，集中修复后台登录与机械按键的可用性和视觉细节。没有 storage schema、环境变量、API 或部署流程变更。

## 后台登录

- 管理员密码输入框改为明文显示，便于确认输入内容。
- 输入框内容改为水平居中，并统一左右内边距。
- 登录错误 Popover 从输入框右侧移到输入框上方，水平居中，箭头继续指向密码输入框。
- 保留非模态 Popover、`aria-describedby` 和错误焦点行为。

## 机械按键与按钮

- 加大后台录音机琴键的按下与弹起音效：
  - 按下音效整体约提升 1.7–2 倍
  - 弹起音效同步提高
  - 仍保持按下声更重、回弹声更轻的层次
- 调整 `WhitePlasticButton` 的文字颜色，使用更深的蓝灰色，提升银白塑料材质上的可读性。

## 升级说明

- 这是可直接替换的补丁版本。
- 不需要更新环境变量。
- 不需要执行 storage 迁移。
- 无破坏性 API 变更。

## 验证

本版本发布前验证通过：

```text
pnpm typecheck  通过
pnpm lint       0 errors，5 warnings
pnpm test       19 个测试文件，108 个用例通过
pnpm build      通过
```

说明：

- lint 警告为既有组件告警，不阻塞发布。
- 当前仍没有浏览器 UI 自动化测试；后台登录和机械按键音效通过浏览器手工验证。

# Torzo Gallery 4.1.0

- 发布日期：2026-11-01
- 版本：`4.1.0`
- Git tag：`v4.1.0`
- 对比基准：`v4.0.0` (`c2b1572`)
- 对比链接：https://github.com/TorzoClub/Gallery/compare/v4.0.0...v4.1.0

## 概览

4.1.0 聚焦公开页取消投稿流程、后台入口与后台控制台的交互质感，同时把 CRT 换台抽成可复用组件。

本次没有 storage schema、环境变量或图片处理流程变更，不需要执行 storage 迁移。

## 取消投稿与 Explore

- `/cancelSubmission` 改为 `/explore/cancelSubmission` 覆盖层，底层 Explore 不再卸载：
  - 点击取消投稿后保留 Explore 的列表、筛选、滚动和组件状态
  - 覆盖层固定为 `top: 0; left: 0; width: 100vw; height: 100vh`
  - 取消投稿完成后返回 `/explore` 仍是同一个 Explore 实例
- 旧 `/cancelSubmission`、`/removingSubmission` 继续兼容，会重定向到新地址并保留 route state。
- 进入和退出取消投稿都复用 CRT 转场：
  - 进入显示 `CH. cancelSubmission`
  - 返回显示 `CH. Explore`
  - 覆盖层在换台完成后再挂载/卸载
- 新增可复用的 `ChannelTransition`，统一封装：
  - `ChannelSwitch` 噪点和扫描线
  - 换台音效
  - 频道 OSD
  - 换台余辉
  - 舞台抖动和过滤器
  - 换台后的内容切换和清理
- 普通频道 `/explore`、`/behind`、`/admin` 的换台也改用该组件。

## 后台入口

- 重做 Behind 页的 Admin Login：
  - `Admin Login` 标题居中，带左右分割线
  - 管理员密码输入、提交和错误状态重新整理
- 后台入口按钮改为 SVG 金属拉杆：
  - 拉杆两端固定座、金属渐变与阴影
  - 拉杆位于登录面板下方
  - 点击拉杆切换登录面板
- 拉杆增加手部抓握动效：
  - `✋` 从右下方移动到拉杆
  - 到达后等待 300ms
  - 变成 `✊` 后才展开登录面板
  - 手位于拉杆后方，完成后淡出
- 登录错误不再使用行内错误块，改为指向密码输入框的 Popover：
  - 输入框作为 Popover trigger
  - 错误文本使用 `role="alert"`
  - 输入框通过 `aria-describedby` 关联错误
  - 支持 Escape、点击外部和点击输入框关闭
- Popover 新增可选的非模态模式，错误提示不会抢焦点或启用焦点陷阱。

## 后台控制台

- 后台操作按钮全部由 `SkeuomorphismButton` 替换为 `WhitePlasticButton`：
  - 创建相册
  - 完成排序
  - 调整相册顺序
- 移除后台里的 `SkeuomorphismButtonHighlight` 包裹和高亮依赖。
- 新增 `WhitePlasticButton`：
  - 银白塑料材质、边缘高光、倒角和按压凹陷
  - 使用 Pointer 事件管理完整按压周期
  - 支持鼠标、触摸、键盘和外部强制按压
  - 每次点击随机生成很小的倾角，模拟松垮的塑料按键
- 移动端后台面板切换键改为录音机式金属琴键：
  - 黑色内凹键槽
  - 拉丝银灰键帽、顶部高光和金属前唇
  - 选中键保持下沉，其他键弹起
  - 按下时立即切换面板
  - 支持鼠标、触摸、键盘和方向键
  - 修复原生 `:active` 在选中态提交前释放造成的闪烁
- 新增机械按键音效：
  - 按下的低频键体声、金属 click 和噪声
  - 旧键弹起时的高频回弹声
  - 使用 Web Audio 合成，无音频文件
  - AudioContext 不可用时静默降级
- 后台成员投票参与比例卡片重做。
- 重投操作增加二次确认。
- 完善控制台选中态、输入框细节、创建区间距和名单簿分隔线。

## 公开页与组件

- 重构 `Navigator`。
- 新增 `ZeldaQuestBanner` 活动横幅特效组件，并在 Behind 页提供活动 banner 演示入口。
- 修复 iOS Safari 下 ConfirmQQ 输入完成后不回弹的问题。
- 导出 `Title` 的 `Slit` 组件，供后台登录展开使用。
- 完善 `Popover` 的非模态行为。
- 新增 `ChannelTransition`、`WhitePlasticButton` 和机械按键音频工具。

## 接口、配置与维护

- 删除未使用的旧 Admin 读取查询：
  - `adminGetInstanceConfig`
  - `adminStatistic`
  - `adminListGalleries`
  - `adminGetGallery`
  - `adminListMembers`
  - `adminGetMember`
  - `adminListPhotos`
  - `adminGetPhoto`
  - `adminListAvailablePhotos`
  - `adminListMemberVotes`
  - `adminListPhotoVotes`
- 后台改用 `adminFetchPool` 获取完整快照。
- instance 配置默认值改为直接从 `InstanceConfigFileSchema` 推导，避免默认值与 schema 漂移。
- 补充 `.env.example` 的环境变量说明。
- 补充 `PUBLIC_BASE_URL` 与本地图片 URL 的排查文档。
- 移除 Dependabot 配置。

## 破坏性变更与升级

- 取消投稿规范地址改为 `/explore/cancelSubmission`；旧地址仍会重定向并保留 state。
- 旧 Admin 读取查询已从 dispatch API 移除。公开 API 不受影响；如果存在依赖这些内部 admin query 的外部脚本，需要改用 `adminFetchPool`。
- storage schema 仍为 v2，不需要迁移。
- 环境变量要求没有变化。
- 版本号更新：
  - `package.json` → `4.1.0`
  - `index.html` 静态资源 query → `v=4.1.0`
  - ReportCard 示例和组件默认版本 → `v4.1.0`
- Git tag：`v4.1.0`

## 验证

本版本发布前验证通过：

```text
pnpm typecheck  通过
pnpm lint       0 errors，5 warnings
pnpm test       19 个测试文件，108 个用例通过
pnpm build      通过
```

说明：

- lint 警告为既有组件告警，不阻塞发布。
- 当前仍没有浏览器 UI 自动化测试；公开页、后台入口、取消投稿覆盖层和后台琴键通过浏览器手工验证。
- 服务端测试覆盖 dispatch、鉴权、storage、图片处理、投稿/投票、相册约束、静态服务和缓存。

## 已知限制

- storage 仍是单实例 JSON + 图片池，同一 storage 同时只允许一个进程写。
- 图片管线仍为 SDR-only。
- 后台和公开页共享单进程，后台代码异步加载但由同一服务提供。

# Torzo Gallery 4.0.0

- 发布日期：2026-11-01
- 版本：`4.0.0`
- Git tag：`v4.0.0`
- 对比基准：`a6a543c7e15b839e2ca7db7a8858eaafc5f7b294`
- 对比链接：https://github.com/TorzoClub/Gallery/compare/a6a543c7e15b839e2ca7db7a8858eaafc5f7b294...v4.0.0

## 概览

4.0.0 是一次完整重写。项目从旧的多目录前端/后台实现，合并为根目录下的单体 SPA + dispatch API：

- 一个 Node.js HTTP 服务、一个端口
- Hono 同时负责 API、图片、健康检查和前端静态文件
- development 使用同进程 Vite middleware，不再启动独立的 Vite 端口
- 前端统一到 `src/web/`
- 后端统一到 `src/server/`
- 共享 DTO 和配置类型统一到 `src/shared/`
- 服务端测试统一到 `test/`

旧 `front/`、`dashboard/`、`server/`、`web/` 和脚本/CI 已从当前分支移除，归档在 `legacy-v3` 分支。

## 架构与后端

### 单体同源服务

- 新增根目录 Node HTTP Server。
- Hono 始终位于后端最前面：
  - API 请求进入 Hono API 路由
  - development 的非 API 请求进入同进程 Vite middleware
  - production 的非 API 请求进入 Hono 静态文件和 SPA fallback
- 移除前端开发服务器与 API 之间的独立端口和 proxy 配置。
- 新增统一的环境、instance 配置和启动校验。
- 新增 `HTTP_HOSTNAME`，并保留旧 `HTTP_HOST` 别名。
- 新增健康检查 `/healthz`。
- 新增同源 CORS、JWT 和 admin 权限边界。

### dispatch API

- 新增统一的 query/mutation dispatch：
  - `/query/:name`
  - `/mutate/:name`
  - `/admin/query/:name`
  - `/admin/mutate/:name`
- admin action 只能从 admin 路由调用；公开路由调用 admin action 返回 403。
- 新增两阶段 mutation 生命周期：
  - `prepare` 中执行图片等异步工作
  - `commit` 中只执行同步 Pool 变更
  - persistence 按 commit 顺序串行落盘
- 将图片准备移出 mutation 串行区，避免慢图片处理阻塞其他写操作。
- 新增 `adminFetchPool` 和 `fetchClientPool` 两个完整快照入口。
- 新增成员相关公开查询：
  - `fetchMemberView`
  - `getMemberPhotos`
  - `getSubmission`
  - `confirmMember`

### 登录与权限

- 新增 `POST /auth/login`。
- 新增 JWT HS256 token、过期时间配置和 401/403 边界。
- Behind 页管理密码只来自 `ADMIN_PASSWORD`。
- 后台 request 使用 Bearer token。
- production 强制校验 `ADMIN_PASSWORD`、`JWT_SECRET` 和 `PUBLIC_BASE_URL`。
- `JWT_SECRET` 在 production 至少 32 字符。

### 领域模型

- 新增 Immutable.js 驱动的 Pool 领域层。
- 新增相册活动时间窗口互斥约束。
- 新增相册删除保护：包含相片时不能删除。
- 新增成员删除保护：被相片或投票引用时不能删除。
- 新增相册、相片、成员、投票的完整服务端校验。
- 新增相册投票上限、投稿期限、成员唯一投稿等规则。
- 投票和投稿流程统一到新的 dispatch action。

### storage v2

- storage 升级到 schema v2。
- 新增 `pnpm update-storage`，v1 storage 不能直接启动。
- 头像文件名改用 member id，不再包含 QQ。
- source 保留原始字节。
- optimized/thumb 使用实体 ID + 内容 CRC32 文件名。
- 上传临时文件使用 UUIDv7。
- 新增 storage lock，保证同一 storage 同时只允许一个进程写。
- 新增 v1 到 v2 的头像迁移和旧文件清理。
- 新增 legacy migration CLI，用于从旧 API 导入成员、相册、相片和投票。

## 图片处理

- 新增 sharp 图片处理管线：
  - source 原图
  - optimized 全尺寸 SDR AVIF
  - thumb SDR AVIF
  - avatar 使用成员 ID 命名
- 修复 EXIF Orientation 旋转，新增单元/集成覆盖。
- 新增图片内容 CRC32 版本命名，减少缓存失效问题。
- 新增头像和缩略图重建接口。
- 新增上传大小、缩略图尺寸、AVIF 质量和 effort 的运行期配置。
- 新增“重新生成图片”后台能力。
- 将图片处理配置与已有文件解耦：修改配置只影响后续处理和显式重建。
- 暂不启用 HDR；当前版本保持 SDR-only，HDR 方案保留为后续工作。
- 新增 HEIC 转换的延迟加载，减少无关页面的初始成本。

## 公开页

### 路由与页面

- 新增 `/explore` 公开相册页，`/` 重定向到 `/explore`。
- 新增 `/behind` About 页面。
- 新增 `/cancelSubmission`，别名 `/removingSubmission`。
- 新增 CRT 风格频道切换和 Behind 换台效果。
- 修复频道切换时非当前页面仍然挂载造成的全局 scroll lock。
- 公开页和后台共享入口，但后台代码按路由异步加载。
- 新增 PWA manifest、站点图标和公开页背景资源。

### 数据与隐私

- 公开页改用 masked `ClientPool`。
- 公开 DTO 不再返回成员真实 QQ，`qq_num === null`。
- 活动期 GalleryInEvent 不返回投票记录和相片 member_id。
- 通过 `fetchMemberView` 只返回当前成员自己的投票/投稿状态。
- 后台仍可通过 AdminPool 查看真实 QQ。
- 新增 ClientPool `version_time` 用于避免旧异步响应覆盖新数据。
- 新增公开端投稿、投票、取消投稿的完整流程。

### 视觉与交互

- 新增 Navigator 和轻拟物导航按钮。
- 新增 ReportCard、Logo、标题样式和年份正弦动画。
- 新增 Spinner、LoadingMask 和首屏加载状态。
- 新增 PaperShredder 取消投稿频道：
  - 支持任意高度相片
  - 支持自动碎纸
  - 完成后保留结果状态
  - 修复 Safari 中相片贴图空白
- 新增公开页纸质刊物、早期日式个人网站和早期 OS X 风格设计规范。
- 新增背景、About 图片和构建说明的布局调整。

## 新后台 `/admin`

### 基础架构

- 新增所见即所得后台，完整读取 AdminPool。
- 后台与公开页共用前端入口，但按路由异步加载。
- 新增 CRT 换台和 admin 专属布局。
- 新增 AdminConsole：
  - 数据统计
  - instance 配置
  - 图片重建
  - 名单簿成员新增、编辑、条件删除
- 后台不引入第三方 UI 框架；Popover、Toast、表格和表单均为项目内实现。
- 移除旧 `/admin-legacy` 和旧后台页面/布局/登录实现。

### 相册管理

- 新增相册创建。
- 新增空相册透明虚线层叠图标。
- 新增相册展开管理和相册标题折叠。
- 新增相册编辑：
  - 名称
  - 活动开始时间
  - 投稿截止时间
  - 活动结束时间
  - 投票限制票数
- 新增相册删除：
  - 空相册才能删除
  - 删除前二次确认
- 新增“按票数排序”，并增加二次确认。
- 新增相册顺序调整：
  - 进入排序模式
  - 自动收起所有 Gallery
  - 整个 GalleryHeader 可拖拽
  - 拖拽时实时重排
  - 拖拽 Header 跟随指针位移
  - 无落点指示线
  - 松手后保存新的连续 index
- 新增排序模式视觉：
  - chevron 与拖拽手柄的 scale 切换动画
  - 三条实心横条 + 三角的拖拽手柄
  - 白色圆角手柄外框
  - 粗粒度悬浮：
    - 相册名
    - 拖拽手柄
    - 图标内三张相片
  - 悬浮由 requestAnimationFrame 驱动
  - 进入从原位开始，退出归位
  - 平移 2–5px，旋转限制在 ±8deg
  - 空相册虚线图标的前景遮挡 mask 随悬浮和旋转同步
- 新增“完成排序”按钮高亮效果，并抽为可复用的 `SkeuomorphismButtonHighlight`。
- 新增相册管理大屏固定布局：
  - 编辑相册 540px
  - 成员投票 360px
  - 1040px 起双栏
  - 移动端卡片铺满宽度、取消圆角
- 创建按钮和相册卡片对齐 GalleryHeader 的相册名。

### 相片与成员

- 新增 PhotoPopover：
  - 编辑相片描述
  - 替换相片
  - 删除相片
- 新增 MemberPopover：
  - 编辑成员
  - 删除成员
- 操作后静默刷新 AdminPool，不再关闭已展开的 Gallery。
- 新增成员投票统计：总人数、已投、未投。
- 新增“投票/投稿状况”入口和重投表格：
  - 只显示已投票成员
  - 显示成员昵称和 QQ
  - 显示投过的相片缩略图
  - 每行可设置重投
- 新增未投成员列表：
  - 谁没投票
  - 谁没投稿
  - 所有人
  - 曾经参加过投票
  - 曾经投稿过作品
- 成员历史数据从本地 AdminPool 计算，不额外请求接口。

## 构建、缓存与性能

- 前端切换到 Vite 8 和根目录构建。
- 服务端使用 tsup 构建。
- 新增 hash assets 强缓存、HTML no-cache、图片强缓存。
- 新增 gzip/Brotli 预压缩和传输。
- 新增 rollup plugin visualizer 分析入口。
- 新增后台/公开页异步拆包。
- 新增 Node.js 24、pnpm 10 和 TypeScript 7 工具链。
- 新增统一 oxlint、Vitest 和 CI 验证流程。
- 新增 PWA manifest 和公开静态资源。

## 破坏性变更

1. **部署形态改变**
   - 不再需要独立的前端 dev server 或反向代理到两个端口。
   - production 由单个 Node 进程提供 SPA、API 和图片。
   - `API_BASE_PATH` 和 `VITE_BASE_PATH` 需按根路径 `/` 配置。

2. **旧后台移除**
   - `/admin-legacy/*` 已移除。
   - 旧后台登录、布局、页面和组件已删除。
   - 后台统一使用 `/admin`，登录入口为 `/behind`。

3. **storage v1 不再可直接启动**
   - 升级前必须备份 storage。
   - 先运行 `pnpm update-storage`。
   - 头像文件名由 QQ 改为 member id。

4. **公开成员隐私变化**
   - 公开 API 不再返回真实 QQ。
   - 依赖公开 QQ 字段的第三方调用需要改用成员自己的操作凭证/查询。

5. **旧目录和旧入口移除**
   - `front/`、`dashboard/`、旧 `server/` 和旧 `web/` 不再存在于当前分支。
   - 需要历史实现时查看 `legacy-v3` 分支。

6. **环境要求提高**
   - Node.js >= 24.22.1
   - pnpm >= 10.24.0
   - 生产环境必须提供 `ADMIN_PASSWORD`、`JWT_SECRET` 和 `PUBLIC_BASE_URL`。

## 升级指南

1. 备份 storage 和现有图片目录。
2. 安装 Node.js 24.22.1+ 和 pnpm 10.24.0+。
3. 更新 `.env.development` / `.env.production`：
   - `STORAGE_PATH`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
   - `PUBLIC_BASE_URL`
   - `HTTP_HOSTNAME` / `HTTP_PORT`
4. 执行 `pnpm install`。
5. 如果 storage 是 v1，执行：

   ```bash
   pnpm update-storage
   ```

6. 执行验证：

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm build
   ```

7. 使用单一端口重新部署，并更新反向代理：
   - SPA
   - `/query/*`、`/mutate/*`
   - `/admin/query/*`、`/admin/mutate/*`
   - `/auth/login`
   - `/images/*`
   - `/healthz`
8. 清理旧缓存和旧书签，统一使用 `/admin`。

## 验证

本版本发布前验证通过：

```text
pnpm typecheck  通过
pnpm lint       0 errors，5 warnings
pnpm test       19 个测试文件，108 个用例通过
pnpm build      通过
```

说明：

- lint 警告为既有组件告警，不阻塞发布。
- 当前没有浏览器 UI 交互测试；UI 相关功能通过浏览器手工验证。
- 服务端测试覆盖 dispatch、鉴权、storage、图片处理、投稿/投票、相册约束、静态服务和缓存。

## 已知限制

- storage 仍为单实例 JSON + 图片池，同一 storage 同时只允许一个进程写。
- 当前图片管线为 SDR-only；HDR 方案仍在后续计划。
- 没有浏览器自动化 UI 测试。
- 公开页和后台共享单进程，后台代码虽然异步加载，但仍由同一服务提供。

## 统计

- 对比快照日期：2025-12-27
- 版本发布日期：2026-11-01
- 快照到正式版之间包含 80+ 个提交
- 450+ 个文件变更
