import { getRegistrableDomain } from "./normalize.mjs";

const SYSTEM_OR_SHARED_SUFFIXES = new Set([
  "apple.com",
  "icloud.com",
  "icloud.com.cn",
  "cdn-apple.com",
  "mzstatic.com",
  "digicert.cn",
  "digicert.com",
  "globalsign.com",
  "comodoca.com",
  "sectigo.com",
  "aliyuncs.com",
  "myqcloud.com",
  "qcloud.com",
  "cloudfront.net",
  "akamaihd.net",
  "akamaized.net",
  "cloudflare.com",
  "ntp.org",
]);

export function attributeProxyTargets(report, options = {}) {
  const minSuffixEvidence = options.minSuffixEvidence ?? 3;
  const maxOwnersForExact = options.maxOwnersForExact ?? 2;
  const apps = new Map(report.apps.map((app) => [app.bundleID, cloneApp(app)]));
  const targetOwners = report.targetOwners || {};
  const suffixOwners = buildSuffixOwners(report.apps);
  const unresolved = [];
  let exactCount = 0;
  let suffixCount = 0;
  let sharedCount = 0;

  for (const target of report.proxyTargets || []) {
    const exactOwners = (targetOwners[target.value] || []).filter(Boolean);
    if (exactOwners.length === 1 || (options.allowSharedExact && exactOwners.length <= maxOwnersForExact)) {
      for (const owner of exactOwners) {
        addAttributedTarget(apps, owner, target, "proxy-exact", 0.98, "same target also appears under this app");
      }
      exactCount++;
      if (exactOwners.length > 1) sharedCount++;
      continue;
    }

    if (exactOwners.length > 1) {
      unresolved.push({ ...target, attribution: "shared-exact", candidateApps: exactOwners });
      sharedCount++;
      continue;
    }

    const suffix = target.kind === "domain" ? getRegistrableDomain(target.value) : "";
    const suffixInfo = suffix ? suffixOwners.get(suffix) : null;
    if (
      suffixInfo &&
      !SYSTEM_OR_SHARED_SUFFIXES.has(suffix) &&
      suffixInfo.total >= minSuffixEvidence &&
      suffixInfo.apps.size === 1
    ) {
      const [owner] = suffixInfo.apps;
      addAttributedTarget(apps, owner, target, "proxy-suffix", 0.78, `same site family: ${suffix}`);
      suffixCount++;
      continue;
    }

    unresolved.push({
      ...target,
      attribution: suffixInfo && suffixInfo.apps.size > 1 ? "shared-suffix" : "unresolved",
      candidateApps: suffixInfo ? [...suffixInfo.apps].sort() : [],
      suffix,
    });
  }

  return {
    ...report,
    apps: [...apps.values()].sort((a, b) => b.count - a.count || a.bundleID.localeCompare(b.bundleID)),
    unresolvedProxyTargets: unresolved.sort((a, b) => b.hits - a.hits || a.value.localeCompare(b.value)),
    attributionSummary: {
      proxyTargets: report.proxyTargets?.length || 0,
      exactCount,
      suffixCount,
      sharedCount,
      unresolvedCount: unresolved.length,
    },
  };
}

function buildSuffixOwners(apps) {
  const suffixOwners = new Map();
  for (const app of apps) {
    for (const target of app.targets) {
      if (target.kind !== "domain") continue;
      const suffix = getRegistrableDomain(target.value);
      if (!suffix) continue;
      let info = suffixOwners.get(suffix);
      if (!info) {
        info = { apps: new Set(), total: 0 };
        suffixOwners.set(suffix, info);
      }
      info.apps.add(app.bundleID);
      info.total++;
    }
  }
  return suffixOwners;
}

function addAttributedTarget(apps, bundleID, target, source, confidence, reason) {
  let app = apps.get(bundleID);
  if (!app) {
    app = { bundleID, count: 0, hits: 0, targets: [] };
    apps.set(bundleID, app);
  }

  const existing = app.targets.find((item) => item.value === target.value);
  if (existing) {
    existing.hits += target.hits || 0;
    existing.sources = unique([...(existing.sources || []), source]);
    existing.confidence = Math.max(existing.confidence || 0, confidence);
    existing.reasons = unique([...(existing.reasons || []), reason]);
  } else {
    app.targets.push({
      ...target,
      sources: [source],
      confidence,
      reasons: [reason],
    });
    app.count++;
  }
  app.hits += target.hits || 0;
}

function cloneApp(app) {
  return {
    ...app,
    targets: app.targets.map((target) => ({
      ...target,
      sources: [...(target.sources || ["native"])],
      reasons: [...(target.reasons || [])],
    })),
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
