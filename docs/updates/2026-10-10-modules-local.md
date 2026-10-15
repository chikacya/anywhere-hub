# Anywhere 397 模块：本地接入

本轮仅修改与验证本地 Hub，不部署、提交或推送。

普通 MITM 卡片使用 `/api/modules/<原稳定文件名>.amod`，一个模块包含原 MITM 文件及 catalog 明确关联的 Reject 文件。原始文件的 Raw 下载继续保留。Common/BK7 现有选择导入同样包装为 Routing 模块，选择路径只能来自在线 catalog/index；不接受任意 URL。API 读取当前线上规则，不在 Hub 内重新转换脚本。

开屏组合使用 `/api/startup/selection.amod?s=<原选择编码>`，原编码、ID 字典和所选范围保持；模块包含非空 MITM、Direct、Reject。顶部名称固定为“应用开屏去广告”，子名称从原文件头读取。原 `/mitm.amrs`、`/direct.arrs`、`/reject.arrs` 下载接口保留；旧 `add-rule-set` 仅适用于 Anywhere 396 或更早，当前 UI 导入使用 `add-module`，要求 397+。

导入先 GET 预检，未知路径、源不可用或模块大小超限时显示错误并停止跳转。需要停用旧独立 MITM 规则集；397 相同 hostname 的独立规则优先于模块。接口支持 GET/HEAD、ETag/304；不访问设备或修改用户安装状态。

## 本地验证

```sh
npm test
node tests/startup-module-http.mjs http://localhost:4175
node /Users/hailong/workspace/anywhere/anywhere-mitm-maintainer/tools/test-startup-api.mjs http://localhost:4175
```

普通 API 使用 fetch fixture 验证原子规则保留、原 Reject 配对、目录白名单、路径安全、HTTP 方法、HEAD/ETag。开屏 HTTP 单选及全选 389 应用验证解码模型和原组装模型一致；全选 3 个子规则集，编码后 JSON 228098 bytes。旧开屏三个文件 HTTP 合同通过。Service Worker shell 版本及 app 引用同步为本地模块版本。

未进行 iOS 实机导入/更新，也未验证 Cloudflare 生产边缘运行。在线源的更新时点可能不同，普通 API 不声称多个源文件是一个原子 Git revision。397 模块不改变脚本能力与清理逻辑。

本地浏览器已检查普通 MITM 卡片、应用选择及确认导入页：确认页显示一个 `.amod` 可更新订阅，397+ 与旧插件停用提示可见。没有点击实机导入。模块 API 单元测试已加入 `npm test`；本轮保留原有设计稿、图标等工作区内容。

## 商店版兼容入口调整

按用户反馈，Hub 保留原 `add-rule-set` 一键导入，并另加“添加模块 · 397+”。Common 单项/所选、BK7 批次、普通 MITM 和开屏组合均提供两种入口；开屏确认页恢复展示原独立文件，同时提供模块按钮。原生成接口和 ID 不变，未部署。

核查 Anywhere remote HEAD `ea12a6e5690964b27fb4a4b52f214d92419d0453` 与模块提交之前的 `DeepLinkManager.swift`：旧 `add-rule-set` 支持一个或多个 link；397 的 switch 仅保留 add-proxy/add-module，没有单个规则集深链兼容分支。因此旧入口用于现有商店版；397 导入单个 Routing 也需使用单子集模块或 App 内手动导入。Hub 无法可靠检测用户安装版本，不自动替换入口。

## 授权上线（2026-10-10）

用户随后授权补齐工作流并上线 Hub。维护仓库 `docs/WORKFLOW.md` 与专用 Agent 契约已经明确：商店模块支持确认前，独立 `.amrs`、`.arrs` 继续作为正式维护与发布产物，模块仅为包装层；参数、开关和路由分配的刷新保持待实机验证。用户已确认 Tracker 导入测试无明显问题。

`npm test`、部署 dry-run 与 diff 检查通过；已执行 `npm run deploy`，版本 ID `54d5d1fd-eda3-4e84-9956-fc59136823e7`。线上地址为 `https://anywhere-hub.1628519350.workers.dev`。线上开屏模块单选/全选、旧独立文件 HTTP 合同通过，小红书模块接口 HEAD 200；浏览器确认卡片同时显示原导入和 397+ 模块入口。Service Worker 为 v42，启动选择器缓存键与 app import 一致。没有提交或推送 Git，没有替换正式脚本产物。
