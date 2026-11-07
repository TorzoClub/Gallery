# 图片处理

一张相片从上传到贴上墙，前后端各管一段。这篇讲每一步为什么这样做，以及哪些地方改了会出问题。动效时间线、配置字段、接口细节分别以 [designs.md](designs.md)、[configure.md](configure.md)、[api.md](api.md) 为准，这里只引用、不重复。

## 总体思路

- 原图不动：`source` 保存上传时的原始字节，下载原图拿到的就是用户传上来的那个文件。后端所有处理只生成派生图，不回写原图。
- 后端只管“够清晰、能编码”：生成 `optimized`（查看大图用）和 `thumb`（瀑布流用）两种 SDR AVIF，规则是固定的几条尺寸公式，不理解版面。
- 前端只管“怎么摆”：拍立得的大小、倾角、横长图转 90° 竖贴、竖长卡片摆正，全部是前端按相片宽高和描述现场算出来的 CSS，不重新生成图片、不改 storage、不经过 canvas。
- 两边唯一的契约是 storage 里记录的 `width` / `height`（已按 EXIF 方向摆正）。前端判断横竖、估算卡片高度都只看它，不读 EXIF、不量图片文件。

```text
上传 /upload-image
  │  读尺寸（按 EXIF 摆正），检查生成的图会不会超过 AVIF 上限 → 超过返回 400
  ▼
temp/<uuidv7>.<format>
  │  投稿 / 保存时 prepare
  ▼
source/原图 ──► optimized/…-sdr.avif   长边 ≤ max_image_dimension，短边 ≥ 256
           └─► thumb/….avif          宽 = image_thumb_size，短边 ≥ 256
                │
                ▼  前端
            photoCardCover()   横长图（宽 ÷ 高 ≥ 2）→ 竖框，<img> 转 90°
            estimatePhotoCardHeight()   相片 + 写字区（头像、描述行数）
            getPhotoCardScatter()   大小、倾角（越竖长越正）、位移、防碰撞
```

## 后端：派生图

代码在 `src/server/storage/image.ts`（尺寸公式、sharp 调用）和 `src/server/instance/prepare-photo.ts`（上传、生成、清理）。

### 全局串行

所有真正的图片转换共享一个实例级 `vait` `Sequence` 队列：同一时刻只处理一张照片/头像，而不是只保证单张照片内部串行。排队范围包括：

- 投稿、后台新增/替换照片的 `prepareImage`
- 后台“重新生成图片”的 `refreshThumb`
- 头像的 `prepareAvatar` / `refreshAvatar`

`/upload-image` 的 `storeTempImage` 只接收文件、写 temp、读 metadata，不做完整解码和 resize，因此不进入这个队列；它在图片转换排队时仍可继续接收上传。

这样在低内存虚拟主机上不会出现多张 HEIC/HDR 同时解码、缩放和 avifenc 编码造成的内存峰值。代价是不同照片的转换会按 FIFO 排队，后来的请求需要等待前面的任务完成。

### 尺寸规则

| 派生图 | 基本规则 | 短边下限 | 放大 |
|---|---|---|---|
| 相片 thumb | 宽 = `image_thumb_size`（默认 640） | 256 | 不放大 |
| 相片 optimized | 长边 ≤ `max_image_dimension`（默认 3840） | 256 | 不放大 |
| 头像 thumb | 宽 = `avatar_thumb_size` | 无 | 不放大 |

- 短边下限 256（`MIN_DERIVED_SHORT_EDGE`）优先于基本规则。例如 6000×1000 的 thumb 按宽 640 只有 107px 高，会被顶回 1536×256；20000×1000 的 optimized 会是 5120×256，长边超过 `max_image_dimension`。
- 原图短边本来就不到 256 时保持原尺寸，下限不会把小图放大。
- 为什么要下限：横长图在前端转 90° 竖着贴，thumb 的“高”变成了卡片里的“宽”。按宽 640 缩一张 6:1 的全景只剩约 107px，铺满二百多像素宽的列就糊了。256 能保住一列宽度下的清晰度。
- 为什么不改成“全部按短边缩放”：试过，横图的 optimized 会大很多（6000×4000 按短边 3840 是 5760×3840，像素约 2.25 倍），已回滚。现在只在短边太小时兜底。

### AVIF 每边 16384 的上限

sharp（libheif）输出 AVIF 时每条边最多 16384px，超过会在编码时报 “Processed image is too large for the HEIF format”。所以：

