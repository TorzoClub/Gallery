# 登录与权限

## 页面与接口的区别

- 后台入口：Behind 页 Navigator 上的“A”按钮换台到 `/admin`；`/admin` 总是先显示门禁，有没有本地 token 都一样。production 由 Hono 的 SPA fallback 返回 `index.html`；development 由同进程 Vite middleware 返回。
- 登录接口是 API：`POST /auth/login`；门禁核对本地 token 用 `GET /auth/check`。

两者路径不同，避免 API 请求和 SPA 页面路由互相冲突。

## 登录流程

### 1. 输入密码

`/admin` 门禁的密码输入只接受 `ADMIN_PASSWORD`。门禁通过前前端不读任何后台数据（核对 token 的 `/auth/check` 不返回数据）。密码由服务端环境变量提供，不存数据库，也不下发到浏览器。

```http
POST /auth/login
Content-Type: application/json

{ "password": "your-password" }
```

成功：

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

失败：

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "密码错误"
}
```

### 1.5 已有 token 时的核对

本地已存 token 时，门禁不直接放行，先核对：

```http
GET /auth/check
Authorization: Bearer <token>
```

- 通过：`200 { "success": true, "data": { "ok": true } }`，门禁显示 `IS LOGINED` 后进入管理界面。
- 过期：`401 UNAUTHORIZED`（`Token 已过期`），门禁显示 `EXPIRED TOKEN`、报警、清 token。
- 无效（签名不对、不是 JWT、`role` 不是 admin）：`403 FORBIDDEN`，门禁显示 `INVALID TOKEN`、报警、清 token。
- 网络错误等其他情况：门禁显示 `ACCESS DENIED`，token 保留，可以直接输入密码。

`/auth/check` 和 admin dispatch 用同一个鉴权 middleware，结论一致。

### 2. 保存 token

前端把 token 存在 `localStorage`，键名由管理端客户端统一管理。请求 admin API 时发送：

```http
Authorization: Bearer <token>
```

### 3. 访问 admin query/mutation

```http
POST /admin/query/adminFetchPool
Authorization: Bearer <token>
Content-Type: application/json

{ "payload": {} }
```

只有 admin action 能从 `/admin/query/*`、`/admin/mutate/*` 调用。公开路由调用 admin action 会返回 `403`。

Admin SSE `/admin/events/pool` 同样需要：

```http
Authorization: Bearer <token>
```

Admin 前端通过 `fetch` 读取 SSE 流，而不是 `EventSource`，因此 token 不会出现在 URL 或访问日志中。连接返回 401/403 时只断开、不重连，也不跳转；登录失效统一由门禁处理：下一次普通后台请求收到 401/403 时回到门禁，显示 INVALID TOKEN / EXPIRED TOKEN。

### 4. 过期与登出

- token 是 HS256 JWT，包含 `role: "admin"` 和 `exp`。
- 默认有效期 12 小时，由 `JWT_EXPIRES_IN_SECONDS` 控制。
- 过期返回 `401 UNAUTHORIZED`；签名错误、格式错误或 `role` 不是 admin 返回 `403 FORBIDDEN`；没带 token 返回 `401`。
- 前端收到 401 或 token 类 403 时清理 token，丢掉已读到的后台数据，`/admin` 回到门禁并报警，屏上显示 `EXPIRED TOKEN`（401）或 `INVALID TOKEN`（403）。
- 登出只清理本地 token，不需要服务端接口。
- 修改 `JWT_SECRET` 会让所有已有 token 立即失效。

## 安全说明

- `ADMIN_PASSWORD` 和 `JWT_SECRET` 只放服务端环境变量，不能放进 `VITE_`。
- production 要求 `JWT_SECRET` 至少 32 字符。
- token 存在 `localStorage`，因此后台页面必须避免 XSS；不要把不可信 HTML 注入页面。
- 登录接口没有单独的限流层，部署时应在反向代理或网关做速率限制。
- 没有刷新 token；过期后重新登录。

## curl 示例

```bash
TOKEN=$(curl -sS -X POST http://localhost:7001/auth/login \
  -H 'content-type: application/json' \
  -d '{"password":"your-password"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data.token))')

curl -X POST http://localhost:7001/admin/query/adminFetchPool \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"payload":{}}'
```

接口和 action 列表见 [api.md](api.md)。
