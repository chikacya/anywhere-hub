# Anywhere Hub 项目现状

## 2026-10-15 路由深链纠正（本地，未推送）

用户反馈能唤起 App 但没有路由导入界面。核对本地 Anywhere `381f9703` 的 DeepLinkManager：只接收 `add-rule-set`、`add-module` 等已列 host，且每个深链只提取一个 link。此前按用户给出的 `add-rules-link` 生成地址是错误的；仅 Hub 生成测试通过不证明 App 协议有效。
现已改回 `anywhere://add-rule-set?link=<编码后的单个URL>`。Common/BK7 多选不再拼接重复 link 或按48个文件一批交给 App，而通过逐项面板交接；可稍后继续、重试上一项。交接不等同导入成功，明确需在 App 确认。单项下载量仍按实际发起计数，BK7 不统计。MITM 模块入口不变。
SW v46。单项接收格式、队列推进/继续/重试测试通过，浏览器已检查面板；没有触发实机导入、提交、推送或部署。本段覆盖以下旧协议记录。

## 2026-10-15 本地修复（未发布）

按用户要求取消路由模块入口，Common/BK7 只生成 `add-rules-link`；普通 MITM 只导入 catalog 指向的正式 `.amod`，开屏选择只导入动态模块。作者来源、主要功能直接展示，较长的参数/维护说明可展开。YouTube 旧 `YouTubeBlockADDualSubsArg` 与 `YouTubeEnhanceDualSubs` 从正式和回退列表、目录变化判断中排除，仅保留 `YouTubeEnhanceDualSubsFull`；不删除上游或破坏旧 API。

修复普通关注使用 moduleVersion；已有关注基线迁移到模块版本，已知原源版本变化不静默确认。开屏关注保存固定应用 scope，与编辑草稿隔离；调整后重新关注可更换提醒范围。保留独立 sourceVersion 比较上游目录，合成入口不参与源条目数比较。开屏目录可在前台到期刷新、手动同步和关闭面板后更新，面板打开时不替换编辑内容。

勾选不再替换相同结果列表或重绘背景卡片，焦点与滚动保持；确认页只留单模块主操作。开屏 ETag 与 Cache API key 改为最终正文 SHA-256，覆盖描述和包装变化，并先检查输出是否存在再处理条件请求。路由不再走动态模块预检，因此旧 BK7 模块失败跳批及大模块拆分问题不再影响现行入口；旧模块 API 的大小限制仍保留。

本地 Wrangler `http://localhost:4175/#mitm` 已运行，SW v45，未部署、提交或推送。`npm test`（含新增导入/目录合同）、本地开屏模块单选/全选及旧文件 HTTP 合同通过。浏览器确认 YouTube 搜索仅一个结果、320px 无横向溢出、选择焦点保持、改草稿不触发关注更新。App 深链只验证生成合同，未做当前商店版实机跳转；本地 App 源码仍是旧深链定义，不能作为当前商店版验证依据。详情见 [本地修复记录](updates/2026-10-15-import-ui-local.md)。

## 2026-10-15 审阅

Git 基线为 `3c315268ac76959d947ed5827cf9741233c2cf7c`（`main` 与当前本地记录的 `origin/main` 一致；本轮未 fetch）。新增正式模块导入及描述已经提交，不再是 10-13 时未提交的运行代码。生产首页使用 `app.js?v=20261014-static-modules`，SW 为 v44。仅核验公开 HTTP，不据此确认部署 ID。

实时上游 catalog 有 56 个 MITM 条目，其中 54 个声明正式模块，数量已不同于 10-14 记录的 53 个。54 个模块全部返回 200，并通过 Hub 解析、大小限制及描述存在检查。普通卡片导入优先使用 catalog.module 的 Raw URL，兼容 API 返回同一正式文件；Common/BK7 仍动态包装，开屏仍从内嵌选择包生成。

新增风险：关注逻辑未使用上游 `moduleVersion`；开屏模块的描述加入响应后却未进入 ETag/缓存版本。前次 BK7 异步失败仍推进批次、大规则无可继续拆分方案、选择版本误报、开屏目录不刷新和勾选全量重绘问题均未修复。下载量回调修复仍保留。

`npm test` 以及生产开屏模块单选/389 项全选 HTTP 测试通过；54 份正式模块扫描通过。未验证 iOS 实机状态保持、移动端布局与边缘 CPU。本轮只补文档，不修改运行代码或发布。详情见 [2026-10-15 审阅](reviews/2026-10-15-published-modules.md)。

## 2026-10-14 正式模块文件

