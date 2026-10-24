# /api

Torzo Gallery 的新后端。当前与旧 `/server` API 不兼容，也还没有接入 `/web`。

## 要求

- Node.js >= 24.22.1
- pnpm >= 10.24.0

## 快速开始

```bash
cd api
nvm use 24.22.1
pnpm install
cp .env.example .env.development
pnpm dev
```

开发服务器默认监听 `http://localhost:7001`。

`pnpm dev` 使用 Node 原生 `--watch`，只监听被 import 的代码文件；`storage/` 的读写不会触发重启。收到 SIGTERM 时会等待持久化、释放 storage lock 再退出。

## 配置

配置分成两类。

### env 配置

进程启动后不可变。来源是 `process.env`，开发时由 `.env.development` 提供。完整列表见 [.env.example](.env.example)。

- `APP_ENV`
- `HTTP_PORT` / `HTTP_HOST`
- `STORAGE_PATH`
- `LOG_LEVEL`
- `ADMIN_PASSWORD` / `JWT_SECRET` / `JWT_EXPIRES_IN_SECONDS`
- `CORS_ORIGINS`
- `API_BASE_PATH` / `PUBLIC_BASE_URL`
- `HTTP_BODY_HARD_LIMIT_BYTES`
- `ALLOW_EMPTY_DATA`（仅首次初始化生产空 storage 时设为 `true`）

生产模式缺少 `ADMIN_PASSWORD`、`JWT_SECRET` 或 `PUBLIC_BASE_URL` 会直接退出。生产模式默认拒绝空 storage；首次初始化需要显式设置 `ALLOW_EMPTY_DATA=true`。

### instance 配置

运行期可修改，保存在 `<STORAGE_PATH>/instance-config.json`。首次启动自动写入默认值。

```json
{
  "schema_version": 1,
  "avatar_thumb_size": 128,
  "image_thumb_size": 640,
  "image_thumb_quality": 40,
  "image_thumb_effort": 8,
  "max_image_dimension": 3840,
  "max_upload_bytes": 16777216
}
```

通过 admin action 读取/修改：

```text
adminGetInstanceConfig
adminUpdateInstanceConfig
```

修改只影响后续的图片准备和上传，不会自动重做已有缩略图。

## Dispatch API

所有业务请求通过 action 名称分发。

| 路由 | 说明 |
|---|---|
| `POST /query/:name` | 公开 query |
| `POST /mutate/:name` | 公开 mutation |
| `POST /admin/query/:name` | admin query，需要 JWT |
| `POST /admin/mutate/:name` | admin mutation，需要 JWT |
| `POST /admin/login` | 登录 |
| `POST /upload-image` | 上传到临时目录 |
| `GET /images/source/:file` | 原图 |
| `GET /images/thumb/:file` | 缩略图 |
| `GET /healthz` | 健康检查 |

请求体：

```json
{
  "payload": {}
}
```

成功：

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

`__admin_list` 中的 action 只能从 `/admin/*` 调用；从公开路由调用会返回 403。

### 公开 actions

`listGalleries`, `getGallery`, `getPhoto`, `getSubmission`, `confirmMember`,
`getMemberPhotos`

`submitPhoto`, `updateSubmission`, `cancelSubmission`, `vote`

### Admin actions

`adminGetInstanceConfig`, `adminStatistic`, `adminListGalleries`,
`adminGetGallery`, `adminListMembers`, `adminGetMember`, `adminListPhotos`,
`adminGetPhoto`, `adminListAvailablePhotos`, `adminListMemberVotes`,
`adminListPhotoVotes`

`adminUpdateInstanceConfig`, `adminCreateGallery`, `adminUpdateGallery`,
`adminRemoveGallery`, `adminCreateMember`, `adminUpdateMember`,
`adminRemoveMember`, `adminClearMemberGalleryVotes`, `adminCreatePhoto`,
`adminUpdatePhoto`, `adminRemovePhoto`, `adminSortPhotosByVoteCount`,
`adminRefreshThumb`, `adminRefreshAvatar`, `adminCleanUnusedImages`

### 登录

```bash
curl -X POST http://localhost:7001/admin/login \
  -H 'content-type: application/json' \
  -d '{"password":"your-password"}'
```

返回 `data.token`，之后使用 `Authorization: Bearer <token>`。

## 图片流程

1. `POST /upload-image` 接收 `file` 或 `image`，校验大小和图片内容，写入 `<STORAGE_PATH>/stored-images/temp`，返回 `temp_id`、宽高和格式。
2. 创建/更新相片或头像的 mutation 接收 `temp_id`。
3. Instance 中的 `preparePhoto` / `prepareAvatar`：
   - 按 `max_image_dimension` 归一化原图；
   - 生成 AVIF 缩略图；
   - 原图写入 `stored-images/source`，缩略图写入 `stored-images/thumb`；
   - 删除 temp 文件。
4. 数据写入成功后才切换内存快照；失败时清理新图片。
5. 被替换或删除的图片，如果没有其他引用，会被 GC 清理。`adminCleanUnusedImages` 可以手动全量清理。

## 数据存储

```text
<STORAGE_PATH>/
├── pool.json                 # schema_version / next_id
├── members.json
├── galleries/<id>.json
├── instance-config.json
├── stored-images/
│   ├── source/
│   ├── thumb/
│   └── temp/
└── lock
```

- 所有实体 id 都从全局 `next_id` 分配；`schema_version` 和 `next_id` 是 brand 类型。
- JSON 使用原子写（tmp + fsync + rename），写前保留 `.bak`。
- storage 启动时获取 lock；同一 storage 只允许一个进程写入。
- 启动时校验 schema、引用关系、重复 id 和 `next_id`。
- 内存中是 Immutable 结构；每次 mutation 生成新 pool，写入成功后才替换。

## 测试

```bash
pnpm test
pnpm test:watch
```

测试使用临时 storage 目录，不需要 MySQL/Docker。覆盖：

- 时间边界、投稿唯一性、投票规则、全局 id 分配
- env/instance 配置校验与持久化
- dispatch、鉴权、`__admin_list`
- storage 重启、lock、图片静态服务、缩略图刷新、清理
- 图片上传、替换、删除
- 成员/相册/相片/投稿/投票流程

## 构建与运行

```bash
pnpm typecheck
pnpm lint
pnpm build
APP_ENV=production node --env-file=.env.production dist/index.js
```

## Docker

```bash
cp .env.example .env.production
# 填写真实 ADMIN_PASSWORD / JWT_SECRET / PUBLIC_BASE_URL
docker compose up -d --build
```

数据位于命名卷 `torzo-data`。容器内 `STORAGE_PATH=/data`。单实例写入，不要给同一卷启多个 replica。

## 当前限制

- 与旧 `/server` API 不兼容；`/web` 尚未接入。
- 单实例 storage；不能多进程同时写。
- 没有旧 MySQL 数据导入脚本；旧数据迁移需要在接入客户端前单独处理。
- `adminStatistic` 目前只统计数量，不统计磁盘占用。
