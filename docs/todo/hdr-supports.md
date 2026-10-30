# HDR 图片支持计划

> 状态：Phase 0（SDR-only 回退）已完成；Phase 1（HDR AVIF）待实施。
> 本文是一次性技术方案记录，不属于用户 API 文档。

## 目标

- `thumb` 只生成 SDR AVIF，文件名不带 `-sdr`。
- `optimized` 始终生成 SDR AVIF；HDR source 额外生成 HDR AVIF。
- HDR 输出必须带正确的 CICP，不再出现线性 scRGB 数据被标成 sRGB ICC 的过曝。
- SDR / HDR 分别使用独立文件，通过 API 字段选择。

## 最终文件命名

```text
source/photo-<gallery>-<photo>-<crc32>.<format>

thumb/photo-<gallery>-<photo>-<crc32>.avif

optimized/photo-<gallery>-<photo>-<crc32>-sdr.avif
optimized/photo-<gallery>-<photo>-<crc32>-hdr.avif
```

头像保留 CRC：

```text
source/avatar-<member-id>-<crc32>.<format>
thumb/avatar-<member-id>-<crc32>.avif
```

头像 thumb 内容为 SDR AVIF；source 保留原始字节和格式。

## API

```ts
type PhotoDTO = {
  // ...
  has_hdr_optimized: boolean
  src_optimized: string
  src_optimized_hdr: string | null
  thumb: string
  thumb_url: string
}
```

- `has_hdr_optimized` 表示磁盘上确实存在 HDR optimized 文件。
- `src_optimized` 指向 `-sdr.avif`。
- `src_optimized_hdr` 指向 `-hdr.avif`，没有时为 `null`。
- `thumb` / `thumb_url` 指向无后缀 SDR thumb。
- 派生图 URL 继续使用 `?v=<instance_hash>`。

## 为什么 sharp 不够

当前 `sharp 0.35.5` 使用 `libvips 8.18.7`：

- 能写 10/12-bit AVIF；
- 不能写 CICP/nclx；
- 不能把 gain map 写回 AVIF。

`withGainMap()` 得到的是线性 scRGB 数据，`keepIccProfile()` 保留 source 的 sRGB ICC；浏览器按 sRGB 解释线性数据，导致过曝。

相关上游信息：

- [sharp-libvips#247](https://github.com/lovell/sharp-libvips/issues/247)
- [libvips PR #4979 `scRGB2CICP`](https://github.com/libvips/libvips/pull/4979)
- `scRGB2CICP` 已合并，但仍是手动 operation，需要 libvips 8.19；sharp 未暴露该 operation。
- 当前最新 libvips release 仍是 8.18.7。

## Phase 0：SDR-only 回退

先移除所有 HDR 生成和使用逻辑，只保留：

```text
source 原图
thumb 无后缀 SDR AVIF
optimized -sdr.avif
```

- `has_hdr_optimized` 一律为 `false`。
- `src_optimized_hdr` 一律为 `null`。
- 前端不再请求 `-hdr`。
- 旧 thumb、旧头像 thumb、旧 HDR 文件在重建时清理。
- 现有 storage 需要执行一次全量“重新生成图片”。

## Phase 1：libavif HDR 管线

### 技术栈

- `sharp`：SDR optimized、SDR thumb、头像、基础探测。
- **libavif v1.4.2 CLI**：
  - `avifenc`
  - `avifdec`
  - `avifgainmaputil`
- libaom 3.14.1，启用 high-bit-depth。
- libxml2（JPEG gain map 转换需要）。
- 构建参数：
  - `-DAVIF_CODEC_AOM=LOCAL`
  - `-DAVIF_BUILD_APPS=ON`
  - `-DAVIF_LIBXML2=SYSTEM`
  - 固定版本，不依赖系统包版本。

### 编码矩阵

| source | thumb | optimized SDR | optimized HDR |
|---|---|---|---|
| SDR | sharp SDR | sharp 8-bit | 不生成 |
| JPEG gain map | sharp SDR base | sharp 8-bit | libavif 转 HDR base，10-bit CICP |
| AVIF 10/12-bit + CICP | sharp SDR | sharp 8-bit | libavif 重编码 10-bit CICP |
| PNG 16-bit + cICP | sharp SDR | sharp 8-bit | libavif 编码 |
| 无 CICP 的 16-bit | sharp SDR | sharp 8-bit | 明确失败，不猜 HDR |

HEIC 由前端 `heic-convert` 转 JPEG 后按普通 source 处理；如果转换结果带有 gain map，则走 HDR 管线。

### HDR 输出

- `-hdr.avif` 为纯 HDR base，不把 gain map 作为最终文件形式。
- JPEG gain map：
  1. `avifgainmaputil convert --swap-base` 得到 HDR base；
  2. `avifdec --depth 16` 得到带 CICP 的 PNG；
  3. 如需缩放，用 sharp 处理 16-bit PNG；
  4. `avifenc --depth 10 --cicp ...` 输出 HDR AVIF。
- AVIF HDR：`avifdec --depth 16` + `avifenc --depth 10 --cicp`。
- PNG HDR：`avifenc --depth 10 --cicp`。
- 编码失败不能产生半成品；重建失败保留旧文件。

### 前端

- `has_hdr_optimized` 且系统 HDR：详情使用 `src_optimized_hdr`。
- 加载失败回退 `src_optimized`。
- 瀑布流只使用 SDR `thumb`。
- 不做 HDR thumb。

## Docker-first 环境

Phase 1 统一使用 Docker：

- 单一多阶段 `Dockerfile`：
  - `base`：Node 24 + pnpm + libavif/libaom 工具；
  - `deps`；
  - `dev`：本地开发；
  - `check`：typecheck / lint / test / build；
  - `runtime`：生产。
- `compose.dev.yaml`：
  - source bind mount；
  - `/app/node_modules` 命名卷；
  - storage 卷；
  - 端口 7001；
  - `.env.development`；
  - Vite HMR / tsx watch。
- CI 在 Docker 内执行 check，不依赖 runner 的 host Node/libavif。
- 本地开发只需要 Docker，不要求 host Node/pnpm/libavif。
- 生产镜像包含 libavif 三件套。

## 测试

- JPEG gain map fixture → HDR AVIF，CICP 正确，视觉不过曝。
- AVIF HDR → HDR AVIF。
- SDR 10-bit 不误判为 HDR。
- 无 CICP HDR 源明确失败。
- HDR 文件缺失/损坏回退 SDR。
- 旧文件清理、API 字段、缓存版本。
- Docker check 通过。
- HDR 手机对比 source / `-hdr.avif` / `-sdr.avif`。

## 风险与边界

- libavif 外部二进制增加构建和部署复杂度；Phase 1 用 Docker 统一环境。
- HDR 输出是否被具体浏览器正确显示取决于浏览器 AVIF/CICP 支持；前端保留 SDR 回退。
- 当前 `has_hdr_optimized` 语义只表示文件存在，不表示浏览器一定支持。
- 不实现 AVIF gain map 作为最终 HDR 文件；SDR/HDR 继续分开。
