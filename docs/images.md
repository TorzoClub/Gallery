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

### HDR optimized

- `thumb` 和 `optimized` 的 SDR 文件规则不变：thumb 只有 SDR，optimized 始终有 `-sdr.avif`。
- HDR source 额外生成 `optimized/...-hdr.avif`；HDR 文件不是 gain map 形式，而是纯 10-bit HDR base。
- HDR 判定认 AVIF/PNG 的 PQ/HLG CICP，或 JPEG/AVIF 的 gain map；10-bit SDR 和没有 CICP 的 16-bit 图不生成 HDR。
- HDR 详情只在 `(dynamic-range: high)` 环境加载；失败回退 SDR。
- 详细流程、文件名和 Docker 工具见 [todo/hdr-supports.md](todo/hdr-supports.md)。

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
