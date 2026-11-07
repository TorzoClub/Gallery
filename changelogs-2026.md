# Torzo Gallery 4.3.0

- 发布日期：2026-11-07
- 版本：`4.3.0`
- Git tag：`v4.3.0`
- 对比基准：`v4.2.0` (`c91f2d1`)
- 对比链接：https://github.com/TorzoClub/Gallery/compare/v4.2.0...v4.3.0

## 概览

4.3.0 是图片管线的一次大版本更新：加入 HDR AVIF、原生 HEIC/HEIF 和 Apple HDR gain map 支持，并针对 256MB 级虚拟主机把图片转换改成全局串行，避免多张大图同时解码和编码。查看大图也补上了鼠标滚轮缩放和鼠标拖拽平移。

本版本没有 storage schema 迁移，也没有新增必需环境变量。已有相片需要在后台执行一次“重新生成图片”，才会生成 HDR optimized 并更新 `has_hdr_optimized`。

## HDR

- 新增 10-bit HDR AVIF optimized：`optimized/photo-...-hdr.avif`。
- SDR optimized/thumb 始终生成；HDR 是额外产物，失败不阻止 SDR 保存。
- HDR 来源：
  - AVIF 主图 PQ/HLG CICP
  - PNG `cICP`
  - JPEG gain map
  - AVIF gain map
  - HEIC/HEIF Apple HDR gain map
- HDR 输出使用正确 CICP，并校验 avifenc 输出仍是 PQ/HLG。
- 详情只在 `(dynamic-range: high)` 匹配时加载 HDR，加载/解码失败自动回退 SDR。
- 不生成 HDR thumb；头像不生成 HDR。
- `has_hdr_optimized` 是上一次 prepare / 后台重建时记录的持久化标志，不是每次请求实时读盘。
- 已人工验证 iPhone、SDR 显示器、MacBook XDR 显示器和 HDR Viewer 回退 SDR 的行为。

## HEIC / HEIF

- HEIC/HEIF 作为原生 source 上传，前端不再使用 `heic-convert`。
- SDR 由 Docker 内 `pillow_heif` 解码后交给 sharp。
- Apple HDR HEIC 由 `apple-hdr-heic-decoder` 解出 16-bit BT.2020 PQ PNG，再走 avifenc HDR 管线。
- `pillow_heif` 升级到 `1.8.1`，修复 iPhone 常见的 8-bit YCbCr auxiliary gain map；旧版只支持 8-bit monochrome aux。
- 普通 HEIC/HEIF 只生成 SDR；非 Apple HDR HEIC 不保证支持。
- storage lock 增加 hostname 和进程启动时间判断，容器重建或 PID 复用时自动清理 stale lock。

## 图片处理与低内存

- 所有真正的图片转换共享实例级 `vait` `Sequence` 队列：同一时刻只处理一张照片/头像。
- 排队范围包括投稿、后台替换照片、后台图片重建和头像生成；`/upload-image` 的临时文件接收不排队。
- 前端公开 dispatch 和后台图片相关请求超时改为 360 秒；nginx 需要同步放宽 `proxy_read_timeout` / `proxy_send_timeout`。
- Vitest `testTimeout` / `hookTimeout` 改为 180 秒，避免低配 CI 上 HEIC HDR 测试被 30 秒误杀。
- Docker 加入 libavif 1.4.2 / libaom 3.14.1、pillow_heif、exiftool 和 apple-hdr-heic。
- 新增 `compose.dev.yaml` 开发编排。

## 查看大图

- 新增鼠标滚轮缩放：以鼠标位置为锚点，范围仍是 1–5 倍。
- 鼠标放大后支持按住拖拽平移；1x 下保留原有拖动关闭行为。
- trackpad 捏合、ctrl-wheel、Safari gesture 和 trackpad 双指滚动继续保留。
- 滚轮和 trackpad 用 `deltaMode`、`deltaX`、`wheelDeltaY % 120` 区分；没有 legacy 值时用纯纵向大 delta 兜底。
- 新增鼠标滚轮、慢速鼠标滚轮、trackpad 平移、line-mode 和拖拽平移测试。

## 文档与工程

- HDR 实现文档合并进 `docs/images.md`，删除 `docs/todo/hdr-supports.md`。
- 同步修正 `has_hdr_optimized` 的持久化语义和所有 HDR 文档引用。
- HDR/HEIC 的 Docker 环境、失败回退和已知限制集中记录在 `docs/images.md`。
- `about-image.jpg` 从 `src/web/` 移到 `public/`。
- 后台图片重建提示文案精简。
- 测试扩展到 33 个测试文件、235 个用例。

## 接口、配置与升级

