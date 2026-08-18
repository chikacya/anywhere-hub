import { buildArrsFiles, targetsToRules } from "./lib/arrs.mjs";
import { displayBundleName } from "./lib/bundle-names.mjs";
import { createZip } from "./lib/zip.mjs";

const RAW_BASE = "https://raw.githubusercontent.com/chikacya/anywhere-rules/main";
const COMMON_INDEX_URL = `${RAW_BASE}/rules/common/index.json`;
const MITM_API_URL = "https://api.github.com/repos/chikacya/anywhere-rules/contents/mitm?ref=main";

const els = {
  tabs: [...document.querySelectorAll("[data-tab]")],
  panels: [...document.querySelectorAll("[data-panel]")],
  toast: document.querySelector("#toast"),
  themeToggle: document.querySelector("#themeToggle"),

  refreshRules: document.querySelector("#refreshRules"),
  rulesStatus: document.querySelector("#rulesStatus"),
  rulesSearch: document.querySelector("#rulesSearch"),
  rulesList: document.querySelector("#rulesList"),
  importSelectedRules: document.querySelector("#importSelectedRules"),

  refreshMitm: document.querySelector("#refreshMitm"),
  mitmStatus: document.querySelector("#mitmStatus"),
  mitmSearch: document.querySelector("#mitmSearch"),
  mitmList: document.querySelector("#mitmList"),

  file: document.querySelector("#file"),
  parse: document.querySelector("#parse"),
  status: document.querySelector("#status"),
  progress: document.querySelector("#progress"),
  stats: document.querySelector("#stats"),
  conversionResults: document.querySelector("#conversionResults"),
  unresolvedPanel: document.querySelector("#unresolvedPanel"),
  apps: document.querySelector("#apps"),
  appSearch: document.querySelector("#appSearch"),
  preview: document.querySelector("#preview"),
  unresolved: document.querySelector("#unresolved"),
  downloadSelected: document.querySelector("#downloadSelected"),
  downloadAll: document.querySelector("#downloadAll"),
  selectAll: document.querySelector("#selectAll"),
  clearSelection: document.querySelector("#clearSelection"),
  filterFake: document.querySelector("#filterFake"),
  filterPrivate: document.querySelector("#filterPrivate"),
  filterLocal: document.querySelector("#filterLocal"),
  allowShared: document.querySelector("#allowShared"),
};

let report = null;
let selectedBundleIDs = new Set();
let objectUrls = [];
let rules = [];
let selectedRuleUrls = new Set();
let mitmScripts = [];
let toastTimer;
let ruleMetadataPromise;
let mitmMetadataPromise;

initTheme();
bindEvents();
loadRepositoryData();

function bindEvents() {
  for (const tab of els.tabs) {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  }

  els.themeToggle.addEventListener("click", toggleTheme);
  els.refreshRules.addEventListener("click", () => loadRules({ force: true }));
  els.refreshMitm.addEventListener("click", () => loadMitm({ force: true }));
  els.rulesSearch.addEventListener("input", renderRules);
  els.mitmSearch.addEventListener("input", renderMitm);
  els.importSelectedRules.addEventListener("click", importSelectedRules);

  els.parse.addEventListener("click", parseSelectedFile);
  els.downloadSelected.addEventListener("click", () => downloadArtifact([...selectedBundleIDs]));
  els.downloadAll.addEventListener("click", () => downloadArtifact(report?.apps.map((app) => app.bundleID) || []));
  els.selectAll.addEventListener("click", () => {
    for (const app of getFilteredApps()) selectedBundleIDs.add(app.bundleID);
    renderApps();
  });
  els.clearSelection.addEventListener("click", () => {
    selectedBundleIDs.clear();
    renderApps();
  });
  els.appSearch.addEventListener("input", renderApps);
}

function activateTab(name) {
  for (const tab of els.tabs) tab.classList.toggle("active", tab.dataset.tab === name);
  for (const panel of els.panels) panel.classList.toggle("active", panel.dataset.panel === name);
  if (name === "rules") void hydrateRuleMetadata(rules);
  if (name === "mitm") void hydrateMitmMetadata(mitmScripts);
  window.scrollTo(0, 0);
}

async function loadRepositoryData() {
  await Promise.allSettled([loadRules(), loadMitm()]);
}

