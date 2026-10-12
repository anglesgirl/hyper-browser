# AO3 Reader

基于 [hyper-browser](https://github.com/anglesgirl/hyper-browser)（GeckoView 内核）魔改的 AO3（Archive of Our Own）专用安卓阅读客户端。沿用 hyper-browser 的扩展机制与网络栈（支持 DoH/ECH 环境），专注 AO3 阅读体验。

## 特性

- **内置 AO3 汉化**：随包自动装入 ao3-zh 汉化扩展（源自 [ao3-chinese](https://github.com/V-Lipset/ao3-chinese) 上游），腾讯翻译默认启用，翻译按钮默认勾选
- **电子书下载管理**：AO3 作品可下载为电子书，支持类型筛选与分享
- **站外图片代理**：文章中无法直连的远程图片自动走图床代理（默认 `images.weserv.nl`，可在扩展设置中改为自建图床）
- **AO3 快捷入口**：主页原生图标直达 作品库 / 搜索 / 收藏 / 我的下载
- **静默统计**：Firebase Analytics（GA4），与 CO3 共用项目 `ao3app-a00a3`，同一份数据；仅三个事件 `app_open` / `ao3_open` / `download_complete`，静默上报、不影响浏览

## 深色模式

未内置。两个现成方案任选：

- **AO3 官方 Reversi 皮肤**：登录 AO3 账号 → 我的偏好 → 皮肤 → Reversi（官方出品，覆盖全站）
- 浏览器扩展：深色需求自行通过扩展实现（扩展安装能力取决于 hyper-browser 内核）

## 安装

- 支持 arm64 设备，APK 为 release-signed 统一签名，可直接覆盖安装旧测试版
- 首次启动自动装入内置汉化扩展，无需手动配置

## 构建

使用 GitHub Actions（`android-release.yml`），免费无限额度自动编译签名 APK：

```bash
gh workflow run android-release.yml --repo anglesgirl/hyper-browser --ref ao3-reader -f publish_release=false
```

## 致谢

- [hyper-browser](https://github.com/anglesgirl/hyper-browser) — 作者 anglesgirl，本项目的内核来源
- [ao3-chinese](https://github.com/V-Lipset/ao3-chinese) — AO3 汉化脚本上游
- [Archive of Our Own](https://archiveofourown.org) — OTW 的非营利同人存档平台

## 许可

本项目跟随上游 hyper-browser 许可；ao3-chinese 与 Reversi 皮肤代码版权归各自作者/官方所有（Reversi 官方授权自由复制修改）。