- `Photo.format` 增加 `heic`；HEIC/HEIF source 保留原始字节，下载 MIME 为 `image/heic`。
- 无 storage schema 变更，不需要迁移。
- 无新增必需环境变量。
- 生产环境需要 Docker 镜像内 HDR/HEIC 工具；缺少时启动 fail-fast。
- 已有相片需要在后台执行“重新生成图片”才会生成 HDR optimized。
- 图片请求部署时必须允许至少 360 秒；否则反向代理会先于应用超时。
- 版本号更新：
  - `package.json` → `4.3.0`
  - `index.html` 静态资源 query → `v=4.3.0`
  - `resources/report-card.html` 与 ReportCard 默认 Version 行 → `v4.3.0`
- Git tag：`v4.3.0`

## 验证

本版本发布前验证通过：

```text
pnpm typecheck  通过
pnpm lint       0 errors，2 warnings
pnpm test       33 个测试文件，235 个用例通过
pnpm build      通过
```

说明：

- lint 警告为既有组件告警，不阻塞发布。
- 当前仍没有浏览器 UI 自动化测试。
- HDR 实机显示和详情回退已人工验证。
- Docker 内完整测试为 235 个用例通过。

## 已知限制

- HEIC HDR 只支持 Apple 风格的 gain map；没有该辅助图的 HEIC 只生成 SDR。
- HDR 能否实际显示取决于浏览器/显示器对 `(dynamic-range: high)` 的支持；不支持时使用 SDR。
- 图片转换会按 FIFO 排队，排队时间计入 360 秒请求等待；客户端超时不会取消服务端已开始的任务。
- 鼠标滚轮与 trackpad 的分类是启发式，快速甩动 trackpad 仍可能产生误判。
- 单张 HDR/HEIC 子命令仍保留 180 秒超时。
- 单实例 storage 仍只允许一个 Node 进程写入。

# Torzo Gallery 4.2.0

- 发布日期：2026-11-07
- 版本：`4.2.0`
- Git tag：`v4.2.0`
- 对比基准：`v4.1.1` (`c1e2dee`)
- 对比链接：https://github.com/TorzoClub/Gallery/compare/v4.1.1...v4.2.0

## 概览

4.2.0 是公开页与后台的一次大版本更新：公开页完成拍立得相片卡、磁粒投票、撕胶带保存和成员频道，后台重做门禁、名单簿与控制台，并加入公开页/后台 SSE 实时同步。图片派生规则、PWA 资源和前端 HTTP 依赖也在本版本调整。

没有 storage schema 变更，不需要执行 storage 迁移；没有新增必需环境变量。新增的 SSE 对反向代理有 buffering 配置要求，见“接口、配置与升级”。

## 公开页

- `PhotoBox` 更名为 `PhotoCard`：斜贴拍立得、纸胶带、按相片 id 生成的轻微错落和倾角。
- 瀑布流相片按数据变化贴上和撕下；新投稿从最矮一列顶部落下、压平并补上纸胶带。
- 公开页投票改为磁粒：
  - 点相片右下角的磁粒位，托盘里的磁粒沿抛物线飞上去
  - 收回时由 🤏 捏回托盘
  - 落纸时播放 `ta～` 音效
  - 托盘显示剩余磁粒，支持投票上限和不限票数
- 撕纸胶带保存原图：
  - 撕开胶带后弹出系统“存储为”对话框
  - 点“存储”播放扫描、揭起复印件、复印件掉落的动画，原件保留
  - 点“取消”播放纸胶带贴回动画
  - 有磁粒时磁粒使用顶层 echo 保持在复印件之上
  - Safari / Firefox 等拿不到系统保存结果时，完整动画结束后才下载
- 提交投票后提交区域保留，持续显示“感谢你的投票”。
- 查看大图重做：缩放/拖动/关闭手势、图片加载状态、加载失败提示与重试。
- 横长图在卡片中竖贴；竖长卡片按比例收敛倾角，减少极端倾斜。
- 新增只读成员笔记本 `/member/<id>`，从相片头像或昵称进入，返回 Explore。
- 频道切换改为只隐藏不卸载，返回时保留页面状态和滚动位置；修复重复进入碎纸机等换台问题。

## 成员、Behind 与 Staff

- Behind 页：
  - 品牌图改为 logo 与相片堆叠
  - 新增 800 / 1600 双断点布局
  - 嵌入只读名单簿
  - System Reports 继续延迟挂载，离开时正确卸载
- 新增 Staff 频道 `/staff`：
  - 人类组与 AI 组分开排列
  - 追加项目参与者留言
  - 支持小标题、加粗和 ReactNode 落款
  - 1601px 以上加宽留言纸
- 后台入口从 Behind 页登录表单移到 Navigator 上的“A”按钮；原登录抽屉归档为 deprecated。

## 后台

- `/admin` 登录改为门禁面板：
  - 密码输入、错误提示和解锁按钮重做
  - 门禁蜂鸣与 token 预校验
  - 本地 token 先经过 `/auth/check` 核对
  - 登录密码框改为明文显示
