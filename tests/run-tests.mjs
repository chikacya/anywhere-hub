import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildArrsFiles, targetsToRules } from "../public/lib/arrs.mjs";
import { attributeProxyTargets } from "../public/lib/attribution.mjs";
import { normalizeTarget } from "../public/lib/normalize.mjs";
import { parsePrivacyReportText } from "../public/lib/parser.mjs";
import { createZip } from "../public/lib/zip.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = path.join(root, "App_Privacy_Report_v4_2026-06-11T22_12_39.ndjson");

assert.deepEqual(normalizeTarget("Example.COM."), {
  kind: "domain",
  value: "example.com",
  ruleType: 2,
  registrableDomain: "example.com",
  specialRange: null,
});
assert.equal(normalizeTarget("198.18.5.62").specialRange, "fake-ip");
assert.equal(normalizeTarget("112.19.199.77").ruleType, 0);
assert.equal(normalizeTarget("[2001:db8::1]").ruleType, 1);
assert.equal(normalizeTarget("bad host name"), null);

const reportText = fs.readFileSync(fixture, "utf8");
const parsed = parsePrivacyReportText(reportText, {
  filters: { fakeIp: true, privateIp: true, localIp: true },
});
assert.equal(parsed.lineCount, 14119);
assert.equal(parsed.networkCount, 11889);
assert.ok(parsed.apps.length > 30);
assert.ok(parsed.proxyTargets.length > 1000);
assert.ok(parsed.filteredSpecialCount > 0);

const attributed = attributeProxyTargets(parsed);
assert.ok(attributed.attributionSummary.exactCount > 1000);
assert.ok(attributed.attributionSummary.unresolvedCount > 0);

const bilibili = attributed.apps.find((app) => app.bundleID === "tv.danmaku.bilianime");
assert.ok(bilibili);
assert.ok(bilibili.targets.length > 2000);

const files = buildArrsFiles("Bilibili", targetsToRules(bilibili.targets), {
  bundleID: bilibili.bundleID,
  generatedAt: "2026-06-11T00:00:00.000Z",
});
assert.ok(files.length >= 1);
assert.match(files[0].content, /^# GENERATED-FOR: Anywhere Routing Rule Set/m);
assert.match(files[0].content, /^name = Bilibili/m);
assert.match(files[0].content, /^2, /m);

const zip = createZip(files);
assert.ok(zip.size > files[0].content.length);

console.log(JSON.stringify({
  apps: attributed.apps.length,
  proxyTargets: parsed.proxyTargets.length,
  exact: attributed.attributionSummary.exactCount,
  suffix: attributed.attributionSummary.suffixCount,
  unresolved: attributed.attributionSummary.unresolvedCount,
  bilibiliRules: files.reduce((sum, file) => sum + file.count, 0),
}, null, 2));