async function loadRules({ force = false } = {}) {
  setLoading(els.refreshRules, true, "同步中");
  els.rulesStatus.textContent = "正在同步 GitHub main/rules/common...";
  try {
    const data = await fetchJson(`${COMMON_INDEX_URL}${force ? `?t=${Date.now()}` : ""}`);
    rules = (data.files || [])
      .filter((item) => item.output_path?.startsWith("common/") && item.output_path.endsWith(".arrs"))
      .map((item) => ({
        name: item.name,
        title: item.name,
        description: item.description || "Anywhere Routing Rule Set",
        ruleCount: item.rule_count ?? 0,
        skippedCount: item.skipped_count ?? 0,
        sources: item.sources || [],
        path: `rules/${item.output_path}`,
        rawUrl: `${RAW_BASE}/rules/${item.output_path}`,
        iconUrl: "",
      }));
    selectedRuleUrls = new Set([...selectedRuleUrls].filter((url) => rules.some((rule) => rule.rawUrl === url)));
    ruleMetadataPromise = undefined;
    renderRules();
    els.rulesStatus.textContent = `已同步 ${rules.length} 个 rules/common 规则集`;
    if (isTabActive("rules")) void hydrateRuleMetadata(rules, force);
  } catch (error) {
    rules = [];
    selectedRuleUrls.clear();
    renderRules();
    els.rulesStatus.textContent = `同步失败：${error.message}`;
    showToast("规则集同步失败，请稍后重试");
  } finally {
    setLoading(els.refreshRules, false, "同步远程");
  }
}

function renderRules() {
  const query = els.rulesSearch.value.trim().toLowerCase();
  const filtered = rules.filter((rule) => {
    const text = `${rule.title} ${rule.name} ${rule.description} ${rule.path}`.toLowerCase();
    return !query || text.includes(query);
  });

  els.rulesList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const rule of filtered) {
    const checked = selectedRuleUrls.has(rule.rawUrl);
    const card = document.createElement("article");
    card.className = `resource-card ${checked ? "selected" : ""}`;
    card.dataset.resourceUrl = rule.rawUrl;
    card.innerHTML = `
      <div class="resource-card-head">
        ${resourceIcon("globe", rule.iconUrl)}
        <label class="resource-select" aria-label="选择 ${escapeHtml(rule.name)}">
          <input class="row-select" type="checkbox" ${checked ? "checked" : ""}>
        </label>
      </div>
      <div class="resource-card-copy">
        <h3>${escapeHtml(rule.title)}</h3>
        <p>${escapeHtml(rule.description)}</p>
      </div>
      <div class="resource-meta">
        <span>${rule.ruleCount.toLocaleString()} 条规则</span>
        ${rule.skippedCount ? `<span>跳过 ${rule.skippedCount}</span>` : ""}
      </div>
      <div class="resource-actions">
        <a class="preview-link" href="${escapeHtml(rule.rawUrl)}" target="_blank" rel="noreferrer">查看 Raw</a>
        <button class="resource-import" type="button" aria-label="导入 ${escapeHtml(rule.title)}">一键导入</button>
      </div>
    `;
    card.querySelector(".row-select").addEventListener("change", (event) => {
      toggleRuleSelection(rule, event.currentTarget.checked);
    });
    card.querySelector(".resource-import").addEventListener("click", () => importRuleSet(rule));
    hydrateResourceIcon(card);
    fragment.append(card);
  }
  if (filtered.length === 0) fragment.append(emptyState("没有匹配的规则集"));
  els.rulesList.append(fragment);
  updateRuleImportButtons();
}

function toggleRuleSelection(rule, checked) {
  if (checked) selectedRuleUrls.add(rule.rawUrl);
  else selectedRuleUrls.delete(rule.rawUrl);
  renderRules();
}

function updateRuleImportButtons() {
  els.importSelectedRules.disabled = selectedRuleUrls.size === 0;
  els.importSelectedRules.textContent = selectedRuleUrls.size
    ? `导入所选 ${selectedRuleUrls.size}`
    : "导入所选";
}

function importRuleSet(rule) {
  if (!rule) return;
  openRuleSetImport([rule.rawUrl]);
}

function importSelectedRules() {
  const selected = rules
    .filter((rule) => selectedRuleUrls.has(rule.rawUrl))
    .map((rule) => rule.rawUrl);
  openRuleSetImport(selected);
}

