# 应用开屏组合审阅

日期：2026-10-05。基线：`a145f34`。范围：新开屏组合功能及其与目录刷新、关注、统计的衔接。
以下均未修复；本次仅审阅、验证和记录。行号对应审阅基线。

## P2：编辑选择会被误判为上游更新

位置：`public/app.js:573`，`public/lib/startup-selector.mjs:12`、`:19`。
卡片的 `version` 被当前勾选集合的 `id:revision` 覆盖，增删任意应用会改变版本字符串；关注基线仍按普通脚本版本比较。
已关注组合后编辑选择，即使上游没有变化也可能提示“有更新”，并出现“我已在 Anywhere 更新”的错误语境。尚未导入的草稿也参与比较。
验证：在相同 bundle 中从一个应用改为两个应用，用现有 `hasMitmUpdate` 比较得到 `true`。
建议：区分选择草稿、已关注范围和上游规则版本；不要把“用户改了范围”当成“规则内容更新”。

## P2：开屏目录不会跟随前台恢复重新读取

位置：`public/lib/startup-selector.mjs:5`、`:19`，`public/app.js:968`。
开屏 catalog 只在初始化 fetch 一次，控制器没有刷新入口；普通 MITM 刷新只重取上游索引，渲染又覆写为旧控制器 revision。
新的 Hub 包部署后，长期打开的 PWA 可能继续展示旧应用目录/版本；订阅接口已更新，但关注提醒直到整页重载才可能识别。
证据：代码路径检查，未为复现而修改生产部署。
建议：将开屏目录纳入前台恢复和目录到期刷新，按稳定 ID 保留选择，并同步关注面板；避免刷新过程中改变草稿。

## P2：版本字段混用导致普通 catalog 反复判定有变化

位置：`public/app.js:573`、`:956`。
`catalogHasChanges` 把卡片的组合 revision 与上游 StartupAds 文件 hash 比较；两者不是同一版本空间。
本次线上文件 hash 为 `2c565f4fc82796ac48c987c4ddb1a3f2d401b60c55673ab5dbfa13d5f1efc262`；空组合版本为包 revision `57261e7e325c657a3c04d9cc2edb61994003d3d4fbaf99325348bf118384c882`，已经不同。
因此即使上游不变，每次活动 MITM 目录到期检查也会进入重载和列表重建。合成入口不在上游时，条目数量比较同样恒不相等。
建议：保留上游源版本用于目录比较，另存组合版本用于关注；合成卡片不参与源目录数量比较。

## P2：组合导入漏计下载量

位置：`public/app.js:602`，`public/lib/startup-selector.mjs:17`。
组合入口提前返回，最终直接跳转 `anywhere://add-rule-set`，绕开普通导入的统计函数。
卡片仍显示 StartupAds 下载量，但用户从组合面板点击“一键导入”不会增加该计数。
证据：调用路径检查；未点击生产导入按钮或人工增加计数。
建议：按现有跨用户点击口径，组合点击记为一次 StartupAds 导入，统计请求不应阻塞 App 跳转；不要按每个应用膨胀计数。

## P2：每次勾选全量重绘，键盘焦点丢失

位置：`public/lib/startup-selector.mjs:13`、`:14`。
勾选触发 `innerHTML` 替换整个应用列表；`persist/onChange` 同时重绘背景 MITM 网格。键盘无法从当前条目继续自然操作，多次选择也产生不必要重绘。
浏览器复现：打开选择面板，对“同花顺期货通”按 Space，checked 变 true，`document.activeElement.tagName` 变为 `BODY`，不是原 checkbox。随后取消选择，恢复原空组合并关闭测试页。
建议：就地更新单项与摘要，或明确恢复焦点；背景只更新组合卡片/关注计数，不重建全部资源卡片。滚动是否重置未验证，不作结论。

## 已通过与剩余验证

- Hub `npm test` 通过，但该命令尚不包含开屏测试。
- Hub startup-core 与维护仓库 selection-core 完全一致。
- `test-startup-selection.mjs`：规范选择一致性、静态发布授权、全选 501 操作、69 字符编码通过；本地 Node 平均组装约 0.28 ms，不能据此推断边缘 CPU。
- `test-startup-api.mjs`：生产全选输出一致性、GET/HEAD、ETag 和错误输入合同通过。
- 生产开屏 catalog 200，与本地生成包一致，397 条目、389 可用。
- 尚需 iOS Anywhere 实机导入/刷新、移动端性能、Cloudflare 无缓存 CPU 和请求预算验证。

优先修复版本字段与目录刷新，再补统计和增量渲染；将现有开屏静态/HTTP测试纳入明确的 Hub 验证入口。完整构建来源与对外合同见 `../PROJECT_CONTEXT.md`。