- 上传时就拒绝：`/upload-image` 读出尺寸后，按当前配置把相片 thumb、相片 optimized、头像 thumb 三种尺寸都算一遍（上传接口不知道这张图要当相片还是头像），任何一边超过 16384 就返回 400 “图片太长了……请裁短后再上传”，临时文件不保留。前端直接显示这句报错。
- 生成时再查一次：投稿、保存、后台“重新生成图片”都按当时的配置重算。上传后把 `image_thumb_size` 调大，已有的超长相片重新生成时会得到同样的 400，旧文件不会被半路改坏。
- 默认配置下，竖向长过约 1:25.6（thumb 宽 640）、横向长过约 1:64（短边 256）的图会被拒。
- 不要用“超限就悄悄等比缩小”代替报错：那样短边会掉到 256 以下，横长图竖贴又会糊，而且用户不知道发生了什么。

### HEIC / HEIF
- HEIC/HEIF 保留原文件作为 source；SDR 由 `pillow_heif` 解出 PNG 后交给 sharp。
- Apple HDR HEIC 的 gain map 由 `apple-hdr-heic-decoder` 解成 16-bit BT.2020 PQ PNG，再走 HDR AVIF。
- 没有 Apple gain map 的 HEIC 只生成 SDR。
- 浏览器不能预览 HEIC 时拍摄表单显示提示，提交后由服务端生成 thumb。

### HDR

HDR 是 SDR 之外的附加产物。每张相片都先有 SDR optimized 和 SDR thumb；只有识别到 HDR source，才额外生成 HDR optimized。头像不参与 HDR。

#### 输出文件

```text
thumb/photo-...avif              SDR 缩略图，始终生成
optimized/photo-...-sdr.avif     SDR 全尺寸图，始终生成
optimized/photo-...-hdr.avif     HDR 全尺寸图，仅 HDR source
```

- `src_optimized` 指向 `-sdr.avif`
- `src_optimized_hdr` 指向 `-hdr.avif`，没有时为 `null`
- `thumb` / `thumb_url` 指向无后缀 SDR thumb
- HDR 文件是**纯 10-bit HDR AVIF base**，不是 gain map 文件；SDR 和 HDR 是两个独立文件
- 派生图 URL 继续带 `?v=<instance_hash>`

`has_hdr_optimized` 是**持久化标志**：表示上一次 prepare / 后台重建时确认生成了 HDR optimized。它不是每次请求实时读盘检查。HDR 文件被手工删除时 API 仍可能是 `true`，详情加载失败会回退 SDR；后台“重新生成图片”会重新校正。

#### 判定与编码矩阵

| source | thumb | optimized SDR | optimized HDR |
|---|---|---|---|
| SDR | sharp SDR | sharp 8-bit | 不生成 |
| JPEG gain map | sharp SDR base | sharp 8-bit | `avifgainmaputil convert --swap-base --ignore-profile` 得到 HDR base，10-bit CICP |
| AVIF gain map | sharp SDR | sharp 8-bit | `avifgainmaputil swapbase` 得到 HDR base，10-bit CICP |
| AVIF PQ/HLG CICP | sharp SDR | sharp 8-bit | `avifdec --depth 16` 得到 16-bit，缩放后 10-bit CICP |
| PNG cICP | sharp SDR | sharp 8-bit | `avifenc` 10-bit CICP |
| HEIC/HEIF + Apple HDR gain map | pillow_heif 解 SDR | sharp 8-bit | `apple-hdr-heic-decoder` 生成 16-bit BT.2020 PQ PNG，再 avifenc |
| 无 gain map 的 HEIC/HEIF | pillow_heif 解 SDR | sharp 8-bit | 不生成 |

#### HDR 判定条件

只认这些 HDR 来源：

- AVIF 主图的 CICP transfer = 16（PQ）或 18（HLG）
- PNG `cICP` chunk 的 transfer = 16 或 18
- JPEG/AVIF 的 gain map
- HEIC/HEIF 的 `urn:com:apple:photo:2020:aux:hdrgainmap` 辅助图

10-bit SDR、16-bit 无 cICP 图不生成 HDR；没有 PQ/HLG 的普通高位深图也不猜。

HEIC/HEIF 的 HEVC 解码由 Docker 内的 `pillow_heif` 完成；sharp 内置的 libheif 没有 HEVC decoder plugin，不能直接解 HEIC 主图。HEIC HDR 还依赖：

- `pillow_heif >= 1.8`：旧版只能读 8-bit monochrome aux，iPhone 常见的 8-bit YCbCr gain map 会失败并退回 SDR
- `apple-hdr-heic == 0.1.0`
- exiftool