async function loadMitm({ force = false } = {}) {
  setLoading(els.refreshMitm, true, "同步中");
  els.mitmStatus.textContent = "正在同步 GitHub main/mitm...";
  try {
    const data = await fetchJson(`${MITM_API_URL}${force ? `&t=${Date.now()}` : ""}`);
    const mitmFiles = data.filter((item) => item.type === "file");
    const rejectFiles = new Map(
      mitmFiles
        .filter((item) => item.name.endsWith(".arrs"))
        .map((item) => [item.name.toLowerCase(), item]),
    );
    mitmScripts = mitmFiles
      .filter((item) => item.name.endsWith(".amrs"))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        name: item.name.replace(/\.amrs$/i, ""),
        title: item.name.replace(/\.amrs$/i, ""),
        filename: item.name,
        path: item.path,
        sha: item.sha,
        rawUrl: `${RAW_BASE}/${item.path}`,
        reject: findRejectForMitm(item, rejectFiles),
        iconUrl: "",
      }));
    mitmMetadataPromise = undefined;
    renderMitm();
    els.mitmStatus.textContent = `已同步 ${mitmScripts.length} 个 MITM .amrs`;
    if (isTabActive("mitm")) void hydrateMitmMetadata(mitmScripts, force);
  } catch (error) {
    mitmScripts = [];
    renderMitm();
    els.mitmStatus.textContent = `同步失败：${error.message}`;
    showToast("MITM 脚本同步失败，请稍后重试");
  } finally {
    setLoading(els.refreshMitm, false, "同步远程");
  }
}

function renderMitm() {
  const query = els.mitmSearch.value.trim().toLowerCase();
  const filtered = mitmScripts.filter((script) => {
    const text = `${script.title} ${script.name} ${script.filename}`.toLowerCase();
    return !query || text.includes(query);
  });

  els.mitmList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const script of filtered) {
    const card = document.createElement("article");
    card.className = "resource-card mitm-card";
    card.dataset.resourceUrl = script.rawUrl;
    card.innerHTML = `
      <div class="resource-card-head">
        ${resourceIcon("anywhere", script.iconUrl)}
        <span class="resource-kind">MITM</span>
      </div>
      <div class="resource-card-copy">
        <h3>${escapeHtml(script.title)}</h3>
        <p>${script.reject ? "脚本与配套 Reject 规则将一并导入" : "实验性请求与响应改写脚本"}</p>
      </div>
      <div class="resource-meta">
        <span>.amrs</span>
        <span>${script.reject ? "含 Reject" : "脚本规则"}</span>
      </div>
      <div class="resource-actions">
        <a class="preview-link" href="${escapeHtml(script.rawUrl)}" target="_blank" rel="noreferrer">查看 Raw</a>
        <button class="resource-import" type="button" aria-label="导入 ${escapeHtml(script.title)}${script.reject ? " 和配套 Reject" : ""}">一键导入</button>
      </div>
    `;
    card.querySelector(".resource-import").addEventListener("click", () => importMitmSet(script));
    hydrateResourceIcon(card);
    fragment.append(card);
  }
  if (filtered.length === 0) fragment.append(emptyState("没有匹配的 MITM 脚本"));
  els.mitmList.append(fragment);
}

function importMitmSet(script) {
  if (!script) return;
  const links = [script.rawUrl];
  if (script.reject?.rawUrl) links.push(script.reject.rawUrl);
  openRuleSetImport(links);
}

async function parseSelectedFile() {
  const file = els.file.files?.[0];
  if (!file) {
    setStatus("请选择 iOS App 隐私报告 .ndjson 文件。");
    return;
  }

  setBusy(true);
  setStatus("正在本地解析报告...");
  els.progress.value = 0;
  els.preview.value = "";
  els.stats.innerHTML = "";
  els.apps.innerHTML = "";
  els.unresolved.innerHTML = "";
  els.appSearch.value = "";
  els.conversionResults.hidden = true;
  els.unresolvedPanel.hidden = true;
  selectedBundleIDs.clear();

  const worker = new Worker("./report-worker.js", { type: "module" });
  worker.onmessage = (event) => {
    const { type, progress, report: nextReport, message } = event.data || {};
    if (type === "progress") {
      els.progress.value = Math.min(95, Math.floor(progress.lineCount / 1000));
      setStatus(
        `已读取 ${progress.lineCount.toLocaleString()} 行，网络记录 ${progress.networkCount.toLocaleString()} 条，代理容器目标 ${progress.proxyTargetCount.toLocaleString()} 个。`,
      );
    }
    if (type === "done") {
      worker.terminate();
      report = nextReport;
      selectedBundleIDs = new Set(report.apps.slice(0, 1).map((app) => app.bundleID));
      els.progress.value = 100;
      setBusy(false);
      renderReport();
    }
    if (type === "error") {
      worker.terminate();
      setBusy(false);
      setStatus(`解析失败：${message}`);
    }
  };
  worker.onerror = (event) => {
    worker.terminate();
    setBusy(false);
    setStatus(`解析失败：${event.message || "Worker 运行异常"}`);
  };

  worker.postMessage({
    file,
    options: {
      filters: {
        fakeIp: els.filterFake.checked,
        privateIp: els.filterPrivate.checked,
        localIp: els.filterLocal.checked,
      },
      attribution: {
        allowSharedExact: els.allowShared.checked,
      },
    },
  });
}

