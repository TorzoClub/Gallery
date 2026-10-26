# Torzo Gallery 项目评估报告

> 评估时间：2026-10-26
> 评估基线：`930ccb4 [feature] 回退图片管线为 SDR-only 并修正 thumb 命名`
> 范围：当前 `src/`、`test/`、构建/部署配置、公开页与后台的图片/API 流程
> 说明：本报告基于静态阅读、现有测试和本地构建结果，不包含真实生产流量、压测或浏览器兼容性矩阵。

---

## 1. 结论摘要

项目已经具备完整的单体相册业务闭环：

- Hono 单端口提供 API、图片和 SPA；
- React 公开页 + 后台；
- Immutable 领域模型；
- JSON 文件 + 图片池持久化；
- dispatch action 权限边界；
- sharp 图片流水线；
- 70 个服务端测试。

当前最需要关注的问题不是“功能缺失”，而是**运行期可靠性和长链路性能**：

1. **所有 mutation 被 `Sequence()` 串行化**，图片处理也在其中。单张高 effort 图片会阻塞所有上传、投票、后台操作。
2. **JSON storage 的跨文件写入没有事务**，崩溃/磁盘错误可能留下部分提交。
3. **相册/相片查询存在 O(P×M + P×V) 的重复扫描**，图片和投票量增长后会明显变慢。
4. **前端图片队列缓存 object URL 不释放**，长时间浏览会累积内存。
5. **详情大图没有加载失败态**，图片 404 或解码失败时 loading 可能一直存在。
6. **后台 API 超时 30 秒**，图片重建/批量操作可能客户端已超时，但服务端仍在执行。
7. **认证缺少登录限流**，`ADMIN_PASSWORD` 也没有最低长度约束。
8. HDR 当前被有意回退为 SDR-only；`has_hdr_optimized`/`src_optimized_hdr` 已预留，但 HDR 实现仍是下一阶段。

这些问题的优先级高于继续加新功能。建议先做一轮 1 周左右的稳定性/性能修复，再进入 HDR 和更大规模功能。

---

## 2. 项目结构

### 2.1 顶层目录

```text
.
├── src/
│   ├── server/          Hono API、领域模型、storage、图片流水线、CLI
│   ├── web/             React 公开页 + 后台
│   └── shared/          前后端共享 DTO / instance config 类型
├── test/                服务端单元与集成测试
├── public/              favicon、背景、manifest 等静态资源
├── docs/                架构、API、配置、设计、排障文档
├── legacy/              冻结的旧实现，不参与构建
├── dist/                Vite / tsup 产物
├── Dockerfile           生产镜像
├── compose.yaml         生产 compose
├── REPORTS.md           本报告
└── 根配置                 package.json、tsconfig、vite/tsup/vitest、CI
```

规模快照：

- 源码文件：约 144 个（不含 `legacy/`）
- 服务端 TypeScript：约 28 个
- 前端 TS/TSX：约 78 个
- 测试：12 个测试文件、70 个用例
- `src/` 约 3.3 MB，其中包含字体和图片资源
- `docs/` 约 56 KB

### 2.2 后端

```text
src/server/
├── api/            Hono 路由、admin auth、上传、静态服务
├── instance/       Instance 生命周期、dispatch actions、serializer、图片管道
├── core/           Photo / Gallery / Member / Pool 领域模型
├── storage/        JSON 持久化、图片路径、文件锁、codec、sharp 编码
├── config/         env、instance 配置
├── common/         ID、CRC32、UUID、错误、文件名
├── cli/            storage 初始化、Legacy 迁移（一次性）
├── migration/      Legacy admin API 客户端与迁移逻辑
├── logger.ts
├── server.ts       HTTP server + production static / development Vite
└── index.ts        进程入口、启动/优雅关闭
```

请求链：

```text
HTTP
→ src/server/server.ts
→ Hono constructApi
→ POST /query|/mutate|/admin/query|/admin/mutate
→ Instance.dispatchQuery / dispatchMutation
→ actions.ts
→ Pool / Gallery / Member
→ Storage JSON / 图片文件
```

`Instance` 是运行期唯一状态源：

- `Pool`：Immutable 的 gallery/member 内存状态；
- `instance_config`：运行期配置；
- `instance_hash`：instance_config 的 CRC32，用于派生图 URL 缓存版本；
- `Sequence`：所有 mutation 的串行队列；
- `ImagePipeline`：图片临时文件、准备、刷新、GC。

### 2.3 前端