正式规则仓库新增53个`modules/*.amod`，普通MITM导入模块优先使用metadata.module路径。描述含来源、作用/参数及维护效果，当前单物理行用` ｜ `分隔并自然折行。旧AMRS/ARRS入口保留；旧模块API转为读取同一正式AMOD，开屏自选仍动态生成并使用相同描述。没有改规则逻辑。

## 2026-10-13 再审阅

新增模块包装层已核验：Common 所选、BK7 批次、普通 MITM、开屏组合均提供旧规则集与 397+ 模块双入口。正式源仍为 `.amrs`/`.arrs`；普通模块在线读取源与关联 Reject，开屏模块使用原生成包。模块链接做 GET 预检后跳转 `add-module`。`StartupAds.amod` 为当前命名，`selection.amod` 保留兼容。

本次线上首页确认 `app.js?v=20261010-dual-entry2`、SW v43；普通 WeiboBlockAD 模块及开屏单选/全选接口检查见最新审阅。历史部署 ID 仅沿用交付记录，本次未通过部署管理 API 再核验。
Git HEAD 仍为 `a145f34`，新功能以已修改及未跟踪文件存在，尚未形成 Git 提交；后续发布不能只依据 HEAD 判断线上代码。

前次下载量漏计已补 `onImport`，覆盖开屏两个入口；选择版本误报、目录单次读取、普通目录反复重绘、勾选焦点丢失仍未解决。新增发现为模块失败仍推进 BK7 批次，以及批量模块大小限制缺少可继续的拆分反馈。
已通过 `npm test` 和生产 `tests/startup-module-http.mjs`；未验证 iOS 实机模块刷新后的参数、开关、路由保持，也未重测移动端性能或边缘 CPU。
详情与下一步见 [2026-10-13 模块审阅](reviews/2026-10-13-modules.md)。本轮仅补记录，不修复运行代码、提交或部署。

## 2026-10-10 模块过渡策略

正式 MITM 维护与发布继续使用独立 `.amrs`、`.arrs`；Hub 只包装生成 `.amod`，不另行转换脚本。现有“一键导入”保留 `add-rule-set`，新增“添加模块 · 397+”入口。新旧入口覆盖 Common、BK7 批次、普通 MITM 与开屏组合。397 已移除旧深链的单项及批量处理；旧入口面向当前商店版，Hub 不自动识别设备版本。商店正式支持后再决定默认入口迁移。

用户已确认 Tracker 模块导入测试无明显问题；模块刷新后的参数、开关及路由分配保持仍待实机验证。模块入口不宣称解决现有 App 脚本问题。原开屏编码、生成包及旧文件订阅保留。以下 2026-10-05 内容为历史快照。

双入口已于 2026-10-10 经用户授权部署，版本 `54d5d1fd-eda3-4e84-9956-fc59136823e7`，Service Worker v42。线上普通模块及开屏新旧接口检查通过；详细交付记录见 `updates/2026-10-10-modules-local.md`。

记录日期：2026-10-05。代码基线：`main` / `a145f3482cd5c1e6c94ca69b0b92c1decb11ed24`，审阅时本地与 `origin/main` 一致。
本记录用于后续会话恢复，不是实时生产状态；已知问题见 [本次审阅](reviews/2026-10-05-startup-selector.md)。

## 职责与入口

Hub 提供 Common 规则、全量 BK7 规则选择导入、MITM 导入与关注更新、iOS 隐私报告本地转换、通用转换器跳转，以及应用开屏自选组合订阅。
移动端使用浮动顶栏、底部导航与 PWA。隐私报告在浏览器本地处理，不上传服务端。

- Hub 仓库：`https://github.com/chikacya/anywhere-hub`。
- 本次检查生产地址：`https://anywhere-hub.1628519350.workers.dev`。
- 规则仓库：`https://github.com/chikacya/anywhere-rules`。
- 通用转换器公开入口：`http://worker.anywhere-converter.ccwu.cc/`。
- 本地：`npm run serve`，`http://localhost:4175/`；部署：`npm run deploy`。
- Worker：`anywhere-hub`；静态资源目录 `public`；`/api/*` 先执行 Worker。

## 普通目录、统计与关注

Common/MITM 通过 `/api/catalog/common` 和 `/api/catalog/mitm` 读取上游 `hub/*.json`。
标题、Base64 图标、文件最后提交日期和版本来自上游索引；新增或改名不要求重建 Hub，随包快照仅作回退。
活动页面每 30 秒检查目录是否到期，目录刷新间隔为 2 分钟；回到前台、切换页面也触发检查。仅元数据变化时应重绘列表。