function renderReport() {
  if (!report) return;
  const summary = report.attributionSummary;
  setStatus(
    `完成：${report.networkCount.toLocaleString()} 条网络记录，${report.apps.length.toLocaleString()} 个应用，${summary.unresolvedCount.toLocaleString()} 个代理容器目标待确认。`,
  );

  els.stats.innerHTML = `
    <div><strong>${report.networkCount.toLocaleString()}</strong><span>网络记录</span></div>
    <div><strong>${report.apps.length.toLocaleString()}</strong><span>应用</span></div>
    <div><strong>${(report.proxyTargets?.length || 0).toLocaleString()}</strong><span>代理容器目标</span></div>
    <div><strong>${summary.unresolvedCount.toLocaleString()}</strong><span>待确认</span></div>
  `;

  els.conversionResults.hidden = false;
  els.unresolvedPanel.hidden = !report.unresolvedProxyTargets?.length;
  renderApps();
  renderUnresolved();
}

function renderApps() {
  if (!report) return;
  els.apps.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const apps = getFilteredApps();

  for (const app of apps) {
    const row = document.createElement("label");
    row.className = "app-row";
    row.innerHTML = `
      <input type="checkbox" ${selectedBundleIDs.has(app.bundleID) ? "checked" : ""}>
      <span class="app-main">
        <span class="app-name">${escapeHtml(displayBundleName(app.bundleID))}</span>
        <span class="app-meta">${app.count.toLocaleString()} 条规则候选 · hits ${app.hits.toLocaleString()}</span>
      </span>
      <button type="button" class="ghost">预览</button>
    `;
    const checkbox = row.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedBundleIDs.add(app.bundleID);
      else selectedBundleIDs.delete(app.bundleID);
      updateButtons();
    });
    row.querySelector("button").addEventListener("click", (event) => {
      event.preventDefault();
      showPreview(app.bundleID);
    });
    fragment.append(row);
  }

  if (apps.length === 0) fragment.append(emptyState("没有匹配的应用"));

  els.apps.append(fragment);
  updateButtons();
  if (apps[0]) showPreview(apps[0].bundleID);
  else els.preview.value = "";
}

function renderUnresolved() {
  if (!report) return;
  const targets = report.unresolvedProxyTargets || [];
  els.unresolved.innerHTML = targets
    .slice(0, 80)
    .map((target) => {
      const candidates = target.candidateApps?.length
        ? `候选：${target.candidateApps.slice(0, 3).join(", ")}`
        : "未找到可靠候选";
      return `<li><code>${escapeHtml(target.value)}</code><span>${target.hits.toLocaleString()} hits · ${escapeHtml(target.attribution)} · ${escapeHtml(candidates)}</span></li>`;
    })
    .join("");
}

function showPreview(bundleID) {
  const app = report?.apps.find((item) => item.bundleID === bundleID);
  if (!app) return;
  const files = buildFilesForApp(app);
  els.preview.value = files[0]?.content.split("\n").slice(0, 180).join("\n") || "";
}

function downloadArtifact(bundleIDs) {
  if (!report || bundleIDs.length === 0) return;
  revokeUrls();
  const files = buildFilesForBundles(bundleIDs);
  if (files.length === 0) return;

  const singleFile = files.length === 1;
  const blob = singleFile
    ? new Blob([files[0].content], { type: "text/plain;charset=utf-8" })
    : createZip(files);
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  const link = document.createElement("a");
  link.href = url;
  link.download = singleFile ? files[0].filename : "anywhere-app-rules.zip";
  link.click();
}

function buildFilesForBundles(bundleIDs) {
  const files = [];
  for (const bundleID of bundleIDs) {
    const app = report.apps.find((item) => item.bundleID === bundleID);
    if (app) files.push(...buildFilesForApp(app));
  }
  return files;
}

