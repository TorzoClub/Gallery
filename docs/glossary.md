# 术语

本文只解释项目中的常用说法，不展开数据结构和接口。

| 术语 | 英文 | 说明 |
|---|---|---|
| 相册 | Gallery | 一次活动或主题的照片集合，包含活动时间和投票规则。 |
| 稿件 / 相片 | Photo | 成员投稿的一张图片及其描述。 |
| 成员 | Member | 参与活动的人，可以是投稿者，也可以是投票者。 |
| 投稿 | Submission | 成员向某个相册提交相片的行为或结果。 |
| 投票 | Vote | 成员对相片表达喜欢并计入票数的操作。 |
| 公开页 | Public page | 普通访问者看到的相册页面，入口是 `/explore`；`/` 重定向到它。 |
| 后台 | Admin | 管理相册、相片、成员、投票和配置的页面，入口是 `/admin`。 |
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
| optimized | Optimized image | 相片的 SDR 全尺寸 AVIF；文件名为 source basename 加 `-sdr`，位于 `stored-images/optimized/`。 |
| avif_source_quality | AVIF source quality | optimized 全尺寸 AVIF 的质量配置，默认 75。 |
| has_hdr_optimized | Has HDR optimized | 磁盘上是否确实存在 HDR optimized 文件；Phase 0 固定为 false。 |
| instance hash | Instance hash | 当前 instance_config 的 CRC32，用作派生图 URL 的 `?v` 缓存版本。 |
| ClientPool | ClientPool | 公开页使用的 Pool 快照；活动期使用 `GalleryInEvent` 屏蔽成员和投票记录。 |
| GalleryInEvent | GalleryInEvent | 活动期相册，含 `in_event: true`，不含 `vote_records`，照片不带成员 ID。 |
| version_time | Version time | ClientPool 生成时间戳，用于拒绝旧快照覆盖新数据。 |
| image_processing_effort | Image processing effort | 所有图片处理的 CPU effort 配置，默认 8。 |
| legacy | Legacy | `legacy/` 下冻结的旧 server/web/脚本/CI，只作历史参考。 |

更完整的项目说明见 [introduction.md](introduction.md)。
