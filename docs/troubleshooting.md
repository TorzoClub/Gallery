# 常见问题

本文覆盖根目录单体应用的排查。旧 `server/`、`web/` 已归档到 `legacy/`，不在本文维护。

## Node 版本不对

```bash
node -v
```

要求 Node.js >= 24.22.1：

```bash
nvm use
nvm install 24.22.1
```

## pnpm install 失败

先检查代理和 registry。根 `.npmrc` 是本机配置，不应提交：

```ini
registry=https://registry.npmjs.org/
proxy=socks5://127.0.0.1:503
http-proxy=socks5://127.0.0.1:503
https-proxy=socks5://127.0.0.1:503
```

代理端口不可用时，先确认本机代理在运行，或临时移除代理配置。

## API 请求失败

开发环境：

- Vite 在 `http://localhost:3000`。
- API 在 `http://127.0.0.1:7001`。
- Vite 代理 `/query`、`/mutate`、`/admin/query`、`/admin/mutate`、`/auth`、`/upload-image`、`/images`、`/healthz`。
- `.env.development` 的 `VITE_API_PREFIX=/`。

先直接请求 API：

```bash
curl http://127.0.0.1:7001/healthz
```

如果 API 正常但页面请求失败，检查 Vite 是否启动、代理目标端口是否和 `HTTP_PORT` 一致。浏览器 Network 面板里的请求路径应该是同源 `/query/...`，不是 `http://localhost:7001/...`。

## 刷新后台深层路由 404

生产模式由 Hono 做 SPA fallback。如果使用额外反向代理，直接转发到 Hono 即可，不要自己加 `try_files` 到不存在的静态目录。

本地 Vite 已处理 SPA 路由；如果直接访问 `/admin/dashboard` 出现 API 404，检查 Vite proxy 是否错误地代理了 `/admin` 整个前缀。项目只代理 `/admin/query` 和 `/admin/mutate`。

## 登录页打不开或登录 404

- 后台登录页：`GET /admin/login`（SPA）。
- 登录接口：`POST /auth/login`（API）。

不要把两者混成 `/admin/login` 的 POST。Vite 只把 `/auth` 代理给 API。

## 静态资源缓存不对

生产构建后检查：

```bash
ls dist/client/assets
curl -I http://127.0.0.1:7001/
curl -I http://127.0.0.1:7001/assets/<hash>.js
curl -I http://127.0.0.1:7001/images/source/<file>
```

预期：

- `/` 和 `/admin/dashboard`：`no-cache`
- `/assets/*`：`public, max-age=31536000, immutable`
- `/images/*`：`public, max-age=31536000, immutable`

如果 HTML 被强缓存，检查是否被额外 CDN/反向代理覆盖了 Hono 的 `Cache-Control`。

## 修改前端后还是旧页面

HTML 是 `no-cache`，正常情况下刷新会重新验证。若浏览器或 CDN 仍显示旧页面：

1. 确认请求的是新的 `index.html`；
2. 检查 CDN 是否缓存了 HTML；
3. 确认 `pnpm build` 后 `dist/client/assets` 出现了新的 hash 文件；
4. 生产进程是否重启到了新构建。

## 上传返回“临时图片不存在或已过期”

- `temp_id` 对应的临时文件默认只保留 24 小时。
- 创建相片/成员前不要等待太久。
- 上传失败或图片格式不一致时服务端会删除临时文件，需要重新上传。
- 检查原始文件扩展名：只允许字母数字，且必须和实际图片格式一致（`jpeg` 归一为 `jpg`）。

## 修改成员 QQ 号失败

QQ number 是成员身份的一部分，创建后不可修改。`adminUpdateMember` 不接受 `qq_num`；如果需要新 QQ，必须创建新成员。

## instance 配置修改后没有生效

- 配置只影响**后续**上传和缩略图生成，不会自动重做已有图片。
- 保存成功后刷新页面确认值。
- 需要重建已有图片时，在后台使用缩略图重建/刷新操作。
- `max_upload_bytes` 不能超过 `HTTP_BODY_HARD_LIMIT_BYTES`，否则服务端返回 400。

## storage lock 冲突

同一 `STORAGE_PATH` 只允许一个 API 进程写入。看到 lock 相关错误时：

```bash
lsof -nP -iTCP:7001 -sTCP:LISTEN
```

确认是否已有进程在运行。不要手动删除正在使用中的 lock；先停止旧进程。异常退出后的 stale lock 由服务端按 PID 检测处理。

## 端口被占用

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:7001 -sTCP:LISTEN
```

Vite 换端口：

```bash
pnpm exec vite --port 3001
```

API 换端口后同时更新 `.env.development` 的 `HTTP_PORT` 和 Vite 代理目标。

## 生产启动报“前端构建产物不存在”

生产模式要求 `dist/client/index.html` 存在：

```bash
pnpm build
pnpm start
```

如果使用 Docker，确认镜像构建阶段执行了 `pnpm build`，运行阶段复制了 `dist/client`。

## 环境变量修改后不生效

- 服务端 env 在进程启动时读取，需要重启 API。
- `VITE_` 变量在构建时读取，需要重新 `pnpm build:client`。
- instance 配置在运行期可改，保存后立即影响后续请求。

更多配置见 [configure.md](configure.md)。