function buildFilesForApp(app) {
  const rules = targetsToRules(app.targets);
  return buildArrsFiles(readableRuleSetName(app), rules, {
    bundleID: app.bundleID,
    generatedAt: new Date().toISOString(),
    note: "Generated locally in browser; proxy-container traffic is attributed conservatively.",
  });
}

function readableRuleSetName(app) {
  const label = displayBundleName(app.bundleID);
  const name = label.includes("(") ? label.slice(0, label.lastIndexOf("(")).trim() : label;
  return name || app.bundleID;
}

function getFilteredApps() {
  if (!report) return [];
  const query = els.appSearch.value.trim().toLowerCase();
  if (!query) return report.apps;
  return report.apps.filter((app) => {
    const display = displayBundleName(app.bundleID).toLowerCase();
    return display.includes(query) || app.bundleID.toLowerCase().includes(query);
  });
}

function updateButtons() {
  const hasSelection = selectedBundleIDs.size > 0;
  els.downloadSelected.disabled = !hasSelection;
  els.downloadAll.disabled = !report?.apps.length;
  if (!report) return;

  if (!hasSelection) {
    els.downloadSelected.textContent = "下载所选";
  } else {
    const count = buildFilesForBundles([...selectedBundleIDs]).length;
    els.downloadSelected.textContent = count === 1 ? "下载所选 .arrs" : "下载所选 ZIP";
  }

  const allCount = buildFilesForBundles(report.apps.map((app) => app.bundleID)).length;
  els.downloadAll.textContent = allCount === 1 ? "下载全部 .arrs" : "下载全部 ZIP";
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function openRuleSetImport(links) {
  const validLinks = links.filter(Boolean);
  if (validLinks.length === 0) return;
  const query = validLinks.map((link) => `link=${encodeURIComponent(link)}`).join("&");
  window.location.href = `anywhere://add-rule-set?${query}`;
  showToast(`正在打开 Anywhere 导入 ${validLinks.length} 个规则集`);
}

function findRejectForMitm(item, rejectFiles) {
  const baseName = item.name.replace(/\.amrs$/i, "");
  const candidates = [
    `${baseName}Reject.arrs`,
    `${baseName.replace(/(?:BlockAD|PriceUnlock|Unlock)$/i, "")}Reject.arrs`,
  ];
  const reject = candidates
    .map((name) => rejectFiles.get(name.toLowerCase()))
    .find(Boolean);

  return reject
    ? {
        name: reject.name,
        filename: reject.name,
        path: reject.path,
        rawUrl: `${RAW_BASE}/${reject.path}`,
      }
    : null;
}

function isTabActive(name) {
  return els.panels.some((panel) => panel.dataset.panel === name && panel.classList.contains("active"));
}

function hydrateRuleMetadata(ruleSets, force = false) {
  if (ruleMetadataPromise || ruleSets.length === 0) return ruleMetadataPromise;
  ruleMetadataPromise = hydrateResourceMetadata({
    resources: ruleSets,
    currentResources: () => rules,
    list: els.rulesList,
    fallbackIcon: "globe",
    force,
  }).finally(() => {
    if (rules === ruleSets) ruleMetadataPromise = undefined;
  });
  return ruleMetadataPromise;
}

function hydrateMitmMetadata(scripts, force = false) {
  if (mitmMetadataPromise || scripts.length === 0) return mitmMetadataPromise;
  mitmMetadataPromise = hydrateResourceMetadata({
    resources: scripts,
    currentResources: () => mitmScripts,
    list: els.mitmList,
    fallbackIcon: "anywhere",
    force,
  }).finally(() => {
    if (mitmScripts === scripts) mitmMetadataPromise = undefined;
  });
  return mitmMetadataPromise;
}

async function hydrateResourceMetadata({ resources, currentResources, list, fallbackIcon, force }) {
  const pendingResources = resources
    .map((resource, index) => ({ resource, index }))
    .filter(({ resource }) => !resource.metadataLoaded);

  await mapWithConcurrency(pendingResources, async ({ resource, index }) => {
    const metadata = await fetchRuleSetMetadata(resource.rawUrl, resource, force);
    if (currentResources() !== resources) return;
    const hydratedResource = { ...resources[index], ...metadata, metadataLoaded: true };
    resources[index] = hydratedResource;
    updateResourceCard(list, hydratedResource, fallbackIcon);
  });
}

function updateResourceCard(list, resource, fallbackIcon) {
  const card = [...list.querySelectorAll("[data-resource-url]")]
    .find((element) => element.dataset.resourceUrl === resource.rawUrl);
  if (!card) return;

  const icon = card.querySelector(".resource-icon");
  if (icon) {
    const template = document.createElement("template");
    template.innerHTML = resourceIcon(fallbackIcon, resource.iconUrl).trim();
    icon.replaceWith(template.content.firstElementChild);
    hydrateResourceIcon(card);
  }

  card.querySelector("h3").textContent = resource.title;
  const importButton = card.querySelector(".resource-import");
  if (importButton) {
    importButton.setAttribute("aria-label", `导入 ${resource.title}${resource.reject ? " 和配套 Reject" : ""}`);
  }
}

async function fetchRuleSetMetadata(rawUrl, fallback, force) {
  const controller = new AbortController();
  let reader;
  try {
    const response = await fetch(`${rawUrl}${force ? `?t=${Date.now()}` : ""}`, {
      cache: force ? "no-store" : "force-cache",
      signal: controller.signal,
    });
    if (!response.ok || !response.body) return fallback;

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let source = "";
    while (source.length < 256 * 1024) {
      const { done, value } = await reader.read();
      if (done) break;
      source += decoder.decode(value, { stream: true });
      const metadata = readRuleSetMetadata(source);
      if (metadata.title && metadata.iconUrl) return { ...fallback, ...metadata };
    }
    return { ...fallback, ...readRuleSetMetadata(source) };
  } catch {
    return fallback;
  } finally {
    if (reader) void reader.cancel().catch(() => {});
    controller.abort();
  }
}

function readRuleSetMetadata(source) {
  const title = source.match(/^\s*name\s*=\s*(.+?)\s*$/im)?.[1]
    || source.match(/^\s*#\s*NAME\s*:\s*(.+?)\s*$/im)?.[1]
    || "";
  const iconBase64 = source.match(/^\s*icon-light\s*=\s*([A-Za-z0-9+/=]+)\s*$/im)?.[1] || "";
  return {
    ...(title ? { title } : {}),
    ...(iconBase64 ? { iconUrl: `data:image/png;base64,${iconBase64}` } : {}),
  };
}

async function mapWithConcurrency(items, mapper, limit = 6) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function resourceIcon(fallback, iconUrl = "") {
  const fallbackMarkup = fallback === "globe"
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.1 2.4 3.1 5.2 3.1 8.5s-1 6.1-3.1 8.5c-2.1-2.4-3.1-5.2-3.1-8.5s1-6.1 3.1-8.5Z"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 18.5 12 4l7 14.5-3.6-1.8H8.6L5 18.5Z"/><path d="M9.2 14.2h5.6"/></svg>`;
  if (!iconUrl) {
    return `<span class="resource-icon fallback-icon ${fallback}" aria-hidden="true">${fallbackMarkup}</span>`;
  }
  return `<span class="resource-icon app-icon"><img src="${iconUrl}" alt="" width="52" height="52" decoding="sync"><span class="fallback-icon ${fallback}" aria-hidden="true">${fallbackMarkup}</span></span>`;
}

function hydrateResourceIcon(container) {
  const image = container.querySelector(".app-icon img");
  if (!image) return;
  const reveal = () => {
    try {
      normalizeResourceIcon(image);
    } catch {
      // Keep the source icon at its original scale if its pixels cannot be read.
    }
    image.classList.add("ready");
  };
  image.addEventListener("load", reveal, { once: true });
  image.addEventListener("error", () => {
    image.hidden = true;
  });
  if (image.complete && image.naturalWidth > 0) reveal();
}

function normalizeResourceIcon(image) {
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) return;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return;
  const contentFill = Math.min((right - left + 1) / width, (bottom - top + 1) / height);
  if (contentFill < 0.8) image.style.setProperty("--icon-scale", String(Math.min(1.08, 0.84 / contentFill)));
}

function setBusy(busy) {
  els.parse.disabled = busy;
  els.file.disabled = busy;
}

function setLoading(button, loading, text) {
  button.disabled = loading;
  button.textContent = text;
}

function setStatus(text) {
  els.status.textContent = text;
}

function revokeUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
}

function emptyState(text) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = text;
  return empty;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function initTheme() {
  const stored = localStorage.getItem("theme");
  applyTheme(stored || "light");
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", next);
  applyTheme(next);
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalized;
  els.themeToggle.setAttribute(
    "aria-label",
    normalized === "dark" ? "切换浅色模式" : "切换深色模式",
  );
  els.themeToggle.setAttribute("aria-pressed", String(normalized === "dark"));
}
