# HTTP API

服务端与前端同源，默认地址 `http://localhost:7001`。除 `/upload-image`（multipart）外，业务接口都是 `POST` + JSON；图片和健康检查是 `GET`。登录流程见 [auth.md](auth.md)。

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
| `POST` | `/query/:name` | 公开 query |
| `POST` | `/mutate/:name` | 公开 mutation |
| `POST` | `/admin/query/:name` | admin query，需要 Bearer token |
| `POST` | `/admin/mutate/:name` | admin mutation，需要 Bearer token |
| `POST` | `/upload-image` | 上传图片到临时目录 |
| `GET` | `/images/source/:file` | 原图 |
| `GET` | `/images/optimized/:file` | 全尺寸 SDR/HDR AVIF；始终返回 image/avif |
| `GET` | `/images/thumb/:file` | SDR/HDR 缩略图；始终返回 image/avif |
| `GET` | `/healthz` | 健康检查 |

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

## 公开 mutations

| action | payload | 返回 |
|---|---|---|
| `submitPhoto` | `{ gallery_id, qq_num, desc, temp_id }` | Photo |
| `updateSubmission` | `{ photo_id, qq_num, desc?, temp_id? }` | Photo |
| `cancelSubmission` | `{ photo_id, qq_num }` | Photo |
| `vote` | `{ gallery_id, qq_num, photo_ids }` | Vote 结果 |

`temp_id` 来自 `/upload-image`。投稿和投票受相册时间窗口、每人一次投稿、`vote_limit` 等规则限制。

## Admin queries

| action | payload | 返回 |
|---|---|---|
| `adminGetInstanceConfig` | `{}` | InstanceConfig |
| `adminStatistic` | `{}` | `{ gallery_count, member_count, photo_count, vote_count }` |
| `adminListGalleries` | `{}` | Gallery[] |
| `adminGetGallery` | `{ gallery_id }` | Gallery |
| `adminListMembers` | `{}` | Member[] |
| `adminGetMember` | `{ member_id }` | Member |
| `adminListPhotos` | `{}` | Photo[] |
| `adminGetPhoto` | `{ photo_id }` | Photo |
| `adminListAvailablePhotos` | `{}` | Photo[] |
| `adminListMemberVotes` | `{ gallery_id }` | Member + votes[] |
| `adminListPhotoVotes` | `{ gallery_id }` | `{ photo, votes }[]` |

## Admin mutations

| action | payload | 说明 |
|---|---|---|
| `adminUpdateInstanceConfig` | 任意 instance 配置字段 | 返回完整配置 |
| `adminCreateGallery` | `{ name, index, vote_limit, event_start, submission_expire, event_end }` | 创建相册 |
| `adminUpdateGallery` | `{ gallery_id, ...可选字段 }` | 更新相册 |
| `adminRemoveGallery` | `{ gallery_id }` | 删除相册 |
| `adminCreateMember` | `{ qq_num, name, avatar_temp_id }` | 创建成员，必须上传头像 |
| `adminUpdateMember` | `{ member_id, name?, avatar_temp_id? }` | 更新成员；QQ 不可修改 |
| `adminRemoveMember` | `{ member_id }` | 删除成员 |
| `adminClearMemberGalleryVotes` | `{ member_id, gallery_id }` | 清空某成员在某相册的投票 |
| `adminCreatePhoto` | `{ gallery_id, member_id, desc, index?, temp_id }` | 创建相片 |
| `adminUpdatePhoto` | `{ photo_id, gallery_id?, member_id?, desc?, index?, temp_id? }` | 更新相片 |
| `adminRemovePhoto` | `{ photo_id }` | 删除相片 |
| `adminSortPhotosByVoteCount` | `{ gallery_id }` | 按票数排序 |
| `adminRefreshThumb` | `{ photo_id }` | 按 `is_hdr` 重建 SDR/HDR optimized 和缩略图 |
| `adminRefreshAvatar` | `{ member_id }` | 重建头像缩略图 |

日期字段使用 ISO 8601，例如 `2026-10-01T00:00:00.000Z`。

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

上传只写入 `stored-images/temp/<uuidv7>.<format>`。`temp_id` 本身是 UUIDv7，不带扩展名；扩展名只允许 `[0-9A-Za-z]`，归一化后的格式还必须和实际图片内容一致。创建/更新相片或成员时把 `temp_id` / `avatar_temp_id` 传给 mutation：source 保存原图，相片生成 SDR optimized/thumb，HDR 相片额外生成 HDR optimized/thumb。临时文件默认 24 小时过期。

限制：

- 文件大小不能超过当前 instance 配置的 `max_upload_bytes`，也不能超过进程的 `HTTP_BODY_HARD_LIMIT_BYTES`。
- 无法解析的图片返回 `BAD_REQUEST`。
- 临时文件由服务端在启动和清理流程中回收。

## 图片读取

```text
GET /images/source/:file       # 原图原始字节
GET /images/optimized/:file    # SDR/HDR AVIF 全尺寸变体
GET /images/thumb/:file        # SDR/HDR AVIF 缩略图
```

响应带强缓存：

```http
Cache-Control: public, max-age=31536000, immutable
```

source 地址形如 `photo-<gallery_id>-<photo_id>-<crc32>.<format>`，例如 `photo-2-3-4a9b66db.jpg`。SDR/HDR 变体在扩展名前插入 `-sdr` / `-hdr`：

```text
source/photo-2-3-4a9b66db.jpg
optimized/photo-2-3-4a9b66db-sdr.jpg   # AVIF
optimized/photo-2-3-4a9b66db-hdr.jpg   # AVIF，仅 is_hdr=true
thumb/photo-2-3-4a9b66db-sdr.jpg
thumb/photo-2-3-4a9b66db-hdr.jpg
```

头像文件名始终为 `avatar-<qq_num>-<crc32>.<format>`，source 和 thumb 同名；头像 thumb 只生成 SDR AVIF。

`PhotoDTO` 的 `src` / `src_url` 指向 source 原图，`thumb` / `thumb_url` 指向 SDR 缩略图，`is_hdr` 表示是否存在 HDR 变体。SDR 原图只有 `-sdr` 变体；HDR 原图同时有 `-sdr` 和 `-hdr`。前端只有在系统 HDR 且 `is_hdr=true` 时才请求 `-hdr`；否则使用 `-sdr`。HDR 变体缺失时直接 404，不回落 SDR；需要时在后台执行重建。

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

curl -X POST http://localhost:7001/admin/query/adminStatistic \
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
