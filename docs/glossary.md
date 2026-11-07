# 术语

本文只解释项目中的常用说法，不展开数据结构和接口。

| 术语 | 英文 | 说明 |
|---|---|---|
| 相册 | Gallery | 一次活动或主题的照片集合，包含活动时间和投票规则。 |
| 活动期 | in_event | 服务端当前时间位于相册的 `event_start` 与 `event_end` 之间（包含边界）；任意两个相册的活动区间不能重合。 |
| 稿件 / 相片 | Photo | 成员投稿的一张图片及其描述。 |
| 成员 | Member | 参与活动的人，可以是投稿者，也可以是投票者。 |
| 投稿 | Submission | 成员向某个相册提交相片的行为或结果。 |
| 投票 | Vote | 成员对相片表达喜欢并计入票数的操作。 |
| 相片卡片 | PhotoCard | 瀑布流里的一张拍立得（原 PhotoBox），公开页与后台共用；按相片 id 斜贴、错落。 |
| 横长图竖贴 | sideways | 宽 ÷ 高 ≥ 2 的相片在 PhotoCard 里转 90° 竖着放，纯前端 CSS 旋转；尺寸只能从 `photoCardCover()` 取，见 `docs/designs.md`“横长图竖贴的实现约束”。 |
| 竖长摆正 | upright | PhotoCard 的倾角按整张卡片（相片 + 写字区）的高宽比往正里收：≤ 1.4 不变，≥ 2.4 只留 ±0.3°，见 `docs/images.md`“越竖长越摆正”。 |
| 短边下限 | min short edge | 相片 thumb 和 optimized 的短边不低于 256px（原图更小时不放大），保住横长图竖贴后的清晰度，见 `docs/images.md`。 |
| 撕纸胶带 | tape pull | 公开页每截纸胶带都能点：撕开并弹出系统“存储为”对话框，存储则相片掉下去、原位空着，取消则胶带重新贴好（Safari / Firefox 拿不到结果，直接下载）。 |
| 松动的纸胶带 | loose tape | 吸引锚：公开页最上面那个瀑布流排好时，最上面一排随机一张相片的纸胶带就是松开的，提示胶带能撕。 |
| 磁粒 | Magnet | 代表一票的蓝色圆粒。公开页是登录成员自己放在相片上的票；后台统计里红色磁粒代表 5 票。 |
| 磁粒托盘 | Magnet tray | 公开页投票期屏幕底部居中的托盘（HUD），显示手里还剩几颗磁粒，磁粒与卡片上的一样大；放磁粒时磁粒从托盘飞到相片上。不限票数时为“磁粒 × ♾️”，磁粒从天而降。 |
| 公开页 | Public page | 普通访问者看到的相册页面，入口是 `/explore`；`/` 重定向到它。 |
| 成员笔记本 | Member notebook (CH. Member) | `/member/<id>` 上单独的只读名单簿，直接打开该成员的成员页；数据只来自 ClientPool，不含 QQ 号。 |
| 只藏不卸 | Keep-alive stage | 换台时去过的频道不卸载，用 React `<Activity>` 藏起来，回来时组件状态和滚动位置都还在。见 `docs/designs.md` 的“CRT 换台”。 |
| Staff 页 | Staff (CH. Staff) | `/staff` 上参与项目的人的留言，一张纸一个人，分人类组与 AI组；从 Behind 页左上角的“D”按钮进入，留言写在 `src/web/layouts/Staff/notes.tsx`。 |
| 后台 | Admin | 后台入口是 `/admin`，Behind 页 Navigator 上的“A”按钮换台进入。 |
| 已弃用组件 | deprecated | `src/web/components/deprecated/` 里不再使用但保留参考的组件，例如后台登录抽屉 `AdminLoginDrawer`。 |
| 相片堆叠 | BehindPhotoStack | Behind 页的品牌图：torzo-logo 加 12 张随机相片缩略图，一张张落下叠在桌上，移植自旧站“网址迁移说明”页。 |
| 门禁 | AccessPanel | 进 `/admin` 必过的登录界面；本地已有 token 时先用 `/auth/check` 核对（`IS LOGINED`），通过前不读任何后台数据。 |
| dispatch | Dispatch API | 通过 action 名称分发 query/mutation，而不是每个业务一个 REST 路径。 |
| query | Query | 只读 action，走 `/query/:name` 或 `/admin/query/:name`。 |
| mutation | Mutation | 写 action，走 `/mutate/:name` 或 `/admin/mutate/:name`。 |
| instance 配置 | Instance config | 运行期可修改的配置，保存在 `<STORAGE_PATH>/instance-config.json`。 |
| env 配置 | Env config | 进程启动后不可变的环境变量配置。 |
| hash bundle | Hashed bundle | 文件名带内容 hash 的 Vite 产物，可长期强缓存。 |
| SPA fallback | SPA fallback | 未命中文件的 GET 请求返回 `index.html`，但 API 路径除外。 |
| UUIDv7 | UUID version 7 | 带时间前缀的 UUID，用作 temp_id，便于按时间清理。 |
| CRC32 | CRC-32 | 上传文件内容的 32 位校验值，用于生成相片/头像文件名。 |
| temp_id | Temp ID | 上传后返回的 UUIDv7，对应 `stored-images/temp/<temp_id>.<format>`。 |
| HEIC/HEIF | HEIC/HEIF | 原始 HEIC 文件作为 source；SDR 由 pillow_heif 解码，Apple HDR gain map 由 apple-hdr-heic 处理。 |
| optimized | Optimized image | 相片的全尺寸 AVIF；SDR 文件名为 source basename 加 `-sdr`，HDR source 另有 `-hdr`，位于 `stored-images/optimized/`。 |
| avif_source_quality | AVIF source quality | optimized 全尺寸 AVIF 的质量配置，默认 75。 |
| has_hdr_optimized | Has HDR optimized | 上一次 prepare / 后台重建时记录的 HDR optimized 持久化标志；不是每次请求实时读盘。 |
| instance hash | Instance hash | 当前 instance_config 的 CRC32，用作派生图 URL 的 `?v` 缓存版本。 |
| ClientPool | ClientPool | 公开页使用的 Pool 快照；活动期使用 `GalleryInEvent` 屏蔽成员和投票记录；`ClientMember.qq_num` 固定为 null。 |
| GalleryInEvent | GalleryInEvent | 活动期相册，含 `in_event: true`，不含 `vote_records`，照片不带成员 ID。 |
| PublicMemberDTO | Public member DTO | public query 返回的成员信息，`qq_num` 固定为 null；Admin 的 `MemberDTO` 保留 QQ。 |
| storage schema | Storage schema | storage 数据格式版本；当前为 v2，v1 需要通过 `pnpm update-storage` 升级。 |
| version_time | Version time | ClientPool 生成时间戳，保留为快照元数据；SSE 不用它判断新旧。 |
| SSE | Server-Sent Events | 服务器推送长连接；公开页推送 photos/members 分类，Admin 推送完整 AdminPool。 |
| SSE 阻塞 | SSE application block | 投稿提交期间暂停把公开页 SSE 更新应用到 UI，但不断开连接；成功切到“大感谢”后 2000ms 释放并合并缓存。 |
| updated_at | Updated at | item 最后更新时间；客户端收到 SSE 后按 id + updated_at 合并，保留较新版本。 |
| Pool JSON raw | Pool JSON raw | Pool 更新后生成一次的序列化快照缓存，所有 SSE 连接复用。 |
| image_processing_effort | Image processing effort | 所有图片处理的 CPU effort 配置，默认 8。 |
| legacy | Legacy | 旧 server/web/脚本/CI，已从当前分支移除，归档在 `legacy-v3` 分支，只作历史参考。 |

更完整的项目说明见 [introduction.md](introduction.md)。
