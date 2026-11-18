# HTTP API

服务端与前端同源，默认地址 `http://localhost:7001`。除 `/upload-image`（multipart）外，业务接口都是 `POST` + JSON；图片、健康检查和 SSE 推送是 `GET`。登录流程见 [auth.md](auth.md)。

## 响应格式

请求体统一为：

```json
{ "payload": {} }
```

也接受直接把 payload 作为请求体。成功：

```json
{ "success": true, "data": {} }
```

失败：

```json
{
  "success": false,
  "code": "INVALID_PAYLOAD",
  "message": "参数错误",
  "details": []
}
```

## 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/auth/login` | 后台登录，返回 JWT |
| `GET` | `/auth/check` | 校验 Bearer token，通过返回 `{ ok: true }`，不返回后台数据；过期 401，无效 403 |
| `POST` | `/query/:name` | 公开 query |
| `POST` | `/mutate/:name` | 公开 mutation |
| `POST` | `/admin/query/:name` | admin query，需要 Bearer token |
| `POST` | `/admin/mutate/:name` | admin mutation，需要 Bearer token |
| `POST` | `/upload-image` | 上传图片到临时目录 |
| `GET` | `/images/source/:file` | 原图 |
| `GET` | `/images/optimized/:file` | 全尺寸 SDR/HDR AVIF；始终返回 image/avif |
| `GET` | `/images/thumb/:file` | SDR 缩略图；始终返回 image/avif |
| `GET` | `/healthz` | 健康检查 |
| `GET` | `/events/pool` | 公开页 SSE：照片、成员分类更新 |
| `GET` | `/admin/events/pool` | Admin SSE：完整 AdminPool 更新，需要 Bearer token |

`/admin/*` 的 query/mutation 需要 `Authorization: Bearer <token>`。公开路由调用 admin action 返回 `403`。

## 公开 queries

| action | payload | 返回 |
|---|---|---|
| `listGalleries` | `{}` | `{ active, galleries }` |
| `getGallery` | `{ gallery_id }` | Gallery |
| `getPhoto` | `{ photo_id }` | Photo |
| `getSubmission` | `{ gallery_id, qq_num }` | Photo 或 `null` |
| `confirmMember` | `{ qq_num }` | `{ value: boolean }` |
| `getMemberPhotos` | `{ qq_num }` | `{ active, galleries }` |
| `fetchClientPool` | `{}` | ClientPool；活动期 GalleryInEvent |
| `fetchMemberView` | `{ qq_num }` | 当前成员自己的投票/投稿状态 |

## 公开 mutations

| action | payload | 返回 |
|---|---|---|
| `submitPhoto` | `{ gallery_id, qq_num, desc, temp_id }` | Photo |
| `updateSubmission` | `{ photo_id, qq_num, desc?, temp_id? }` | Photo |
| `cancelSubmission` | `{ photo_id, qq_num }` | Photo |
| `vote` | `{ gallery_id, qq_num, photo_ids }` | Vote 结果 |

`temp_id` 来自 `/upload-image`。投稿和投票受相册时间窗口、每人一次投稿、`vote_limit` 等规则限制。

### ClientPool

公开页使用 `fetchClientPool` 获取统一快照：

```json
{
  "schema_version": 2,
  "next_id": 42,
  "instance_hash": "5a493005",
  "app_startup_time": 1790000000000,
  "submissions": 12,
  "votes": 31,
  "version_time": 1790000000123,
  "build_date": "2026-10-28",
  "git_hash": "5d25b84",
  "galleries": [],
  "members": []
}
```