```text
src/web/
├── admin/          后台页面、表格、弹窗、上传、配置、登录
├── api/            同源 dispatch / upload 客户端
├── components/     公开页组件：Waterfall、PhotoBox、Detail、Submission 等
├── layouts/        GalleryHome 等页面骨架
├── hooks/          滚动、测量、挂载状态
├── utils/          图片队列、下载、日期、通用函数
├── assets/         字体、心形图标、站点图
├── App.tsx
└── main.tsx
```

请求链：

```text
React
→ src/web/api/*.ts
→ POST /query|/mutate 或 /admin/query|/admin/mutate
→ 服务端 dispatch
→ DTO
→ 公开页 / 后台
```

### 2.4 数据与文件

```text
<STORAGE_PATH>/
├── pool.json
├── members.json
├── galleries/<gallery_id>.json
├── instance-config.json
├── lock
└── stored-images/
    ├── source/      原始上传字节
    ├── optimized/   photo-...-sdr.avif（Phase 0）
    ├── thumb/       photo-...crc.avif / avatar-...crc.avif（Phase 0）
    └── temp/        <uuidv7>.<format>
```

当前 Phase 0 的图片规则：

- source：原始字节，保留原扩展名；
- photo thumb：`thumb/photo-<gallery>-<photo>-<crc>.avif`；
- photo optimized：`optimized/photo-...-<crc>-sdr.avif`；
- avatar source：`source/avatar-<qq>-<crc>.<format>`；
- avatar thumb：`thumb/avatar-<qq>-<crc>.avif`；
- 不生成 HDR 派生图；
- `PhotoDTO.has_hdr_optimized=false`、`src_optimized_hdr=null`；
- 派生图 URL 带 `?v=<instance_hash>`。

### 2.5 构建与运行

- development：Node HTTP server + 同进程 Vite middleware，单端口；
- production：Hono 提供 `dist/client` + SPA fallback；
- 前端 Vite hash assets；
- 服务端 tsup ESM；
- Docker 生产镜像只做 build/runtime 两阶段；
- CI 在 Ubuntu runner 上执行 typecheck/lint/test/build；
- 没有 Docker 化的本地开发环境，也没有 CI Docker build。

---

## 3. 目前存在的问题

### 3.1 代码质量与可维护性

| 问题 | 位置 | 影响 |
|---|---|---|
| `actions.ts` 超过 1000 行，包含全部公开/admin action 与大量内联逻辑 | `src/server/instance/actions.ts` | 修改一个 action 容易误触其他逻辑；测试和 review 成本高 |
| `GalleryHome` 约 540 行，数据加载、投票、图片优先级、视图状态全在一个组件 | `src/web/layouts/GalleryHome/index.tsx` | 状态耦合；难做局部测试和虚拟列表 |
| `Detail` 约 368 行，动画、触摸、图片加载混在一起 | `src/web/components/Detail/index.tsx` | 出错路径难处理，缺少加载失败态 |
| 公开页仍有大量历史注释/旧 API 示例 | `src/web/components/Submission/index.tsx` | 阅读噪音，容易误用过时字段 |
| `queue-load` 使用 `any`、`pipe`、可变 Memo，类型边界弱 | `src/web/utils/queue-load.ts` | 失败路径和缓存策略难以推理 |
| HDR 过渡字段仍保留了内部 `is_hdr`/`ImageInfo.is_hdr`，而公开字段已改为 `has_hdr_optimized` | `src/server/storage/image.ts`、`codec.ts` | 命名双轨，后续 HDR 实现容易混用 |
| `src_optimized_hdr` 永远为 `null`，`has_hdr_optimized` 永远为 `false` | `src/server/instance/serializers.ts` | 有意占位，但目前是“半成品 API”，需要文档和后续实现跟上 |
| 一次性 Legacy 迁移代码仍在服务端目录 | `src/server/migration/` | 不影响运行，但增加搜索和构建噪音 |
| 测试只有服务端，没有浏览器 UI/E2E | `test/` | 前端加载失败、缓存、交互回归无法自动发现 |

### 3.2 性能隐患

#### 3.2.1 所有 mutation 串行，图片处理阻塞业务

`src/server/instance/index.ts` 用 `Sequence()` 包住整个 mutation。`preparePhoto` 在 mutation 内部执行 sharp 编码，因此：

```text
上传/更新相片
→ 生成 optimized + thumb
→ 期间所有 vote / gallery / member / admin mutation 都排队
```

