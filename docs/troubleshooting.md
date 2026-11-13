# 常见问题

本文覆盖根目录单体应用的排查。旧 `server/`、`web/` 已从当前分支移除，归档在 [`legacy-v3`](https://github.com/TorzoClub/Gallery/tree/legacy-v3) 分支，不在本文维护。

## Node 版本不对

```bash
node -v
```

要求 Node.js >= 26.13.0：

```bash
nvm use
nvm install 26.13.0
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

pnpm 12 的 `pnpm-lock.yaml` 是双 YAML 文档（第一段记录项目固定的 pnpm 版本），pnpm 10 无法读取。先确认 `pnpm --version` 为 12.18.0；如果还是旧版，升级 pnpm 后重新运行 `pnpm install`。

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

Vite middleware 和 production 的 Hono SPA fallback 都应在同一个端口处理 `/admin` 和 `/behind`。如果出现 API 404，检查请求是否错误地进入了 API 路由；这些 SPA 路径不是 API。

## 登录页打不开或登录 404

- 后台入口：`GET /admin`（SPA），每次进来先是门禁：已登录过会核对 token 后显示 `IS LOGINED` 自动进入，token 无效或过期时报警并要求重新输入密码。Behind 页 Navigator 上的“A”按钮也会换台到这里。
- 登录接口：`POST /auth/login`（API）。

不要把页面和接口混成同一个 POST 路径。`/auth/login` 是 API；后台页面由 SPA fallback 提供。

## 图片 URL 指向 localhost 或与当前访问地址不一致

现象：通过局域网 IP、容器地址或域名访问站点，但 API 返回的图片地址是：

```text
http://localhost:7001/images/thumb/...
```

原因：服务端使用 `PUBLIC_BASE_URL` 生成绝对图片 URL。它不控制监听地址；如果仍是默认值 `http://localhost:7001`，浏览器就会去访问访问者自己的 localhost。

检查环境配置：

```dotenv
HTTP_HOSTNAME=0.0.0.0
HTTP_PORT=7001
PUBLIC_BASE_URL=http://<浏览器实际访问的地址>:7001
```

- `PUBLIC_BASE_URL` 必须是**浏览器实际访问的 origin**，包含协议、域名/IP 和端口。
- 使用反向代理或 HTTPS 时，填外部地址，例如 `https://gallery.example.com`。
- 它应该是纯 origin，不要带 API 路径或多余路径。
- `HTTP_HOSTNAME` 只控制监听地址，不能代替 `PUBLIC_BASE_URL`。
- 环境变量在进程启动时读取，修改后必须重启服务进程；仅刷新页面无效。
- Docker 部署需要更新 compose 环境并重新创建容器。

验证：

```bash
curl http://127.0.0.1:7001/healthz
```

然后检查后台 API 响应中的 `avatar_thumb_url`、`thumb_url`、`optimized_url` 是否使用当前访问 origin。也可以在浏览器 Network 面板确认图片请求不再指向 localhost。

`PUBLIC_BASE_URL` 与实际访问地址不一致时，图片和头像会加载到错误的 origin；这不是前端缓存问题，不要靠清理浏览器缓存解决。相关配置说明见 [configure.md](configure.md#监听地址与公开-url)。

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

- `/`、`/admin` 和 `/behind`：`no-cache`
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

- 前端请求的是 `/images/optimized/` 下的 `-sdr.avif` 和无后缀 thumb。
- 旧相片或缺失衍生图会直接 404，不回退原图。
- 在后台执行“重新生成图片”，会重建相片的 SDR optimized/thumb 和成员头像 thumb；旧命名文件及旧的 HDR AVIF 会被清理。
- 旧 storage 中可能残留 `.jpg`/无变体文件；执行一次重建即可转换为 `.avif` 命名。
- HDR source 会额外生成 `-hdr.avif`；10-bit SDR 不会。详情在支持 HDR 的显示环境失败会自动回退 SDR。HDR/HEIC 工具缺失时查看 Docker 镜像是否包含 `avifenc` / `avifdec` / `avifgainmaputil`、`pillow_heif`、`exiftool` 和 `apple-hdr-heic-decoder`，详见 [images.md#hdr](images.md#hdr)。
- 修改 instance 配置后，派生图 URL 的 `?v` 会变化；如果仍看到旧图，刷新页面获取新 API 响应。

## instance 配置修改后没有生效

- 配置只影响**后续**上传和 optimized/缩略图生成，不会自动重做已有图片。
- 保存成功后刷新页面确认值。
- 需要重建已有图片时，在后台使用“重新生成图片”操作。
- `max_upload_bytes` 不能超过 `HTTP_BODY_HARD_LIMIT_BYTES`，否则服务端返回 400。

## 图片处理排队

同一时刻只允许一个图片转换任务执行。连续投稿多张相片、或同时点多个后台“重新生成图片”时，后面的请求会等待前面的 SDR/HDR/缩略图生成完成，而不是并行抢内存。

- 前端图片相关请求的等待上限是 360 秒；nginx 也要把 `proxy_read_timeout` / `proxy_send_timeout` 放宽到至少 360 秒。
- 客户端超时或关闭页面不会取消已经排队/执行中的服务端任务；图片可能仍在后台继续生成。
- `/upload-image` 本身不排队，图片转换排队时仍可以继续上传临时文件。

## storage lock 冲突

同一 `STORAGE_PATH` 只允许一个 API 进程写入。看到 lock 相关错误时：

```bash
lsof -nP -iTCP:${HTTP_PORT:-7001} -sTCP:LISTEN
```

确认是否已有进程在运行。不要手动删除正在使用中的 lock；先停止旧进程。异常退出后的 stale lock 由服务端按 hostname、PID 和进程启动时间判断；容器重建或 PID 复用时会自动清理。

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

## 横长图在瀑布流里是竖着的

这是有意的：宽 ÷ 高 ≥ 2 的相片在拍立得里顺时针转 90° 竖着贴，点开大图会恢复横向。图片文件和 storage 都没有变。

如果横长图出现空隙、重叠，或者图片没填满相片区域，通常是有代码绕过了 `photoCardCover()`，自己用 `photo.height / photo.width` 算了相片高度。约束见 [designs.md](designs.md) 的“横长图竖贴的实现约束”和 [images.md](images.md)。

## 描述很长的卡片几乎是正的

也是有意的：倾角按整张卡片的高宽比收正，描述把写字区撑高后卡片变竖长，就会接近摆正。见 [images.md](images.md)“越竖长越摆正”。

## 上传返回“图片太长了”

按当前配置生成的缩略图或大图有一边会超过 AVIF 的 16384px 上限。把图裁短，或在后台调小相片缩略图尺寸后再传。见 [images.md](images.md)“AVIF 每边 16384 的上限”。


## 连续打开多个页面后请求阻塞

公开页每个标签都会建立一条 `/events/pool` 长连接，Admin 也会建立 `/admin/events/pool`。浏览器对同一个 origin 的 HTTP/1.1 并发连接通常只有 6 条；短时间打开多个标签时，旧的后台标签如果不释放连接，新页面的 `fetchClientPool` 或静态资源就会排队。

公开页（EventSource）和 Admin（fetch 流）都会在 `document.visibilityState === 'hidden'` 时主动关闭 SSE 连接，回到前台再重连；排查这个问题时先确认标签页的前后台状态，再看 DevTools 的 EventStream/网络请求。


## 打开超过 5 个页面

同装摄影集会在启动时用 Web Locks 占一个页面槽位：每个顶层页面持有一个 `__app_tab__:<uuid>` 锁，浏览器在页面销毁时自动释放。超过 5 个槽位时，新页面只显示“页面开得太多了”，不会挂载应用或建立 SSE，并每秒重试占位；关闭其他标签页、空出槽位后会自动进入。iframe 不单独占槽，由顶层窗口负责计数。


### HEIC / HEIF

- Chrome 预览 HEIC 会失败，这是浏览器限制；表单会显示“提交后显示缩略图”，提交后服务端用 `pillow_heif` 生成 SDR thumb。
- 服务端没有 `pillow_heif` / `exiftool` / `apple-hdr-heic-decoder` 时，HEIC 无法读取；用 Docker 镜像，或在宿主机安装对应工具。
- 只有带 Apple HDR gain map 的 HEIC 会生成 HDR；普通 HEIC 只生成 SDR。
- 如果日志出现 `Only 8-bit monochrome auxiliary images are currently supported`，说明 `pillow_heif` 太旧；升级到 `>=1.8` 后重建图片。

## 容器 unhealthy、根分区 100%、TimeoutOverflowWarning

现象：

- `docker ps` 显示容器 `unhealthy`
- 健康检查输出 `no space left on device`
- 应用日志反复出现：

```text
TimeoutOverflowWarning: 3290286769 does not fit into a 32-bit signed integer.
Timeout duration was set to 1.
```

根因是 `setTimeout` 的延迟超过 Node.js 的 32 位上限（约 24.8 天）。服务端在计算下一个 gallery 边界时，如果距离边界超过这个上限，Node 会把定时器压到 1ms，回调立即重算并再次设置超长定时器，形成日志和事件循环风暴，最终写满磁盘并让 Docker 健康检查无法创建进程。

当前实现已将边界定时器限制在 `2_147_483_647` ms；到达上限后重新计算剩余时间，不会再把超长延迟传给 `setTimeout`。

立即恢复步骤：

```bash
# 1. 停止应用，避免继续写日志
docker compose -f /server/gallery-v4/compose.server.yaml stop api

# 2. 找到并清空应用容器日志
docker inspect gallery-v4-api-1 --format '{{.LogPath}}'
: > /var/lib/docker/containers/<container-id>/<container-id>-json.log

# 3. 确认磁盘释放
df -h /

# 4. 拉取修复镜像后重新启动
cd /server/gallery-v4
docker compose -f compose.server.yaml pull
docker compose -f compose.server.yaml up -d
```

`compose.server.yaml` 已限制 Docker 日志为 `10m × 3`，避免单个容器日志再次无限增长。