- `galleries` 中的元素是 `Gallery | GalleryInEvent`，用 `in_event` 区分。
- `GalleryInEvent` 不包含 `vote_records`，其中 `photos[].member_id` 为 `null`。
- 普通 `Gallery` 保留 `member_id` 和 `vote_records`。
- `members` 保留完整成员列表，但每个 `ClientMember.qq_num` 固定为 `null`。
- `submissions` 统计全部相片；`votes` 统计非活动 Gallery 的投票数。
- `app_startup_time` 是服务端程序启动时间（epoch ms）。
- `version_time` 是本次 ClientPool 生成时间（epoch ms），仅作为快照元数据；SSE 不使用它判断新旧，而是按 item 的 `updated_at` 合并。
- `build_date` / `git_hash` 在 dev 下为 `N/A`，`pnpm build` / `pnpm start` 构建时注入。
- ClientPool 不返回成员 QQ；头像文件名使用 member id，不包含 QQ。


## SSE

服务端提供两条互不相同的 SSE 长连接。SSE 使用 `GET`，不计入普通 query/mutation。

### 公开页 `/events/pool`

公开连接建立后立即收到两条当前分类快照：

```text
event: gallery-photos
data: {"galleries":[{"id":1,"in_event":true,"photos":[...]}]}

event: members
data: {"members":[...]}
```

- `gallery-photos` 包含所有 Gallery 的 `photos` 和 `in_event`
- `members` 包含当前 `ClientPool.members`
- 两类数据都只包含公开字段；`members[].qq_num` 固定为 `null`
- 不包含 `vote_records`、Gallery 元数据、AdminPool 或 `instance_config`
- Pool 更新后，只有序列化字符串发生变化的分类会推送
- 每 15 秒发送 `ping`
- 事件没有 `version_time` 新旧语义

客户端合并规则：

- 按 item `id` 匹配
- incoming `updated_at` 更新时才覆盖
- 完整分类快照中不存在的 photo/member 视为删除
- 未变化的 photo/member/Gallery 对象保持原引用，避免瀑布流重建

### Admin `/admin/events/pool`

```http
GET /admin/events/pool
Authorization: Bearer <token>
Accept: text/event-stream
```

连接后立即收到完整 AdminPool，之后每次 Pool 或 instance_config 更新都会收到完整快照：

```text
event: admin-pool
data: <完整 AdminPoolDTO>
```

Admin SSE 包含真实 QQ 和 `instance_config`，只能通过带 Bearer token 的请求读取。Admin 前端用 `fetch` 读取流，不使用 EventSource，避免把 token 放进 URL。

### 缓存与重连

- 服务端在 Pool 更新后生成一次公开 photos/members 和完整 AdminPool 的 JSON raw 缓存
- 所有 SSE 客户端共享同一份 JSON 字符串，不会为每个连接重复序列化 Pool
- Gallery 时间窗口跨越 event_start/event_end 时，服务端会重建缓存并推送时间相关快照
- 公开页和 Admin 标签页切到后台时主动关闭 SSE 连接，回到前台再重连；避免后台标签各占一条 HTTP/1.1 连接，触发浏览器同 origin 的 6 连接上限
- 客户端断线自动重连；重连后立即收到当前快照
- 反向代理必须关闭 SSE buffering，见 [configure.md](configure.md)

### 公开 DTO 与 QQ

`listGalleries`、`getGallery`、`getPhoto`、`getSubmission`、`getMemberPhotos` 是 public query。它们返回的成员信息使用 `PublicMemberDTO`，其中：

```text
qq_num === null
```

Admin 侧统一通过 `adminFetchPool` 读取，`members` 和 `photos[].member` 使用 `MemberDTO`，保留真实 QQ。

### fetchMemberView

活动期 ClientPool 不返回投票记录，因此单独提供：

```text
POST /query/fetchMemberView
payload: { "qq_num": 123456 }
```

返回当前成员自己的：

```json
{
  "member_id": 1,
  "active_gallery_id": 2,
  "vote_submitted": false,
  "voted_photo_ids": [],
  "submitted_photo": null
}
```

不返回其他成员的投票记录。

### 前端页面

- `/` 重定向到 `/explore`。
- `/explore` 是公开相册页。
- `/behind` 是同级 About 页面，不再作为 `/` 的 fixed 子页面；其中的只读名单簿只用 ClientPool。
- `/member/<id>` 是单独的只读成员笔记本，只用 ClientPool，没有对应的新接口；不返回 QQ 号。
- `/admin` 是所见即所得后台。