`image_processing_effort` 默认是 8（偏慢），高分辨率图片和多张批量重建时，这个队列会明显拉长。公开页投票、后台保存、投稿都会被图片处理拖住。

这是当前最值得优先解决的性能问题。

#### 3.2.2 DTO 序列化存在重复扫描

- `findMemberByIdOrNull` 对 `pool.members` 做线性 `find`；
- `photoDto` 对每张相片查一次 member；
- `voteCountByPhoto` 对每张相片扫描整个 `vote_records`；
- `galleryDto` 对每张相片调用一次 `photoDto`。

因此一个 gallery 的 DTO 大致是：

```text
O(photos × members + photos × votes)
```

`adminListPhotos`、公开 `listGalleries` 在数据量上来后会放大这个问题。更适合预先构建：

- `memberId -> Member` 索引；
- 一次遍历算出 `photoId -> vote_count`；
- 序列化阶段只查表。

#### 3.2.3 全量返回、无分页

- `listGalleries` 返回所有 galleries 和所有 photos；
- `adminListPhotos` 返回全部相片；
- 后台 `listPhotos(galleryId)` 先取全部再前端过滤；
- 没有 cursor/limit/分页；
- 没有缩略图尺寸选择/srcset。

相片数量增加后，首屏 JSON 和客户端内存都会上升。

#### 3.2.4 图片响应整块读入内存

`Storage.readImage()` 使用 `fs.readFile()` 返回完整 `Buffer`。大图、并发详情请求和批量预加载会带来额外内存峰值；目前依靠浏览器 immutable 缓存，但没有流式响应、Range 或 CDN 层。

#### 3.2.5 前端图片队列缓存不释放

`src/web/utils/queue-load.ts`：

- 全局 `cache` 保存 `Blob` 和 `blobUrl`；
- `URL.createObjectURL` 创建后没有对应的 `revokeObjectURL`；
- 照片列表变化、翻相册、重试后旧 URL 仍被缓存。

长时间浏览会累积内存和 object URL。队列并发限制是 5，但没有缓存上限、LRU 或清理策略。

#### 3.2.6 初始加载硬编码延迟

`GalleryHome` 在 `fetchList()` 前有 `timeout(4000)`。这会固定增加约 4 秒首屏等待，且与网络/缓存无关。需要确认是刻意动画节奏还是历史遗留；如果是后者应移除或改成并行加载。

#### 3.2.7 JSON 持久化写放大

- `members.json` 任一成员变化会重写全部成员；
- 每个 gallery 单独写文件；
- `writeJsonAtomic` 每次写前复制 `.bak`；
- 没有批量事务；
- `loadPoolFromDisk` 逐个读取 gallery 文件。

当前规模可以接受，但相片/投票增长后会成为磁盘 I/O 瓶颈。

### 3.3 潜在 bug / 可靠性问题

#### 3.3.1 详情页没有图片加载失败处理

`src/web/components/Detail/index.tsx` 的 `usePictureLoading` 只在 `sourceUrl` 变化时设为 loading，`onLoad` 清除；没有 `onError`：

```tsx
<img className="source" src={sourceUrl} onLoad={onLoad} />
```

如果 optimized/thumb URL 404、被缓存层返回错误、或浏览器解码失败，loading 可能永久保留。应在 `<img>` 上加 `onError`，显示失败态并提供重试/回退。

#### 3.3.2 后台 30 秒超时与服务端长任务不匹配

`src/web/admin/api/client.ts` 的 axios timeout 是 30 秒；单张重建、批量重建、图片处理可能超过 30 秒：

- 客户端显示超时/失败；
- 服务端 mutation 可能继续执行并最终落盘；
- 用户重试会叠加任务。

建议：

- 长任务改成异步 job + 轮询；
- 或至少区分普通 admin mutation 与 image mutation 的超时；
- 服务端增加幂等/任务状态。

#### 3.3.3 JSON 跨文件写入没有事务

`storeByDiff` 依次写：

```text
pool.json
members.json（如变化）
galleries/<id>.json（逐个）
```

中途崩溃/磁盘错误会留下部分提交。内存 pool 不更新，但磁盘可能已经部分更新。当前没有 journal、临时目录整体切换或恢复逻辑。

`writeJsonAtomic` 虽然有 `.bak`，但读取路径不会自动回退 `.bak`，备份也没有恢复命令。

#### 3.3.4 图片文件与 JSON 提交不是同一事务

`preparePhoto`/`prepareAvatar` 先写 source/derived 文件，再由 dispatch 写 JSON。如果 JSON 持久化失败：

