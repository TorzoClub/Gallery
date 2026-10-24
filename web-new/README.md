# Torzo Gallery Web New

基于现有 `web/` 前端迁移出的新客户端，对接 [api/](../api/README.md) 的 dispatch API。

## 与 `web/` 的差异

- 所有请求改为 `POST /query/:name`、`POST /mutate/:name`，后台使用 `/admin/query`、`/admin/mutate`。
- 后台登录使用 `{ password }`，请求头使用 `Authorization: Bearer <token>`。
- 图片上传改为两步：先 `POST /upload-image` 拿到 `temp_id`，再在创建/更新相片或成员时提交 `temp_id`。
- 图片 URL 直接使用新 API 返回的 `src_url` / `thumb_url`；缩略图已经是 AVIF。
- 后台统计改为相片、相册、投票、成员数量。
- 缩略图重建使用 `adminRefreshThumb`（相片）和 `adminRefreshAvatar`（头像）。

## 开发

```bash
cd web-new
nvm use
pnpm install
pnpm dev
```

默认打开 `http://localhost:3000`，请求 `http://localhost:7001/` 的新 API。先按 [api/README.md](../api/README.md) 启动 API。

`VITE_API_PREFIX`、`VITE_BASE_PATH`、`VITE_CACHE_WORKER_URL`、`VITE_BUILD_DESCRIPTION` 的含义与 `web/` 相同，见 [docs/configure.md](../docs/configure.md)。

## Scripts

| 命令 | 作用 |
|---|---|
| `pnpm dev` | Vite 开发服务器 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm lint` | ESLint |
| `pnpm build` | 类型检查 + 构建 |
| `pnpm build:only` | 跳过类型检查直接构建 |
| `pnpm preview` | 预览构建产物 |
