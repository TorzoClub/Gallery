# HDR fixtures

- `apple_gainmap_new.jpg`：带 Apple 风格 gain map 的 JPEG，来自 libavif 1.4.2 的 `tests/data/apple_gainmap_new.jpg`。
- `iphone-hdr.heic`：带 Apple HDR gain map 的 HEIC，来自 `johncf/apple-hdr-heic` 的 `tests/data/hdr-sample.heic`（MIT 测试数据）。
- `plain-sdr.heic`：由本项目 `test/integration/test-pic.jpg` 用 macOS `sips` 生成的无 gain map HEIC，用于普通 SDR 回归；不是真实 iPhone 拍摄样本。

仅用于 HDR/HEIC 集成测试。