## AdminPool

新 `/admin` 页面只使用：

```http
POST /admin/query/adminFetchPool
Authorization: Bearer <token>
payload: {}
```

返回完整 Pool：

```json
{
  "schema_version": 2,
  "next_id": 42,
  "instance_hash": "5a493005",
  "app_startup_time": 1790000000000,
  "version_time": 1790000000123,
  "build_date": "2026-10-28",
  "git_hash": "5d25b84",
  "galleries": [],
  "members": [],
  "instance_config": {}
}
```

- `galleries` 是完整的 `AdminGalleryDTO`，包含相片和 `vote_records`。
- `members` 是完整 `MemberDTO`，Admin 可以看到真实 QQ。
- `instance_config` 是完整 instance 配置，新 AdminConsole 的初始设置直接来自这里。
- 修改设置仍走 `adminUpdateInstanceConfig`；当前配置直接使用 `adminFetchPool` 返回的 `instance_config`。
- AdminConsole 保存 `instance_config` 失败时，前端触发现有 CRT critical failure。
- 旧 admin 读取 action（`adminListGalleries`、`adminGetGallery`、`adminListMembers`、`adminGetMember`、`adminListPhotos`、`adminGetPhoto`、`adminListAvailablePhotos`、`adminListMemberVotes`、`adminListPhotoVotes`、`adminStatistic`、`adminGetInstanceConfig`）已移除。

### Public legacy queries

以下公开查询保留兼容，但已 deprecate，新代码和新的公开页不再使用：

- `listGalleries`
- `getGallery`
- `getPhoto`
- `getSubmission`
- `getMemberPhotos`

公开页统一使用 `fetchClientPool`；当前成员的私有状态使用 `fetchMemberView`。

## Admin queries

管理员只有 `adminFetchPool` 一个读取入口：

| action | payload | 返回 |
|---|---|---|
| `adminFetchPool` | `{}` | 完整 AdminPool，包含 galleries、members、instance_config |

被移除的旧 admin 读取 action 调用时返回 `404 UNKNOWN_ACTION`。

## Admin mutations

| action | payload | 说明 |
|---|---|---|
| `adminUpdateInstanceConfig` | 任意 instance 配置字段 | 返回完整配置 |
| `adminCreateGallery` | `{ name, index, vote_limit, event_start, submission_expire, event_end }` | 创建相册；名称长度 1–256；活动期间与其他相册重合时返回 `409 CONFLICT` |
| `adminUpdateGallery` | `{ gallery_id, ...可选字段 }` | 更新相册；活动期间与其他相册重合时返回 `409 CONFLICT` |
| `adminRemoveGallery` | `{ gallery_id }` | 删除空相册；仍有相片时返回 `409 CONFLICT` |
| `adminCreateMember` | `{ qq_num, name, avatar_temp_id }` | 创建成员，必须上传头像 |
| `adminUpdateMember` | `{ member_id, name?, avatar_temp_id? }` | 更新成员；QQ 不可修改 |
| `adminRemoveMember` | `{ member_id }` | 删除成员 |
| `adminClearMemberGalleryVotes` | `{ member_id, gallery_id }` | 清空某成员在某相册的投票 |
| `adminCreatePhoto` | `{ gallery_id, member_id, desc, index?, temp_id }` | 创建相片 |
| `adminUpdatePhoto` | `{ photo_id, gallery_id?, member_id?, desc?, index?, temp_id? }` | 更新相片 |
| `adminRemovePhoto` | `{ photo_id }` | 删除相片 |
| `adminSortPhotos` | `{ gallery_id, photo_ids }` | 一次性重排整个相册：`photo_ids[i]` 的 `index` 写成 `i`，公开页按 `index` 升序展示。`photo_ids` 必须恰好是该相册的全部相片，缺漏或重复返回 `400`，含其他相册的相片返回 `404`，整体拒绝、不改任何一张；`index` 未变的相片不刷新 `updated_at`。返回更新后的相册 |
| `adminRefreshThumb` | `{ photo_id }` | 重建 SDR optimized/thumb，并按 source 重新生成 HDR optimized；同时更新持久化的 `has_hdr_optimized` 标志。超过 AVIF 每边 16384px 时返回 400 |
| `adminRefreshAvatar` | `{ member_id }` | 重建头像缩略图 |