- 名单簿重做：
  - 线圈本分页、成员页与投稿续页三级翻页
  - 手写体、横线表单、页眉搜索、续页铺满
  - 新增成员跳页与 new 角标
  - 翻页、撕页音效
  - 成员头像与字段在宽屏并排
- 相片排序固化：
  - 新增 `adminSortPhotos`，一次提交完整 `photo_ids` 顺序并批量写 `index`
  - 移除旧的按票数排序 action `adminSortPhotosByVoteCount`
  - 新增通用 `SortSelect`，名单簿和投票图例共用
- 相片与投票：
  - Admin 相片卡显示蓝色 1 票、红色 5 票的磁粒
  - 新增投票记录查看：投票人与投票时间
  - 支持按投稿时间/获票数在前端排序
  - 完善成员投票统计与重投
- 合并相册投稿与投票统计，完善相册新增照片、照片替换、描述编辑、删除和图片重建。
- 后台控制台：
  - 操作按钮改为 `WhitePlasticButton`
  - 移动端面板切换改为录音机式琴键
  - 加入机械按键音效与按压反馈
  - 调整控制台间距、选中态和名单簿分隔线

## 实时更新与连接

- 新增公开页 `/events/pool` SSE：
  - 推送 `gallery-photos` 与 `members` 分类快照
  - 只包含公开字段，QQ 固定为 `null`
  - 每 15 秒发送 `ping`
- 新增 Admin `/admin/events/pool` SSE：
  - 需要 Bearer token
  - 推送完整 AdminPool，包含真实 QQ 与 `instance_config`
  - 前端用 fetch 读取流，不把 token 放进 URL
- 客户端按 item `id` 和 `updated_at` 合并，未变化对象保持原引用；完整快照中缺失的 photo/member 视为删除。
- 服务端新增 Pool JSON raw 缓存，所有 SSE 连接共享同一份序列化结果。
- 标签页隐藏时主动断开 SSE，回到前台重连；后台标签让出连接。
- 使用 Web Locks 限制同 origin 最多 5 个页面，超出时进入“页面过多”线圈本说明。
- 投稿提交期间暂缓公开页 SSE 应用，成功切到“大感谢”后再延迟合并。
- 相片出入场改由数据变化驱动：公开页与后台共用同一套 Presence 动画。

## 图片与上传

- 相片缩略图和 optimized 的短边不低于 256px。
- AVIF 每边上限 16384px；上传和重建按当前配置预计算，超限返回 400，不再生成坏图。
- 横长图在拍立得中顺时针竖贴；竖长卡片倾角按高宽比收敛。
- 新增 `docs/images.md`，记录后端派生尺寸、前端拍立得尺寸估算、横长图竖贴与竖长摆正。

## 工程与依赖

- 移除 axios，公开 dispatch 与后台 client 统一改用原生 fetch 封装的 `http` 模块：
  - 统一超时
  - 统一网络/超时错误映射为 `ApiError`
  - 保留 HTTP 非 2xx 的 envelope 解析
- 测试扩展到 31 个测试文件、210 个用例，新增 SSE、ClientPool 合并、图片尺寸、大图手势、PhotoCard 布局、HTTP 等覆盖。
- PWA `short_name` 改为 `TORZO GΛLLERY`，manifest 主题色更新。

## 接口、配置与升级

- 新增 `GET /auth/check`，用于后台门禁校验本地 token。
- 新增 `GET /events/pool` 与 `GET /admin/events/pool`。
- Admin action `adminSortPhotosByVoteCount` 替换为 `adminSortPhotos`；外部脚本如果依赖旧 action，需要改为传完整 `photo_ids` 顺序。
- SSE 部署要求：反向代理必须关闭响应 buffering，例如 nginx 使用 `proxy_buffering off`，并将 `proxy_read_timeout` 设为大于 15 秒。
- storage schema 仍为 v2，不需要迁移；没有新增必需环境变量。
- 版本号更新：
  - `package.json` → `4.2.0`
  - `index.html` 静态资源 query → `v=4.2.0`
  - `resources/report-card.html` 与 ReportCard 默认 Version 行 → `v4.2.0`
- Git tag：`v4.2.0`

## 验证

本版本发布前验证通过：

```text
pnpm typecheck  通过
pnpm lint       0 errors，2 warnings
pnpm test       31 个测试文件，210 个用例通过
pnpm build      通过
```

说明：

- lint 警告为既有组件告警，不阻塞发布。
- 当前仍没有浏览器 UI 自动化测试；changelog 不宣称未执行的浏览器手测。
- 服务端测试覆盖 dispatch、SSE、鉴权、storage、图片处理、投稿/投票、相册约束、静态服务和缓存。

## 已知限制

- storage 仍是单实例 JSON + 图片池，同一 storage 同时只允许一个进程写。
- 图片管线仍为 SDR-only。
- 后台和公开页共享单进程，后台代码异步加载但由同一服务提供。
- 后台请求超时 30 秒；图片重建等长任务仍可能超过客户端超时，而服务端继续执行。

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
