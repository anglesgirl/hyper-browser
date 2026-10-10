# AO3 阅读模式集成

`ao3-reader` 分支为 hyper-browser 内置阅读模式增加了 AO3 专用内容提取。

## 背景

hyper-browser 已内置基于 Mozilla Readability 的通用阅读模式
（`internal-pages/src/reader-content.ts`，通过工具栏/菜单的阅读模式按钮触发，
经由 `GeckoSessionController.toggleReaderMode()` 注入）。

通用 Readability 在 AO3 章节页上工作不稳定：AO3 页面包含大量导航、
评论区、kudos 按钮等噪音，且章节正文有明确的结构化容器。
本分支增加了 AO3 专用的提取器，优先于通用 Readability 执行。

## 改动

### `internal-pages/src/reader-content.ts`

新增两个函数：

- `isAo3ChapterPage(): boolean`
  检测当前页面是否为 AO3 章节页：
  - hostname 为 `archiveofourown.org`（或子域名）
  - pathname 匹配 `/works/{id}` 或 `/works/{id}/chapters/{chapterId}`

- `extractAo3Article(): ReaderArticle | null`
  AO3 专用提取逻辑：
  - 正文：`#chapters .userstuff`（按顺序拼接多章节块）
  - 清理每个 `.userstuff` 内的 `.kudos`、`.comments`、`.navigation`、`.actions`
  - 标题：优先 `.chapter .heading`，回退到 `.work .heading` / `h2.title`，
    最后回退 `document.title`
  - 作者：`a[rel="author"]` 或 `.byline a`
  - 正文经由共享的 `sanitizeArticle()` 过滤后返回
  - 正文不足 `MIN_ARTICLE_CHARACTERS`（200 字符）时返回 null，
    交给通用 Readability 兜底

- `extractArticle()` 开头增加 AO3 优先分支：
  ```ts
  const ao3Article = extractAo3Article();
  if (ao3Article) return ao3Article;
  // ... 原有 Readability 逻辑
  ```

章节导航（上一章/下一章）沿用阅读器已有的通用导航检测，
AO3 的 `.navigation` 链接会被自动识别。

## 使用方式

1. 在 hyper-browser 中打开任意 AO3 章节页
   （如 `https://archiveofourown.org/works/12345/chapters/67890`）
2. 点击工具栏或菜单中的「阅读模式」按钮
3. 自动使用 AO3 专用提取器渲染干净的阅读视图
   （浅色/深色/纸色主题、字号调节与通用阅读模式一致）

## 独立扩展（备用方案）

`ao3-reader-extension/` 目录包含一个独立的 WebExtension 版本
（同一套提取逻辑的简化版），可作为以下用途的起点：

- 在桌面 Firefox / 其他 Gecko 浏览器上单独安装测试 AO3 提取效果
- 若未来需要将 AO3 阅读器拆分为可选扩展，可直接以此为基础

通过 hyper-browser 的扩展管理页加载 `ao3-reader-extension/` 目录
（或打包后的 XPI）即可安装。

## 后续可做

- [ ] AO3 章节下拉选单：在阅读视图内直接跳转章节
- [ ] 阅读进度记忆：按作品 ID 记录上次阅读位置
- [ ] 与 co3 的翻译功能联动（段落级翻译覆盖层）
- [ ] ECH 状态指示：在 AO3 页面显示当前连接是否走了 ECH
