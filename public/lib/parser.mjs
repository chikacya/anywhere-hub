import { isFilteredSpecialRange, normalizeTarget } from "./normalize.mjs";

export const DEFAULT_PROXY_BUNDLE_IDS = new Set([
  "com.argsment.anywhere",
  "com.bytecrossing.egern",
  "com.liguangming.shadowrocket",
  "com.nssurge.surge-ios",
  "com.crossutility.quantumult-x",
  "com.loon0x.lawn",
  "com.stash.app",
]);

export async function parsePrivacyReportStream(file, options = {}, progress = () => {}) {
  if (!file?.stream) {
    throw new Error("当前浏览器不支持 File.stream()，无法安全处理大文件。");
  }

  const reader = file.stream().getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let lineCount = 0;
  const state = createState(options);

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      lineCount++;
      ingestLine(line, state);
      if (lineCount % 1000 === 0) {
        progress(progressState(state, lineCount));
      }
    }
  }

  const tail = decoder.decode();
  if (tail) buffer += tail;
  if (buffer.trim()) {
    lineCount++;
    ingestLine(buffer, state);
  }

  return snapshotState(state, lineCount, true);
}

function progressState(state, lineCount) {
  return {
    done: false,
    lineCount,
    networkCount: state.networkCount,
    invalidJsonCount: state.invalidJsonCount,
    invalidTargetCount: state.invalidTargetCount,
    filteredSpecialCount: state.filteredSpecialCount,
    apps: state.apps.size,
    proxyTargets: state.proxyTargets.size,
  };
}

export function parsePrivacyReportText(text, options = {}) {
  const state = createState(options);
  let lineCount = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    lineCount++;
    ingestLine(line, state);
  }
  return snapshotState(state, lineCount, true);
}

function createState(options) {
  const proxyBundleIDs = new Set(
    [...(options.proxyBundleIDs || DEFAULT_PROXY_BUNDLE_IDS)].map((id) => id.toLowerCase()),
  );
  return {
    options,
    proxyBundleIDs,
    lineCount: 0,
    networkCount: 0,
    invalidJsonCount: 0,
    invalidTargetCount: 0,
    filteredSpecialCount: 0,
    apps: new Map(),
    targetIndex: new Map(),
    proxyTargets: new Map(),
    firstTimestamp: "",
    lastTimestamp: "",
  };
}

function ingestLine(line, state) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let record;
  try {
    record = JSON.parse(trimmed);
  } catch {
    state.invalidJsonCount++;
    return;
  }

  if (record.type !== "networkActivity" || !record.domain || !record.bundleID) return;
  state.networkCount++;
  rememberTimeRange(state, record);

  const normalized = normalizeTarget(record.domain);
  if (!normalized) {
    state.invalidTargetCount++;
    return;
  }

  if (isFilteredSpecialRange(normalized, state.options.filters)) {
    state.filteredSpecialCount++;
    return;
  }

  const bundleID = String(record.bundleID);
  const bundleKey = bundleID.toLowerCase();
  const entry = {
    ...normalized,
    raw: record.domain,
    hits: Number(record.hits) || 0,
    firstTimeStamp: record.firstTimeStamp || "",
    timeStamp: record.timeStamp || "",
    domainOwner: record.domainOwner || "",
    context: record.context || "",
    contextVerificationType: record.contextVerificationType,
  };

  if (state.proxyBundleIDs.has(bundleKey)) {
    addTarget(state.proxyTargets, entry, bundleID);
    return;
  }

  addAppTarget(state, bundleID, entry, "native");
  indexTarget(state.targetIndex, entry.value, bundleID);
}

function addAppTarget(state, bundleID, target, source, confidence = 1, reason = "") {
  const app = getApp(state.apps, bundleID);
  const existing = app.targets.get(target.value);
  if (existing) {
    existing.hits += target.hits;
    existing.sources.add(source);
    if (confidence > existing.confidence) existing.confidence = confidence;
    if (reason) existing.reasons.add(reason);
    return;
  }

  app.targets.set(target.value, {
    ...target,
    sources: new Set([source]),
    confidence,
    reasons: new Set(reason ? [reason] : []),
  });
}

function addTarget(map, target, bundleID) {
  const existing = map.get(target.value);
  if (existing) {
    existing.hits += target.hits;
    existing.bundleIDs.add(bundleID);
    return;
  }
  map.set(target.value, {
    ...target,
    bundleIDs: new Set([bundleID]),
  });
}

function getApp(apps, bundleID) {
  let app = apps.get(bundleID);
  if (!app) {
    app = { bundleID, targets: new Map() };
    apps.set(bundleID, app);
  }
  return app;
}

function indexTarget(index, value, bundleID) {
  let owners = index.get(value);
  if (!owners) {
    owners = new Set();
    index.set(value, owners);
  }
  owners.add(bundleID);
}

function rememberTimeRange(state, record) {
  const candidates = [record.firstTimeStamp, record.timeStamp].filter(Boolean);
  for (const stamp of candidates) {
    if (!state.firstTimestamp || stamp < state.firstTimestamp) state.firstTimestamp = stamp;
    if (!state.lastTimestamp || stamp > state.lastTimestamp) state.lastTimestamp = stamp;
  }
}

function snapshotState(state, lineCount, done) {
  return {
    done,
    lineCount,
    networkCount: state.networkCount,
    invalidJsonCount: state.invalidJsonCount,
    invalidTargetCount: state.invalidTargetCount,
    filteredSpecialCount: state.filteredSpecialCount,
    firstTimestamp: state.firstTimestamp,
    lastTimestamp: state.lastTimestamp,
    apps: serializeApps(state.apps),
    proxyTargets: serializeTargets(state.proxyTargets),
    targetOwners: serializeTargetOwners(state.targetIndex),
  };
}

function serializeApps(apps) {
  return [...apps.values()]
    .map((app) => ({
      bundleID: app.bundleID,
      count: app.targets.size,
      hits: sumHits(app.targets),
      targets: serializeTargets(app.targets),
    }))
    .sort((a, b) => b.count - a.count || a.bundleID.localeCompare(b.bundleID));
}

function serializeTargets(targets) {
  return [...targets.values()]
    .map((target) => ({
      ...target,
      sources: target.sources ? [...target.sources] : undefined,
      reasons: target.reasons ? [...target.reasons] : undefined,
      bundleIDs: target.bundleIDs ? [...target.bundleIDs] : undefined,
    }))
    .sort((a, b) => b.hits - a.hits || a.value.localeCompare(b.value));
}

function serializeTargetOwners(index) {
  const result = {};
  for (const [target, owners] of index) result[target] = [...owners].sort();
  return result;
}

function sumHits(targets) {
  let hits = 0;
  for (const target of targets.values()) hits += target.hits || 0;
  return hits;
}
