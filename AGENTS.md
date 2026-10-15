# Anywhere Hub 项目入口

开始工作时先读 `docs/PROJECT_CONTEXT.md`；最近的开屏组合审阅见
`docs/reviews/2026-10-15-published-modules.md`；此前问题见 `docs/reviews/2026-10-13-modules.md` 和 `docs/reviews/2026-10-05-startup-selector.md`。文档是注明日期的快照，当前代码和线上状态仍需核验。

## 项目边界

- 本仓库是 Anywhere Hub；规则发布仓库是 `chikacya/anywhere-rules`。
- 开屏转换源与生成器在 `/Users/hailong/workspace/anywhere/anywhere-mitm-maintainer`。
- `src/generated/startup-bundle.json` 和 `public/lib/startup-core.mjs` 是生成产物；修改源、运行维护仓库的 `npm run startup-selection-build`，不要手改生成文件。
- 开屏稳定 ID 字典只能追加；已有选择链接不得因重新排序或重新分配 ID 改变含义。
- 普通 Common/MITM 目录是在线读取；开屏组合包随 Hub 部署更新，二者发布流程不同。
- 本地使用 `npm run serve`，默认端口 4175；不要占用 4173。
- 保留既有未跟踪设计稿和图标。Review 不自动授权修复、提交、推送或部署。

## 验证

Hub 的 `npm test` 覆盖隐私报告、普通 MITM 版本逻辑及普通模块 API，不覆盖完整开屏和前端交互。
开屏静态与 HTTP 合同测试在维护仓库，命令与边界见项目记录。
静态一致性通过不代表 Anywhere 实机去广告、设备性能或 Cloudflare 边缘 CPU 已验证。