- action 已经返回成功；
- `dispatchMutation` 捕获持久化错误并抛 500；
- 但 action 内的 `discard()` 不在持久化失败路径上被调用；
- 可能留下没有 Photo/Member 引用的 source/optimized/thumb 文件。

GC 只在 mutation 成功后运行，失败路径不会自动清理。需要把“文件提交”纳入事务边界，或在启动时做 orphan 扫描。

#### 3.3.5 storage lock 的 stale 判断偏宽松

`src/server/storage/lock.ts` 的 `isStale()`：

- 文件解析失败 → `true`；
- 读取失败（除 ENOENT）→ `true`；
- 只通过 PID 判断进程是否存在。

可能的风险：

- PID 复用导致活跃进程被误判；
- lock 文件权限/读取异常时直接视为 stale，可能删除活跃锁；
- 崩溃后没有基于时间/心跳的兜底。

建议 lock 文件带心跳/时间戳，只有明确过期或 PID 不存在才回收。

#### 3.3.6 `has_hdr_optimized` 迁移是“丢弃式”

当前旧 storage 的 `is_hdr` 被兼容读取，但 Phase 0 直接按 `false` 处理，不检查旧 HDR 文件。这是有意设计，但需要注意：

- 旧 HDR source 不会自动生成新 HDR；
- 旧 HDR 文件只是不再被 API 引用；
- 必须执行一次全量重建，才能得到新的命名/thumb；
- 如果未重建，新 API 的无后缀 thumb 和头像 `.avif` 会 404。

这一点已在文档/计划中说明，但应在部署 checklist 中显式列出。

#### 3.3.7 CRC32 文件名碰撞

`source` 使用 CRC32 作为内容标识。CRC32 只有 32 位，理论上不同内容可以碰撞；如果发生碰撞且 `source_existed` 为真，可能复用错误 source。实际概率低，但这是一个非加密校验值，不应承担安全边界。

#### 3.3.8 上传没有超时/取消

`src/web/api/upload.ts` 设置 `xhr.timeout = 0`，上传没有客户端超时；`onabort` 也没有 UI 取消入口。网络半断时请求可能长期挂起。

#### 3.3.9 GIF/动画语义

图片格式允许 GIF。sharp 默认只处理首帧/静态图；如果未来允许动画 GIF，当前 pipeline 没有明确“只取首帧”的文档和 UI 提示。建议明确拒绝动画或固定首帧。

#### 3.3.10 图片解压炸弹

上传大小有限制，但图片像素尺寸没有在解码前限制。一个很小的压缩文件可以解码成很大的位图。`max_image_dimension` 只影响输出尺寸，不限制解码内存。建议在 sharp 读取 metadata 后增加像素上限，并尽早拒绝。

### 3.4 安全问题

| 问题 | 说明 | 建议 |
|---|---|---|
| 登录无限流 | `/auth/login` 没有本地速率限制，文档建议反向代理层处理 | 增加 IP/账号维度限流、失败计数、延迟 |
| `ADMIN_PASSWORD` 无最小长度 | 生产只校验 `JWT_SECRET` 长度，密码可以为 1 字符 | production 要求密码最小长度/复杂度 |
| token 存 `localStorage` | 任意 XSS 可读取长期 admin token | 考虑 HttpOnly cookie + CSRF，或严格 CSP + 短 token |
| 没有审计日志 | 删除相片/相册、清票、改配置没有 actor 记录 | 增加 admin audit trail |
| 图片解压炸弹 | 见 3.3.10 | 像素上限、解码前 metadata 校验 |
| CORS development 默认 `*` | 开发方便，但不能带到公网 | 生产已强制显式 CORS，保持 |
| 无备份/恢复流程 | JSON `.bak` 不是可操作备份 | 定期快照 + 恢复演练 |
| 无请求 ID/追踪 | 日志只有 method/path/status/duration | 加入 request id、耗时分位、错误聚合 |

---

## 4. 当前测试与验证

已验证：

```text
pnpm typecheck  通过
pnpm lint       0 errors，16 个旧 UI warnings
pnpm test       12 个测试文件，70 个用例通过
pnpm build      通过
```

覆盖情况：

- 领域模型 id/投票/投稿；
- storage 持久化、lock、初始化；
- 图片上传、EXIF Orientation、安全限制、temp 清理；
- source/optimized/thumb 服务和重建；
- 头像 source/thumb、头像重建；
- instance config/hash；
- dispatch 权限/参数；
- migration 测试；
- 静态缓存/路由。

