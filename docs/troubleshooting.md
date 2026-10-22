# 常见问题

本文只覆盖 `web/` 前端侧的排查。server 内部问题不在本文范围。

## Node 版本不对

先确认版本：

```bash
node -v
```

项目要求 Node.js >= 24.22.1。使用 nvm：

```bash
cd web
nvm use
```

如果 `nvm use` 找不到版本：

```bash
nvm install 24.22.1
nvm use 24.22.1
```

## pnpm install 失败

先检查代理和 registry。`web/.npmrc` 是本机配置，不应提交：

```ini
registry=https://registry.npmjs.org/
proxy=socks5://127.0.0.1:503
http-proxy=socks5://127.0.0.1:503
https-proxy=socks5://127.0.0.1:503
```

代理端口不可用时，先确认本机代理在运行，或临时移除代理配置。不要把带代理的 `.npmrc` 提交到仓库。

## API 请求失败

检查 `VITE_API_PREFIX`：

- 开发环境默认是 `http://localhost:7001/`；
- 生产环境默认是 `/torzo-gallery-server/`；
- 路径末尾需要 `/`，客户端会自动补齐，但不要混用两个不同来源；
- 修改 `.env.local` 后重启开发服务器。

先用浏览器 Network 面板确认请求地址和响应状态，再判断是前端配置还是后端问题。server 的接口和配置不在本文范围。

## 刷新后台深层路由 404

项目使用 `BrowserRouter`。直接访问 `/admin/gallery/1/photo/list` 这类深层路由时，静态服务器必须回退到 `index.html`。

Nginx 通用配置：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

子路径部署时，回退到对应的 `index.html`，并确认 `VITE_BASE_PATH` 已正确设置。

## 端口被占用

默认开发端口是 3000。查看占用：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

换端口启动：

```bash
pnpm dev --port 3001
```

如果旧进程仍在运行，先确认它是不是你自己的开发服务器，再决定是否停止。

## 环境变量修改后不生效

Vite 在启动时读取环境变量。修改 `.env`、`.env.local` 或 `.env.*` 后需要重启 `pnpm dev`。

## 构建正常但页面资源 404

检查：

- `VITE_BASE_PATH` 是否和实际部署路径一致；
- 静态服务器是否正确提供 `web/dist/assets/`；
- 是否配置了 SPA fallback。

更完整的配置说明见 [configure.md](configure.md)。
