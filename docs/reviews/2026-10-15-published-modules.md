# 正式模块与描述审阅

日期：2026-10-15。代码基线 `3c31526`，本轮不修改运行代码、提交、推送或部署。
审阅新正式模块导入与描述，以及 10-13 问题状态。旧文档和设计稿修改保持。

## 新增功能与契约变化

普通 MITM 模块不再默认请求 Hub 动态组装，`openModuleImport` 重新获取 metadata，优先使用 `metadata.module` 指向正式 `modules/*.amod` Raw 订阅。
兼容 `/api/modules/<basename>.amod` 在线读取该正式文件，验证后原样返回；metadata 未提供 module 才回退组合原 AMRS/Reject。Common/BK7 包装和开屏选择仍是动态生成，不能统称所有模块均已静态化。
`module-package.mjs` 新增单物理行 description 解析、包装及大小计量。开屏描述来自 `src/generated/module-descriptions.json`；普通正式模块描述来自规则发布仓库。模块描述以 ` ｜ ` 分段自然折行。

## P2：模块版本没有参与关注判断

位置：`public/app.js:537`、`:904`、`:962`。
上游 catalog 已同时提供原 AMRS 的 `version` 和正式 AMOD 的 `moduleVersion`。Hub 装载和 hydrate 仍仅保留原 version，关注基线也未区分导入类型。
当只改模块描述、配套路由或模块包装而 AMRS 内容不变时，模块订阅已变，Hub 却不会提示其关注者。这是新增正式模块对接不完整，不是断言所有规则更新都会漏报。
证据：读取上游 `scripts/build_hub_catalog.py`，其 moduleVersion 来自 modules index sha256；`resource_entry` 的 version 来自去图标后的 AMRS。前端只读取后者。
建议：明确关注的是规则集还是模块，保存对应 revision；若关注统一资源，则使用 AMRS、Reject、模块的合成版本并设计现有基线迁移，避免上线即全量误报。

## P2：开屏描述变化不改变 ETag 与缓存键

位置：`src/startup-api.mjs:12`、`:14`、`:15`、`:18`。
新响应正文包含独立 JSON 中的 description，但 ETag 仍是 bundle.revision + selection + 固定 amod1，Cache API key 也仅用 bundle.revision。
只修改描述或包装模板并部署时，规则包 revision 可不变；客户端携带旧 ETag 会在组装前直接得到 304，无法取得新描述。边缘旧正文同样可能继续命中直到缓存过期；客户端条件请求的误判并不随边缘过期自动消失。
证据：10-13 版本无 description，当前版本有 description，两者 ETag 公式、amod1 标识和规则包 revision 未变。此类版本变化现有 HTTP 测试未覆盖。
建议：给模块表示单独的内容版本，覆盖描述、包装算法及规则包；同时进入 ETag 和 Cache API key，或以最终内容 hash 作为验证器。

## 前次问题状态

- BK7 异步模块失败仍推进 offset：未修复，`public/app.js:504`。pending 时仍可重复点击。
- 按文件数分批不能保证模块大小：未修复，90 万编码字节限制保留且合理，但未提供可继续的拆分方案。本轮不重复下载大规则复现；证据见 10-13 记录。
- 选择范围 revision 覆盖源 version：未修复，`public/app.js:578`，仍可能误报更新和目录变化。
- 开屏 catalog 初始化只取一次：未修复，`public/lib/startup-selector.mjs:5`。
- 勾选替换整列表并重绘背景：未修复，`public/lib/startup-selector.mjs:14`、`:15`。焦点问题沿用 10-05 浏览器证据，本轮未重复浏览器操作。
- 开屏两个入口下载量回调：修复保留，没有写入生产计数作验证。

## 验证

`npm test` 通过，新增正式文件兼容返回与描述保留 fixture 通过。
`node tests/startup-module-http.mjs https://anywhere-hub.1628519350.workers.dev` 通过：单选及 389 项全选、原子规则/routing seed 一致性、HEAD/ETag 和错误输入；全选 3 子规则集，测试 URL 对应编码模型 228334 字节。

实时上游 MITM catalog 56 条，54 条提供 module。按其明确路径读取全部 54 份正式模块，均 HTTP 200、可由 validateModuleText 解析、通过大小限制且具有非空描述；这不是 Swift 实机导入验证。
生产首页及 SW 200，app key 为 20261014-static-modules，shell v44。未核验部署管理 API 或当前 App 商店版本。
未运行 iOS 实机模块更新状态保持、移动端性能或 Cloudflare CPU 负载测试。本轮无 UI 修改，因此未重复全页面视觉检查。

优先补模块版本关注和开屏表示缓存版本，再修复已有批次错误与长驻刷新问题。部署前仍应增加“正文变化而规则包不变”的条件请求回归验证。
