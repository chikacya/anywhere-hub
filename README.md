# Anywhere Hub

Anywhere 规则集、MITM 脚本导入与本地隐私报告转换工具。规则与脚本来自 [anywhere-rules](https://github.com/chikacya/anywhere-rules)。

## 本地运行

安装依赖后运行 `npm run serve`，在 `http://localhost:4175/` 打开页面。使用 Wrangler 而不是普通静态文件服务器，才能在本地测试下载量接口。运行 `npm test` 检查隐私报告转换逻辑。

## 下载量与更新日期

常用规则和 MITM 卡片的“下载量”是本站一键导入按钮触发的跨用户累计次数，从启用统计后开始计数；批量导入按文件分别计数。它不代表 Anywhere App 已成功下载或导入。计数保存在 Cloudflare SQLite Durable Object 中，不记录访客身份或隐私报告内容。BK7 不显示或记录下载量。

“更新”显示 `anywhere-rules` 中该文件最近提交的北京时间日期。上游仓库在推送 MITM 或常用规则时自动更新 `hub/common.json` 和 `hub/mitm.json`；每日、每周规则任务也会生成目录。Hub 在线读取这两份目录中的标题、Base64 图标和日期，无须因新增脚本而重新构建。上游目录暂不可用时，Hub 使用随包元数据快照。BK7 不显示更新日期。

首次发布应先推送 `anywhere-rules` 中的 `hub/` 目录、生成脚本和 GitHub Actions 工作流，再部署 Hub。此后上游新增或修改脚本时，不需要重新构建 Hub。可运行 `npm run sync:resource-metadata` 更新 Hub 的离线回退快照。

部署使用 `npm run deploy`。首次部署会通过 Wrangler migration 创建 `ImportStats` Durable Object；生产计数与本地开发计数彼此独立。

## 应用开屏选择

MITM脚本页的“应用开屏去广告”支持应用自选、全选、分享组合和选择文件导入/导出。选择链接可刷新更新，不保存每用户服务端状态。三份输出按所选应用生成；全选基线在 anywhere-rules 正式仓库。总集仅经过静态翻译检查，未做实机广告效果验证。

`src/generated/startup-bundle.json` 和 `public/lib/startup-core.mjs` 从 anywhere-mitm-workflow 的 `npm run startup-selection-build` 生成；ID字典仅追加，目录升级与重新部署一起进行。线上验证命令在维护仓库执行：`node tools/test-startup-api.mjs https://anywhere-hub.1628519350.workers.dev`。