HEIC 只支持 Apple 风格的 HDR gain map；没有该辅助图的 HEIC 只生成 SDR，非 Apple 格式的 HDR HEIC 不保证支持。

#### 编码流程

实现位于 `src/server/storage/hdr.ts` 和 `src/server/storage/heic-hdr.ts`：

1. `detectHdrSource()` 判断 source 是否 HDR，并得到 CICP
2. JPEG/AVIF gain map 用 `avifgainmaputil` 换成 HDR base；AVIF/PNG/HEIC 按各自方式解出 16-bit 或 8-bit 中间图
3. HEIC Apple gain map 由 `apple-hdr-heic-decoder` 生成 16-bit BT.2020 PQ PNG
4. sharp 以 `rgb16` pipeline 缩放到 optimized 尺寸；不转 sRGB、不 flatten
5. `avifenc --depth 10 --cicp P/T/M --range ... --ignore-icc` 输出 HDR AVIF
6. 读取输出 CICP，确认仍是 PQ/HLG
7. 成功后才 rename 到 `optimized/...-hdr.avif`

HDR 处理同样受全局图片串行队列和 360 秒请求上限影响；排队时间也算在请求等待里。

#### 失败与回退

- HDR 是附加产物，失败不阻止 SDR 保存
- 重建 HDR 失败时保留旧 HDR 文件
- HDR 文件丢失或损坏时，详情加载失败自动回退 `src_optimized`，不会停在失败态
- 缺少 HDR 工具时，development 告警并降级 SDR；production 启动 fail-fast

#### 运行条件与限制

- Docker 需要 libavif `1.4.2` + libaom `3.14.1` 的 `avifenc` / `avifdec` / `avifgainmaputil`
- production 还要求 `pillow_heif`、`exiftool`、`apple-hdr-heic-decoder`；缺失会 fail-fast
- 详情只在 `(dynamic-range: high)` 匹配时加载 HDR，否则用 SDR
- 不做 HDR thumb；头像不生成 HDR
- HDR 输出固定 10-bit，不输出 12-bit
- 已有相片需要在后台执行一次“重新生成图片”，才会生成 HDR 并更新 `has_hdr_optimized`
- storage schema 不需要迁移

#### 验证状态

- Docker check：当前 235 个测试通过
- iPhone：HDR 显示正常
- SDR 显示器：回退 SDR 正常
- MacBook XDR：HDR 显示正常
- HDR Viewer 加载失败：自动回退 SDR 正常

### 其他约定

- SDR 派生图先 `.rotate()` 按 EXIF 摆正，再转 sRGB、铺白底（透明 PNG 不会变黑），只输出 8bit SDR。
- 文件名带实体 ID 和内容 CRC32，强缓存；配置变化时 URL 的 `?v=` 跟着变。命名见 [api.md](api.md)。
- 配置只影响之后的上传和显式重建，不会自动重做已有图片。

## 前端：贴上墙

代码在 `src/web/components/PhotoCard/scatter.ts`（全部尺寸和摆放计算）、`PhotoCard/index.tsx`（渲染）、`Gallery/index.tsx`（瀑布流、撕胶带）、`Gallery/usePhotoPresence.ts`（相片贴上来 / 撕下去）。

### 瀑布流只用 thumb

- 卡片显示 `thumb`，经 `useQueueload` 排队加载。只有瀑布流里那一张挂 `id="photo-{id}"` 参与加载优先级，“你已经投稿了”、取消投稿页里重复出现的卡片不参与。
- 点开大图时先用已经加载好的 thumb 撑住转场，入场动画结束后才解码、挂载 `optimized`（见 designs.md“查看大图”）。

### 横长图竖贴

宽 ÷ 高 ≥ 2（`SIDEWAYS_RATIO`）的相片在拍立得里顺时针转 90° 竖着放，16:9 这类普通宽图不转。点开大图时转回横向。

- 尺寸只能从 `photoCardCover()` 取。它对横长图返回转过之后的竖框（`cover_height = cover_width × 宽 ÷ 高`）。瀑布流高度估算、防碰撞、摆正、投稿表单预览、后台磁粒都靠它。任何地方自己拿 `height / width` 算，横长图就会和实际渲染对不上。
- 旋转只放在 `<img>` 上：`.cover-area` 按竖框占位、不转；`<img>` 宽高对调后居中 `rotate(90deg)`。盖在相片上的东西（后台磁粒、复印扫描光）照常按竖框排。
- 不经过 canvas、不让后端预转：Safari 把 AVIF 画进 canvas 会出白图；后端转图会让派生图和原图方向不一致。
- 完整约束见 designs.md“横长图竖贴的实现约束”。