日期字段使用 ISO 8601，例如 `2026-10-01T00:00:00.000Z`。

### 相册活动窗口与重合限制

`in_event` 的判断使用服务端当前时间：

```text
event_start <= now <= event_end
```

边界包含在内，因此 `now === event_start` 和 `now === event_end` 都算活动期。

任意两个 Gallery 的活动区间不能重合。判断使用闭区间：

```text
left.event_start <= right.event_end
right.event_start <= left.event_end
```

两个区间即使只在 `event_end === other.event_start` 的边界相接，也算重合。

校验顺序：

1. mutation 的 `commit` 生成候选 Pool。
2. 写入内存 Pool 之前，检查候选 Pool。
3. 如果任意两个 Gallery 的活动区间重合，返回 `409 CONFLICT`：

```text
相册的活动期间不能有重合
```

4. 校验通过后才更新内存 Pool 并持久化。

因此：

- 当前有活动相册时，仍可创建活动区间不重合的未来相册。
- `adminCreateGallery` 和 `adminUpdateGallery` 都受此限制。
- 被拒绝的 mutation 不会改变现有 Gallery 或持久化数据。

## 图片上传

`POST /upload-image` 使用 `multipart/form-data`，字段名为 `file` 或 `image`。

成功返回：

```json
{
  "success": true,
  "data": {
    "temp_id": "0192f0c1-7a2b-7c3d-8e4f-123456789abc",
    "width": 1200,
    "height": 800,
    "format": "png",
    "size": 123456,
    "crc32": 907060870
  }
}
```

上传只写入 `stored-images/temp/<uuidv7>.<format>`。`temp_id` 本身是 UUIDv7，不带扩展名；扩展名只允许 `[0-9A-Za-z]`，归一化后的格式还必须和实际图片内容一致。创建/更新相片或成员时把 `temp_id` / `avatar_temp_id` 传给 mutation：source 保存原图，相片生成 SDR optimized/thumb，HDR source 额外生成 HDR optimized。临时文件默认 24 小时过期。

限制：

- 文件大小不能超过当前 instance 配置的 `max_upload_bytes`，也不能超过进程的 `HTTP_BODY_HARD_LIMIT_BYTES`。
- 图片不能太长：按当前配置生成的相片缩略图、相片 optimized、头像缩略图，任何一边超过 16384px（AVIF 上限）就返回 400 “图片太长了……”。规则见 [configure.md](configure.md)“过长图片在上传时拒绝”。
- 无法解析的图片返回 `BAD_REQUEST`。
- 临时文件由服务端在启动和清理流程中回收。

## 图片读取

```text
GET /images/source/:file       # 原图原始字节
GET /images/optimized/:file    # SDR/HDR AVIF 全尺寸图
GET /images/thumb/:file        # SDR AVIF 缩略图
```

响应带强缓存：

```http
Cache-Control: public, max-age=31536000, immutable
```

source 地址形如 `photo-<gallery_id>-<photo_id>-<crc32>.<format>`；`format` 可以是 `jpg`、`png`、`gif`、`webp`、`avif`、`heic`，例如 `photo-2-3-4a9b66db.jpg`。SDR 始终生成；HDR source 额外生成 HDR：

```text
source/photo-2-3-4a9b66db.jpg
optimized/photo-2-3-4a9b66db-sdr.avif
optimized/photo-2-3-4a9b66db-hdr.avif   # 仅 HDR source
thumb/photo-2-3-4a9b66db.avif
```

