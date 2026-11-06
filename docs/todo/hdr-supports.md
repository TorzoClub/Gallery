# HDR 图片支持

> 状态：Phase 1（HDR AVIF）已实施。
> 本文记录一次性技术方案和当前实现，不属于用户 API 文档。

## 目标

- `thumb` 只生成 SDR AVIF，文件名不带 `-sdr`。
- `optimized` 始终生成 SDR AVIF；HDR source 额外生成 HDR AVIF。
- HDR 输出带正确 CICP，不把线性 scRGB 数据标成 sRGB ICC。
- SDR / HDR 分别使用独立文件，通过 API 字段选择。

## 文件命名

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

`PhotoDTO` 的字段：

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

## 判定与编码矩阵

| source | thumb | optimized SDR | optimized HDR |
|---|---|---|---|
| SDR | sharp SDR | sharp 8-bit | 不生成 |
| JPEG gain map | sharp SDR base | sharp 8-bit | `avifgainmaputil convert --swap-base --ignore-profile` 得到 HDR base，10-bit CICP |
| AVIF gain map | sharp SDR | sharp 8-bit | `avifgainmaputil swapbase` 得到 HDR base，10-bit CICP |
| AVIF 10/12-bit + CICP | sharp SDR | sharp 8-bit | `avifdec --depth 16`，缩放后 10-bit CICP |
| PNG 16-bit + cICP | sharp SDR | sharp 8-bit | `avifenc` 10-bit CICP |
| 无 CICP 的 16-bit / 10-bit SDR | sharp SDR | sharp 8-bit | 不生成，不猜 HDR |

HDR 判定只认：

- AVIF 主图的 CICP transfer = 16（PQ）或 18（HLG）
- PNG `cICP` chunk 的 transfer = 16 或 18
- JPEG/AVIF 的 gain map

任何 >8-bit 但 transfer 不是 PQ/HLG 的图都按 SDR 处理。

## 编码流程

实现位于 `src/server/storage/hdr.ts`：

1. `detectHdrSource()` 读取 sharp metadata、PNG `cICP`、`avifdec --info`，或转换 gain map。
2. JPEG gain map 使用 `avifgainmaputil convert --swap-base --ignore-profile`，AVIF gain map 使用 `avifgainmaputil swapbase`，得到纯 HDR base。
3. `avifdec --depth 16 --sato` 解出 16-bit PNG（PNG source 直接使用）。
4. sharp 以 `rgb16` pipeline 缩放，输出 16-bit PNG；不转 sRGB、不 flatten。
5. `avifenc --depth 10 --cicp P/T/M --range ... --ignore-icc` 输出 HDR AVIF。
6. 成功后才 rename 到 `optimized/...-hdr.avif`。

失败策略：

- HDR 是 SDR 之外的附加产物，失败不阻止 SDR 保存。
- 重建失败保留旧 HDR 文件。
- 缺少 `avifenc` / `avifdec` / `avifgainmaputil` 时，开发环境告警并降级 SDR；production 启动 fail-fast。
- HDR 文件丢失或损坏时，详情加载失败自动回退 SDR。

## 前端

- `has_hdr_optimized` 且 `(dynamic-range: high)` 匹配时，详情使用 `src_optimized_hdr`。
- HDR 下载/解码失败自动换 `src_optimized`，不把查看器停在失败态。
- 瀑布流只使用 SDR `thumb`。
- 不做 HDR thumb。

## Docker

HDR 工具固定为 libavif `1.4.2` + libaom `3.14.1`：

- `avifenc`
- `avifdec`
- `avifgainmaputil`

Dockerfile 的 `libavif` 阶段构建三件套；`dev` / `check` / `runtime` 都从带工具的 base 派生。开发、测试、生产统一使用 Docker，不依赖宿主机 libavif 版本。

## 测试

- PNG cICP / `avifdec --info` CICP 解析。
- PQ/HLG 判定；SDR 10-bit 不误判。
- 16-bit 无 cICP 不生成 HDR。
- HDR PNG → 10-bit HDR AVIF，CICP 正确。
- 重新生成图片更新 `has_hdr_optimized`。
- HDR 文件缺失/损坏回退 SDR。
- Docker check 通过。
- HDR 手机/显示器对比 source / `-hdr.avif` / `-sdr.avif`。

## 迁移

不需要 storage schema 迁移。已有相片需要在后台执行一次“重新生成图片”，才会生成 HDR 并更新 `has_hdr_optimized`。
