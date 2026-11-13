# 生产部署

本文覆盖从 GitHub Actions 构建镜像，到 Linux 服务器启动、nginx 反代、升级和回滚。环境变量细节见 [configure.md](configure.md)，图片处理见 [images.md](images.md)。

## 1. 镜像发布

GitHub Actions 在推送 `v*` tag 时执行：

1. `docker build --target check .`
2. 构建 `runtime` target
3. 推送 `linux/amd64` 镜像到 GHCR

镜像地址：

```text
ghcr.io/torzoclub/gallery
```

tag 是 Git tag 去掉 `v` 前缀：

```text
v4.3.0 → ghcr.io/torzoclub/gallery:4.3.0
v4.3.0-deploy.20261108 → ghcr.io/torzoclub/gallery:4.3.0-deploy.20261108
```

稳定 tag 额外推 `latest`；带 `-` 的 tag 不推 `latest`。

### GHCR 权限

GHCR 包默认可能是私有。发布 workflow 不会修改包可见性；`GITHUB_TOKEN` 不能可靠地管理 package visibility，需要在 GitHub 包设置里手动处理。服务器需要二选一：

- 在 GitHub 包设置里把 `gallery` 设为 public
- 或准备一个带 `read:packages` 的 PAT：

```bash
echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

不要把 token 写进仓库或 `.env.production`。

## 2. 服务器要求

- Linux x86_64
- Docker Engine + Docker Compose v2
- 持久化磁盘
- nginx 或 Caddy 负责 HTTPS

服务器只需要拉镜像，不需要 Node、pnpm、libavif 或 Python。

## 3. 目录

建议：

```text
/srv/torzo/
├── compose.server.yaml
├── .env.production
└── storage/
```

`compose.server.yaml`：

```yaml
services:
  api:
    image: ghcr.io/torzoclub/gallery:${IMAGE_TAG:?set IMAGE_TAG}
    init: true
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - "7001:7001"
    volumes:
      - ${STORAGE_HOST_PATH:?set STORAGE_HOST_PATH}:/data
```

端口必须允许 nginx 容器访问。若 nginx 与 API 都在 Docker 中，也可以改成同一 Docker network，再用服务名访问。

## 4. `.env.production`

从模板复制并至少配置：

```dotenv
APP_ENV=production
STORAGE_PATH=/data

HTTP_HOSTNAME=0.0.0.0
HTTP_PORT=7001

ADMIN_PASSWORD=请替换为强密码
JWT_SECRET=请替换为至少32字符的随机字符串
JWT_EXPIRES_IN_SECONDS=43200

CORS_ORIGINS=https://gallery.example.com
API_BASE_PATH=/
PUBLIC_BASE_URL=https://gallery.example.com
HTTP_BODY_HARD_LIMIT_BYTES=67108864

ALLOW_EMPTY_DATA=false
```

注意：

- `PUBLIC_BASE_URL` 必须是浏览器实际访问的 origin，不要带路径或末尾斜杠。
- `STORAGE_PATH` 在容器内固定为 `/data`，由 bind mount 映射。
- `JWT_SECRET` 可以用 `openssl rand -hex 32` 生成。
- `VITE_*` 是构建时变量，修改后需要重新构建镜像。

## 5. 迁移 storage

从旧机器复制前，先停止旧 API，避免复制到一半：

```bash
rsync -av --exclude lock --exclude .DS_Store \
  storage-migrated/ user@server:/srv/torzo/storage/
```

容器内运行用户是 `node`，UID 1000：

```bash
sudo chown -R 1000:1000 /srv/torzo/storage
```

如果 storage 内有旧的 `lock`，在确认没有进程使用后删除：

```bash
sudo rm -f /srv/torzo/storage/lock
```

### 新空 storage

```bash
IMAGE_TAG=<image-tag> \
STORAGE_HOST_PATH=/srv/torzo/storage \
docker compose -f compose.server.yaml run --rm api \
  node dist/server/cli/init-storage.js
```

### 旧 schema

如果原 storage 是 v1：

```bash
IMAGE_TAG=<image-tag> \
STORAGE_HOST_PATH=/srv/torzo/storage \
docker compose -f compose.server.yaml run --rm api \
  node dist/server/cli/update-storage.js
```

升级前先备份 storage。当前版本使用 schema v2。

## 6. 启动

```bash
cd /srv/torzo

IMAGE_TAG=4.3.0 \
STORAGE_HOST_PATH=/srv/torzo/storage \
docker compose -f compose.server.yaml pull

IMAGE_TAG=4.3.0 \
STORAGE_HOST_PATH=/srv/torzo/storage \
docker compose -f compose.server.yaml up -d
```

检查：

```bash
docker compose -f compose.server.yaml ps
docker compose -f compose.server.yaml logs -f api
curl -fsS http://127.0.0.1:7001/healthz
```

健康检查返回：

```json
{"success":true,"data":{"status":"ok","scene":"production"}}
```

## 7. nginx

Cloudflare 或外层 TLS 终止后，origin nginx 可以只监听 80：

```nginx
server {
  listen 80;
  server_name gallery.example.com;

  client_max_body_size 64M;

  location / {
    proxy_pass http://127.0.0.1:7001;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 360s;
    proxy_send_timeout 360s;
  }

  location /events/pool {
    proxy_pass http://127.0.0.1:7001;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 360s;
    proxy_send_timeout 360s;
  }

  location /admin/events/pool {
    proxy_pass http://127.0.0.1:7001;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 360s;
    proxy_send_timeout 360s;
  }
}
```

如果 nginx 本身在 Docker 中，而 API 端口只绑定到宿主机，使用：

```nginx
proxy_pass http://host.docker.internal:7001;
```

并确保 nginx 容器有：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

SSE 必须关闭 buffering，图片上传/重建请求至少允许 360 秒。Cloudflare 的证书在 Cloudflare 侧配置，不要在 origin 重复修改证书。

## 8. 升级

先拉新镜像，再 recreate：

```bash
IMAGE_TAG=4.3.1 \
STORAGE_HOST_PATH=/srv/torzo/storage \
docker compose -f compose.server.yaml pull

IMAGE_TAG=4.3.1 \
STORAGE_HOST_PATH=/srv/torzo/storage \
docker compose -f compose.server.yaml up -d
```

升级前备份：

```bash
docker compose -f compose.server.yaml stop api
tar -czf /srv/torzo/storage-backup-$(date +%F-%H%M).tar.gz -C /srv/torzo storage
docker compose -f compose.server.yaml start api
```

不要把存储放在临时目录，也不要执行 `docker compose down -v`。

## 9. 回滚

镜像 tag 是 immutable 的，直接回到旧 tag：

```bash
IMAGE_TAG=旧版本 \
STORAGE_HOST_PATH=/srv/torzo/storage \
docker compose -f compose.server.yaml up -d
```

如果回滚涉及 storage schema，必须先恢复对应备份；不要用新版本 storage 启动旧版本应用。

## 10. 验收

- `docker compose ps` 显示 healthy
- `/healthz` 返回 `scene: production`
- `/explore`、`/admin` 返回 200
- `/images/...` 返回正确 Content-Type 和 Content-Length
- 图片 URL 使用配置的 `PUBLIC_BASE_URL`
- 后台可以登录并读取完整 AdminPool
- SSE 不被 nginx buffering
- 重启服务器后容器自动恢复（`restart: unless-stopped`）