头像：

```text
source/avatar-<member-id>-<crc32>.<format>
thumb/avatar-<member-id>-<crc32>.avif
```

头像 thumb 内容为 SDR AVIF。

`PhotoDTO` 的 `src` / `src_url` 指向 source 原图；`src_optimized` 是 SDR 全尺寸图，`src_optimized_hdr` 是 HDR 全尺寸图（没有时为 `null`），`thumb` 是 SDR 缩略图；三者都带版本参数：

```json
{
  "src_url": "http://localhost:7001/images/source/photo-2-3-4a9b66db.jpg",
  "src_optimized": "http://localhost:7001/images/optimized/photo-2-3-4a9b66db-sdr.avif?v=5a493005",
  "src_optimized_hdr": "http://localhost:7001/images/optimized/photo-2-3-4a9b66db-hdr.avif?v=5a493005",
  "thumb": "http://localhost:7001/images/thumb/photo-2-3-4a9b66db.avif?v=5a493005",
  "thumb_url": "http://localhost:7001/images/thumb/photo-2-3-4a9b66db.avif?v=5a493005",
  "has_hdr_optimized": true
}
```

- `thumb_url` 是 `thumb` 的同值兼容别名。
- `?v=` 来自 `Instance.getInstanceHash()`，即当前 `instance_config` 与图片派生常量（`AVIF_MAX_DIMENSION`、`MIN_DERIVED_SHORT_EDGE`）的 CRC32；配置或这些常量变化后 URL 变化，避免浏览器继续使用旧的 immutable 缓存。
- 头像 `avatar_thumb_url` 同样带 `?v=`。
- `has_hdr_optimized` 是上一次 prepare / 后台重建时记录的持久化标志，不是每次请求实时读盘；没有 HDR 时为 `false`，`src_optimized_hdr` 为 `null`。
- HDR 只从 PQ/HLG CICP、JPEG/AVIF gain map 或 HEIC Apple HDR gain map 生成；10-bit SDR 和没有 CICP 的 16-bit 图不生成 HDR。详见 [images.md#hdr](images.md#hdr)。
- 旧的 `-hdr.avif` 文件会在重建时按新结果清理或更新。

## 健康检查

```http
GET /healthz
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "scene": "production"
  }
}
```

## 错误码

| HTTP | code | 说明 |
|---:|---|---|
| 400 | `BAD_REQUEST` / `INVALID_PAYLOAD` | 参数或 JSON 非法 |
| 401 | `UNAUTHORIZED` | 缺少/无效/过期 token |
| 403 | `FORBIDDEN` | 非 admin 路由调用 admin action |
| 404 | `NOT_FOUND` / `UNKNOWN_ACTION` | 资源或 action 不存在 |
| 409 | `CONFLICT` | 唯一性、时间窗口、引用关系冲突 |
| 413 | `BAD_REQUEST` | 请求体过大 |
| 500 | `INTERNAL` | 未预期错误 |

## curl 示例

```bash
curl -X POST http://localhost:7001/query/listGalleries \
  -H 'content-type: application/json' \
  -d '{"payload":{}}'

curl -X POST http://localhost:7001/auth/login \
  -H 'content-type: application/json' \
  -d '{"password":"your-password"}'

curl http://localhost:7001/auth/check \
  -H "authorization: Bearer $TOKEN"

curl -X POST http://localhost:7001/admin/query/adminFetchPool \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"payload":{}}'
```

## SPA 路由边界

以下路径即使没有匹配的 API handler 也不会回落到 `index.html`：

- `/query/*`
- `/mutate/*`
- `/admin/query/*`
- `/admin/mutate/*`
- `/auth/*`
- `/upload-image`
- `/images/*`
- `/healthz`

其他 GET 请求在 development 由 Vite middleware、在 production 由 Hono SPA fallback 返回 `index.html`；production 响应使用 `Cache-Control: no-cache`。
