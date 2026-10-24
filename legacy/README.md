# Legacy

这里归档旧实现，**不参与构建、测试、lint、CI 或部署**。

- `server/`：旧 Egg.js 后端。
- `web/`：旧前端。
- `scripts/`：旧部署/通知脚本。
- `.github/workflows/`：旧 CI 配置，已不再运行。

当前应用入口是仓库根目录：

- 前端：`src/web/`
- 后端：`src/server/`
- 共享类型：`src/shared/`
- 测试：`test/`

不要再从 legacy 恢复或继续开发；需要参考旧行为时只读查看。