“下载量”是本站一键导入点击的跨用户累计数，不是 App 下载成功数。SQLite Durable Object `IMPORT_STATS` 使用 `global-imports-v1` 实例；BK7 不统计、不展示日期。
MITM 关注状态存在当前浏览器 `anywhere-hub-mitm-follows-v1`，保存版本基线，用户手动确认已更新。Hub 无法读取 Anywhere 已安装版本，也不会覆盖 App 中旧脚本。
Service Worker 当前 shell 为 v40，`/api/` 不走 shell 缓存。

## 应用开屏自选组合

新增提交：`01272f4` 接入组合订阅、`f8294ee` 调整命名与关闭按钮、`a145f34` 显示上游 MITM 限制。
入口沿用 MITM 列表中的 `mitm/StartupAds.amrs`，置于首位；上游缺少此项时创建合成入口。

用户通过两步弹层选择应用、确认组合。支持搜索、已选筛选、全选可用项、清空、冲突提示、覆盖提示、分享组合、JSON 导入/导出。暂无规则条目禁选。
当前包有 397 条目、389 可选项；AMDC 以“阿里系网络调度”作为普通条目，全选包含它。37 项上游 MITM 限制保留原有范围限定，不据此自动禁选，也未重新实机验证。

选择保存在 `anywhere-startup-selection-v1`；分享链接为 `?startup=<code>#mitm`，JSON 为 `{schemaVersion:1,apps:[稳定 ID]}`。
稳定 ID 以规范位集编码为 `1.<base64url>`；同一应用集合产生相同选择编码。全选编码当前长 69 字符。
选择范围固定，上游新增应用不自动加入。修改范围产生新订阅地址；用户需处理 Anywhere 中旧组合和配套路由，避免重复导入。

前端 `public/lib/startup-selector.mjs` 使用 `public/lib/startup-core.mjs`；Worker `src/startup-api.mjs` 使用 `src/generated/startup-bundle.json`。
接口 `/api/startup/catalog` 提供应用目录；`/api/startup/mitm.amrs`、`direct.arrs`、`reject.arrs` 的 `?s=<code>` 按所选范围组装，前端只导入需要的文件类型。
运行时只组合预生成片段，不实时抓取或转换上游，不为每个用户保存一份规则。组合引擎保留顺序约束并去重域名。
缓存键包含包 revision、规范选择和产物类型，提供 ETag、GET/HEAD 合同。

## 生成与发布边界

开屏组合不是普通在线 catalog。订阅刷新得到的是最新已部署 Hub 包；仅更新 anywhere-rules 不会自动更新 Hub 内嵌组合包。
源仓库实际路径：`/Users/hailong/workspace/anywhere/anywhere-mitm-maintainer`。
在该仓库修改转换源并运行 `npm run startup-selection-build`，由 `tools/build-startup-selection.mjs` 生成：

- 维护仓库 `recipes/startup-ads/selection-ids.json`：只追加的稳定 ID 字典。
- 维护仓库 `recipes/startup-ads/selection-bundle.json`：片段、目录与版本。
- Hub `src/generated/startup-bundle.json`、`public/lib/startup-core.mjs`：随部署发布。

不要直接编辑 Hub 生成产物；先检查生成 diff、兼容性与合同，再按用户授权部署。
当前源版本标记为 `2026-08-29`，包更新日期 `2026-10-05`，revision 为 `57261e7e325c657a3c04d9cc2edb61994003d3d4fbaf99325348bf118384c882`。
全选输出 501 个操作、436 个域名；MITM 181248 字节，Direct 30252 字节，Reject 30323 字节。

## 本次验证与未验证

2026-10-05 已通过 Hub `npm test`，共享核心与维护仓库源的 `cmp`，维护仓库以下测试：

```sh
node tools/test-startup-selection.mjs
node tools/test-startup-api.mjs https://anywhere-hub.1628519350.workers.dev
```

线上 catalog 与本地包 revision 一致；HTTP 测试覆盖全选内容一致性、ETag 304、HEAD、方法和错误编码处理。
浏览器确认选择持久化交互，并复现勾选后焦点丢失；测试选择已恢复为空，未触发实际导入或统计写入。
Hub `npm test` 尚未整合开屏测试；未验证 iOS 实机广告效果、订阅刷新、设备功耗、移动端流畅度和 Cloudflare 边缘 CPU/负载。
本次审阅只新增/修正文档，没有修复运行代码、提交、推送或部署。

模块命名于 2026-10-10 更新：普通插件沿用原规则 basename+.amod（例如 WeiboBlockAD.amod），响应添加对应下载文件名；开屏组合使用 StartupAds.amod，旧 selection.amod 保留兼容。部署版本 36f37c82-7a96-4266-990d-863d38da66ae，SW v43。