缺口：

- 没有浏览器 UI 交互测试；
- 没有并发 mutation/图片处理压测；
- 没有崩溃恢复/部分写入测试；
- 没有大相册序列化性能测试；
- 没有登录暴力破解/限流测试；
- 没有真实 HDR 测试（Phase 1）。

---

## 5. 未来展望

以下按“先稳定、后扩展”的顺序排列。

### 5.1 稳定性与性能（优先）

1. **图片处理移出 mutation 关键路径**
   - 请求只创建 job，后台 worker 处理；
   - mutation 只做轻量校验/入队；
   - 前端轮询 job 或订阅进度。

2. **修复详情加载失败态**
   - `onError`、重试、SDR 回退；
   - 避免无限 loading。

3. **前端图片缓存治理**
   - object URL 回收；
   - LRU/上限；
   - 列表卸载时释放；
   - 预加载队列可取消。

4. **分页/虚拟列表**
   - galleries/photos cursor；
   - admin 列表分页；
   - 大相册只加载视口附近。

5. **DTO 索引化**
   - member id map；
   - vote count map；
   - gallery 级聚合；
   - 避免 O(P×M + P×V)。

6. **图片响应流式化/CDN**
   - `createReadStream` 替代 `readFile`；
   - Range/ETag；
   - CDN 或对象存储；
   - srcset 多尺寸 thumb。

### 5.2 数据可靠性

1. **storage 事务/恢复**
   - 临时目录整体切换；
   - journal/manifest；
   - 启动 orphan 扫描；
   - `.bak` 恢复命令；
   - 明确“文件 + JSON”提交顺序。

2. **SQLite/Postgres**
   - 当照片/投票规模超过 JSON 舒适区时；
   - 事务、索引、分页；
   - 保留图片池文件存储。

3. **备份/导出**
   - 后台一键导出；
   - 快照/恢复演练；
   - 迁移前自动备份。

### 5.3 HDR（已规划）

按 [docs/todo/hdr-supports.md](docs/todo/hdr-supports.md)：

- libavif CLI + libaom + libxml2；
- 纯 HDR base 的 `-hdr.avif`；
- SDR/HDR 双文件；
- Docker-first 构建；
- CICP/gain map 验证；
- `has_hdr_optimized`/`src_optimized_hdr` 真正生效。

这是当前最明确的“下一阶段功能”。

### 5.4 用户体验/产品功能

- 上传进度、取消、断点续传；
- 拖拽排序、批量上传；
- 相片搜索/标签/人物/活动筛选；
- EXIF 信息面板/GPS 地图；
- 投票结果统计图表；
- 管理端审计日志/撤销；
- 投稿审核/举报/隐藏；
- 分享链接/二维码；
- 公开页虚拟滚动与骨架屏；
- PWA/离线缓存；
- 可访问性（键盘、aria、对比度）。

### 5.5 工程/运维

- Docker 化本地开发 + CI（Phase 1 计划）；
- GitHub Actions 构建/推送镜像；
- Prometheus metrics / OpenTelemetry；
- 结构化日志 + request id；
- 错误监控；
- 登录限流/审计；
- E2E（Playwright）；
- 依赖漏洞扫描；
- 多实例前先做 storage 抽象和共享锁。

---

## 6. 工作目标与时间评估

### 6.1 目标分层

| 层级 | 目标 | 完成标准 |
|---|---|---|
| P0 稳定 | 不丢数据、不出无限 loading、长任务可控 | 崩溃/失败测试、加载失败态、任务状态 |
| P1 性能 | mutation 不被图片阻塞，列表可扩展 | 图片 job 化、分页、序列化索引 |
| P2 HDR | SDR/HDR 双 AVIF，HDR 不过曝 | CICP 校验、手机验收、Docker 构建 |
| P3 数据 | JSON 可恢复，规模上限明确 | 事务/备份/orphan 扫描；必要时 SQLite |
| P4 产品 | 搜索、批量、统计、审核等 | 按产品优先级排期 |

### 6.2 时间估算

假设：1 名熟悉代码的全职工程师，5 天/周，包含实现、测试、文档，不包含产品设计评审和线上灰度时间。

