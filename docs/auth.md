# 登录与权限

## 页面与接口的区别

- 后台登录页是 SPA 路由：`GET /admin/login`，由 Hono 返回 `index.html`。
- 登录接口是 API：`POST /auth/login`。

两者路径不同，避免 Vite 开发代理把后台页面请求转发到 API。

## 登录流程

### 1. 输入密码

后台登录页只接受 `ADMIN_PASSWORD`。密码由服务端环境变量提供，不存数据库，也不下发到浏览器。

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

### 2. 保存 token

前端把 token 存在 `localStorage`，键名由管理端客户端统一管理。请求 admin API 时发送：

```http
Authorization: Bearer <token>
```

### 3. 访问 admin query/mutation

```http
POST /admin/query/adminStatistic
Authorization: Bearer <token>
Content-Type: application/json

{ "payload": {} }
```

只有 admin action 能从 `/admin/query/*`、`/admin/mutate/*` 调用。公开路由调用 admin action 会返回 `403`。

### 4. 过期与登出

- token 是 HS256 JWT，包含 `role: "admin"` 和 `exp`。
- 默认有效期 12 小时，由 `JWT_EXPIRES_IN_SECONDS` 控制。
- 过期、签名错误或格式错误返回 `401 UNAUTHORIZED`。
- 前端收到 401 时清理 token 并跳回 `/admin/login`。
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

curl -X POST http://localhost:7001/admin/query/adminStatistic \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"payload":{}}'
```

接口和 action 列表见 [api.md](api.md)。
