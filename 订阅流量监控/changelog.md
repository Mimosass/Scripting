# Changelog

本项目所有改动记录于此。当前默认版本：**1.0.0**。

## [1.0.0] - 2026-10-14

- 初始化移植：订阅流量监控小组件（Egern Hark 环形版移植）。
- 支持最多 4 个订阅，编码 URL 与直链均可解析（`normalizeSubUrl`）。
- 多家族适配：小/中/大号及锁屏 accessory（圆形/矩形）。
- 多 UA 轮试拉取订阅信息（clash.meta / clash-verge / v2rayN / Surge / Quantumult X）。
- 流量解析：优先 `subscription-userinfo` 头，回退正文正则（有效期/剩余/总量），base64 兜底节点计数。
- 设置页：订阅链接/名称/重置日/套餐总量、组件标题、刷新间隔（默认 2 小时，0.5–24）、自定义 User-Agent。