### 卡片高度估算

`estimatePhotoCardHeight()` 估整张拍立得的高度：白边 + 相片区域 + 写字区。瀑布流本身量真实 DOM 高度排布，这个估算只用来决定卡片大小、倾角和防碰撞。

- 写字区：有作者（非活动相片、后台）就有，放头像和昵称；活动中的公开相片没有作者，没有描述时就没有写字区，只留一道白边。
- 描述行数由 `estimateDescLines()` 估，按 `.desc-block` 的实际排版：
  - `white-space: pre-line`：回车一定换行，空行也占一行。
  - `overflow-wrap: anywhere`：一行写满就在任意字符处折。
  - 13px 手写字体，中日韩、全角标点、emoji 按 1em 宽，其余按约 0.6em 宽。
  - 首行扣掉开引号、末行加上闭引号的宽度（约 12px）。
- 磁粒让位：投票时写字区右侧给磁粒让出 44px（`DESC_VOTE_ROOM`），描述会多折几行。估算时没有作者的相片一律按少 44px 算，不看当前用户能不能投票。否则确认 QQ 前后，卡片的大小和倾角会突然变。
- 宁可估高：估高了卡片只会小一点、正一点；估矮了，转过之后的外接框算窄，可能伸进隔壁列。

### 越竖长越摆正

现实里，竖长的东西随手贴歪了会很显眼，也像要滑下来；同样的倾角，卡片越高，底边横移越多（约 1300px 高的卡片斜 2° 时底边偏出约 45px）。所以倾角按整张卡片的高宽比往正里收（`uprightFor()`）：

- 高宽比 ≤ 1.4（`TALL_FROM`）：倾角不变，±0.8°～3°。
- 高宽比 ≥ 2.4（`TALL_UPRIGHT`）：只留 ±0.3°（`TALL_ROTATE`），几乎摆正，但仍看得出是手贴的。
- 中间线性过渡；倾斜方向、大小、位移、纸胶带都不受影响。
- “竖长”看的是整张卡片，不是相片本身：竖图、转过来的横长图、描述很长或回车很多把写字区撑高的卡片，都算。
- 高宽比按缩小之前的卡片宽度算；倾角定下来后，防碰撞只缩卡片、不再改倾角。

### 随手贴与防碰撞

- 大小、倾角、横向位移、纵向错落、纸胶带位置全部由相片 id 种子决定，不用 `Math.random`。刷新、改窗口宽度、换列数，同一张相片的摆放都不变；公开页和后台完全一致。
- 新的随机量只能往种子序列末尾加，不能插在中间，否则所有已有相片的摆放都会变。
- 双列（≤ 640px）时留白和列间距收窄、卡片放大到列宽 92%～100%，让小屏的相片尽量大，见 designs.md“双列尽量放大”。
- 卡片转过之后的外接框，横向不越过“本列 + 两侧各半个列间距”。放不下就缩小卡片，不减小倾角。倾斜多出来的上下高度、纸胶带探出的部分、纵向错落，都写进格子的上下留白参与排布。
- 单测 `test/unit/photo-card-scatter.test.ts` 在 8 种布局（含 320 / 375 / 640px 双列）、多种相片比例和描述（含多行、英文）下各测 200 张，确认不伸进隔壁列，竖长卡片几乎摆正。

### 浏览器差异

- 碎纸机：非 Safari 用 html-to-image 把整张卡片转成图片再切条；Safari（含 iOS 上所有浏览器，`utils/browser.ts` 的 `isWebKitSafari`）转出来是白的，回退为只碎单张 thumb。
- 撕胶带下载原图：Chromium 在安全上下文里用 `showSaveFilePicker`，能知道用户点了“存储”还是“取消”；其他浏览器直接下载 `src_url`。见 designs.md“撕纸胶带”。

## 改动前的检查清单

- 改后端尺寸公式：同步 `image.ts` 里的公式和 `assertDerivableImage`，保证上传时的检查和真正生成用的是同一套尺寸；跑 `test/unit/derived-image-size.test.ts`。
- 改 `.desc-block` 的字号、行高、内边距、`white-space`，或磁粒的位置大小：同步 `scatter.ts` 里的 `DESC_FONT`、`DESC_LINE`、`DESC_VOTE_ROOM` 和 `estimateDescLines`。
- 改拍立得白边、写字区最小高度、纸胶带高度：只改 `scatter.ts` 里对应的函数，渲染和估算都从这里取。
- 新增要知道卡片尺寸的地方：调用 `photoCardCover()` / `estimatePhotoCardHeight()`，不要自己算。
