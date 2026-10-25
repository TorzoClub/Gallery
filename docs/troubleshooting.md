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

开发环境也只有一个端口：

```text
http://<HTTP_HOSTNAME>:<HTTP_PORT>
```

- `/query`、`/mutate`、`/admin/query`、`/admin/mutate`、`/auth`、`/upload-image`、`/images`、`/healthz` 由 Hono 处理。
- 页面、`/@vite/client`、`/src/*` 等由同进程 Vite middleware 处理。
- `.env.development` 的 `VITE_API_PREFIX=/`。

先直接请求：

```bash
curl http://127.0.0.1:7001/healthz
```

如果页面打不开，确认只启动了一个 `pnpm dev`，且没有旧的独立 Vite 端口进程。

## 刷新后台深层路由 404

生产模式由 Hono 做 SPA fallback。如果使用额外反向代理，直接转发到 Hono 即可，不要自己加 `try_files` 到不存在的静态目录。

Vite middleware 和 production 的 Hono SPA fallback 都应在同一个端口处理 `/admin/dashboard`。如果出现 API 404，检查请求是否错误地进入了 API 路由；`/admin/login`、`/admin/dashboard` 不是 API 路径。

## 登录页打不开或登录 404

- 后台登录页：`GET /admin/login`（SPA）。
- 登录接口：`POST /auth/login`（API）。

不要把两者混成 `/admin/login` 的 POST。`/auth/login` 是 API，`/admin/login` 是 SPA 页面。

## 静态资源缓存不对

生产构建后检查：

```bash
ls dist/client/assets
curl -I http://127.0.0.1:7001/
curl -I http://127.0.0.1:7001/assets/<hash>.js
curl -I http://127.0.0.1:7001/images/source/<file>
curl -I http://127.0.0.1:7001/images/optimized/<file>
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

## 大图 404 / optimized 不存在

- 前端请求的是 `/images/optimized/` 下的 `-sdr.avif` 或 `-hdr.avif` 变体，不修改扩展名。
- 系统 HDR 检测只读取一次；切换显示器或系统 HDR 开关后需要刷新页面。
- 旧相片或缺失衍生图会直接 404，不回退原图。
- 在后台执行“重新生成图片”，会按 `is_hdr` 重建相片的 SDR/HDR optimized 和 thumb，并重建成员头像 thumb；相片旧命名文件会被清理。
- 旧 storage 中可能残留 `.jpg`/无变体文件；执行一次重建即可转换为 `.avif` 命名。
- HDR 图片按输入位深使用 10/12-bit HDR optimized AVIF，同时有 8-bit SDR 版本；HDR 变体缺失时不会回退 SDR。
- 修改 instance 配置后，派生图 URL 的 `?v` 会变化；如果仍看到旧图，刷新页面获取新 API 响应。

## instance 配置修改后没有生效

- 配置只影响**后续**上传和 optimized/缩略图生成，不会自动重做已有图片。
- 保存成功后刷新页面确认值。
- 需要重建已有图片时，在后台使用“重新生成图片”操作。
- `max_upload_bytes` 不能超过 `HTTP_BODY_HARD_LIMIT_BYTES`，否则服务端返回 400。

## storage lock 冲突

同一 `STORAGE_PATH` 只允许一个 API 进程写入。看到 lock 相关错误时：

```bash
lsof -nP -iTCP:${HTTP_PORT:-7001} -sTCP:LISTEN
```

确认是否已有进程在运行。不要手动删除正在使用中的 lock；先停止旧进程。异常退出后的 stale lock 由服务端按 PID 检测处理。

## 端口被占用

```bash
lsof -nP -iTCP:${HTTP_PORT:-7001} -sTCP:LISTEN
```

只改 `HTTP_PORT`；development 和 production 都使用这一个端口。不要再启动第二个 Vite 端口。

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