| 工作包 | 内容 | 估算 |
|---|---|---:|
| P0 稳定性修复 | 详情失败态、队列回收、上传取消/超时、登录限流、密码长度、崩溃恢复最小集 | 5–7 天 |
| HDR Phase 1 | libavif 构建、HDR 编码、Docker-first、CICP 测试、手机验收 | 7–10 天 |
| 图片 job 化 | 后台队列、任务状态、进度、重试、mutation 解耦 | 5–8 天 |
| 查询/分页/序列化 | 索引、cursor、admin 分页、大相册压测 | 5–8 天 |
| storage 事务/恢复 | journal/manifest、orphan 扫描、备份恢复 | 5–8 天 |
| 前端 UX/E2E | 虚拟列表、错误态、Playwright 基础覆盖 | 5–8 天 |
| 产品功能 | 搜索/标签/统计/审核/上传体验等 | 2–4 周 |

### 6.3 推荐节奏

**第 1 周：P0 稳定修复**

- 详情 `onError`
- object URL 回收/缓存上限
- 上传超时/取消
- 登录限流/密码要求
- 图片解压像素上限
- 失败路径 orphan 清理
- 补充回归测试

**第 2–3 周：HDR Phase 1**

- Docker 多阶段 + libavif
- `-hdr.avif` 生成
- `has_hdr_optimized`/`src_optimized_hdr`
- CICP/gain map 测试
- 手机验收

**第 4–5 周：图片 job 化 + 分页/索引**

- 图片任务异步
- 批量重建进度
- DTO 索引
- cursor 分页
- 压测

**第 6–7 周：storage 可靠性**

- 事务/恢复
- 备份
- orphan 扫描
- 崩溃恢复测试

**第 8 周以后：产品功能/长期架构**

- 搜索/标签/统计/审核
- SQLite/对象存储评估
- 可观测性

### 6.4 总工期

- **最小可用加固（P0 + HDR）**：约 2–3 周。
- **稳定可扩展版本（P0 + HDR + job + 分页 + storage 恢复）**：约 6–8 周。
- **包含产品增强**：约 8–12 周，具体取决于功能范围。

如果只能做一件事：先做 **P0 稳定性 + 图片处理 job 化**，再做 HDR。否则 HDR 只会让图片处理更重，串行 mutation 的问题会更明显。

---

## 7. 建议的下一步

1. 先补一个 **P0 修复清单**，不引入新依赖：
   - 详情 `onError`；
   - queue object URL 回收；
   - 图片像素上限；
   - 上传超时/取消；
   - admin 图片请求超时策略；
   - 失败路径 orphan 清理。

2. 然后按 [docs/todo/hdr-supports.md](docs/todo/hdr-supports.md) 进入 HDR Phase 1，同时把 Docker 开发/CI 一起落地。

3. HDR 完成后再做 **图片 job 队列**，不要在 HDR 之前把图片处理继续堆进 mutation。

4. 数据量达到数千相片/数万投票前，评估 SQLite；不要等到 JSON 写放大和 O(n²) 序列化已经影响线上再迁移。

---

## 8. 附录：主要文件索引

| 文件 | 作用 |
|---|---|
| `src/server/server.ts` | HTTP server、Vite/static 分流、优雅关闭 |
| `src/server/api/index.ts` | Hono 路由、缓存、错误响应、静态 SPA |
| `src/server/api/admin.ts` | 登录、JWT、admin auth |
| `src/server/api/upload.ts` | multipart 上传、CRC、temp |
| `src/server/instance/index.ts` | Instance、Sequence、dispatch、持久化 |
| `src/server/instance/actions.ts` | 全部 query/mutation |
| `src/server/instance/prepare-photo.ts` | 图片准备、刷新、GC |
| `src/server/instance/serializers.ts` | DTO 与图片 URL |
| `src/server/storage/index.ts` | JSON/storage、图片删除、lock |
| `src/server/storage/fs.ts` | 原子写、备份 |
| `src/server/storage/codec.ts` | JSON 编解码、旧字段兼容 |
| `src/server/storage/image.ts` | sharp SDR 编码 |
| `src/server/core/Pool.ts` | 领域聚合、索引/查找 |
| `src/server/core/Gallery.ts` | 相册/投票领域逻辑 |
| `src/web/layouts/GalleryHome/index.tsx` | 公开页数据/投票/详情 |
| `src/web/components/Detail/index.tsx` | 详情大图/动画/加载 |
| `src/web/utils/queue-load.ts` | 前端图片队列/缓存 |
| `src/web/admin/api/client.ts` | 后台 API 客户端/超时 |
| `Dockerfile` / `compose.yaml` | 生产构建/运行 |
| `.github/workflows/ci.yml` | 当前 CI |
