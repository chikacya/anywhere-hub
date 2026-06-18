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
  rulePreviewTitle: document.querySelector("#rulePreviewTitle"),
  rulePreviewDescription: document.querySelector("#rulePreviewDescription"),
  rulePreviewCode: document.querySelector("#rulePreviewCode"),
  importSelectedRules: document.querySelector("#importSelectedRules"),
  importRuleCurrent: document.querySelector("#importRuleCurrent"),

  refreshMitm: document.querySelector("#refreshMitm"),
  mitmStatus: document.querySelector("#mitmStatus"),
  mitmSearch: document.querySelector("#mitmSearch"),
  mitmList: document.querySelector("#mitmList"),
  mitmPreviewTitle: document.querySelector("#mitmPreviewTitle"),
  mitmPreviewDescription: document.querySelector("#mitmPreviewDescription"),
  mitmPreviewCode: document.querySelector("#mitmPreviewCode"),
  importMitmCurrent: document.querySelector("#importMitmCurrent"),

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
let selectedRule = null;
let selectedRuleUrls = new Set();
let mitmScripts = [];
let selectedMitm = null;
let toastTimer;

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
  els.importRuleCurrent.addEventListener("click", () => importRuleSet(selectedRule));
  els.importMitmCurrent.addEventListener("click", () => importMitmSet(selectedMitm));

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
  window.scrollTo({ top: 0, behavior: "smooth" });
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
      .map((item, index) => ({
        name: item.name,
        description: item.description || "Anywhere Routing Rule Set",
        ruleCount: item.rule_count ?? 0,
        skippedCount: item.skipped_count ?? 0,
        sources: item.sources || [],
        path: `rules/${item.output_path}`,
        rawUrl: `${RAW_BASE}/rules/${item.output_path}`,
        color: colorForIndex(index),
      }));
    selectedRuleUrls = new Set([...selectedRuleUrls].filter((url) => rules.some((rule) => rule.rawUrl === url)));
    renderRules();
    if (rules[0]) selectRule(rules[0]);
    els.rulesStatus.textContent = `已同步 ${rules.length} 个 rules/common 规则集`;
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
    const text = `${rule.name} ${rule.description} ${rule.path}`.toLowerCase();
    return !query || text.includes(query);
  });

  els.rulesList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const rule of filtered) {
    const checked = selectedRuleUrls.has(rule.rawUrl);
    const row = document.createElement("div");
    row.className = `row raw-row selectable ${selectedRule?.name === rule.name ? "active" : ""} ${checked ? "selected" : ""}`;
    row.innerHTML = `
      <label class="row-check" aria-label="选择 ${escapeHtml(rule.name)}">
        <input class="row-select" type="checkbox" ${checked ? "checked" : ""}>
      </label>
      <button class="row-main" type="button">
        <span class="glyph ${rule.color}">${escapeHtml(rule.name.slice(0, 2))}</span>
        <span>
          <b>${escapeHtml(rule.name)}</b>
          <small>${rule.ruleCount.toLocaleString()} rules · ${escapeHtml(rule.description)}</small>
        </span>
        <i>预览</i>
      </button>
      <button class="row-copy" type="button" aria-label="导入 ${escapeHtml(rule.name)}">导入</button>
    `;
    row.querySelector(".row-select").addEventListener("change", (event) => {
      toggleRuleSelection(rule, event.currentTarget.checked);
    });
    row.querySelector(".row-main").addEventListener("click", () => selectRule(rule));
    row.querySelector(".row-copy").addEventListener("click", () => importRuleSet(rule));
    fragment.append(row);
  }
  if (filtered.length === 0) fragment.append(emptyState("没有匹配的规则集"));
  els.rulesList.append(fragment);
  updateRuleImportButtons();
}

async function selectRule(rule) {
  selectedRule = rule;
  renderRules();
  updateRuleImportButtons();
  els.rulePreviewTitle.textContent = rule.name;
  els.rulePreviewDescription.textContent = `${rule.description} · ${rule.ruleCount.toLocaleString()} 条规则${rule.skippedCount ? ` · 跳过 ${rule.skippedCount} 条不兼容规则` : ""}`;
  els.rulePreviewCode.textContent = `${rule.rawUrl}\n\n正在加载预览...`;
  try {
    const content = await fetchText(withCacheBust(rule.rawUrl));
    els.rulePreviewCode.textContent = previewText(content, rule.rawUrl);
  } catch {
    els.rulePreviewCode.textContent = rule.rawUrl;
  }
}

function toggleRuleSelection(rule, checked) {
  if (checked) selectedRuleUrls.add(rule.rawUrl);
  else selectedRuleUrls.delete(rule.rawUrl);
  renderRules();
}

function updateRuleImportButtons() {
  els.importRuleCurrent.disabled = !selectedRule;
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
      .map((item, index) => ({
        name: item.name.replace(/\.amrs$/i, ""),
        filename: item.name,
        path: item.path,
        sha: item.sha,
        rawUrl: `${RAW_BASE}/${item.path}`,
        reject: findRejectForMitm(item, rejectFiles),
        color: colorForIndex(index + 2),
      }));
    renderMitm();
    if (mitmScripts[0]) selectMitm(mitmScripts[0]);
    els.mitmStatus.textContent = `已同步 ${mitmScripts.length} 个实验性 .amrs`;
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
    const text = `${script.name} ${script.filename}`.toLowerCase();
    return !query || text.includes(query);
  });

  els.mitmList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const script of filtered) {
    const row = document.createElement("div");
    row.className = `row raw-row ${selectedMitm?.filename === script.filename ? "active" : ""}`;
    row.innerHTML = `
      <button class="row-main" type="button">
        <span class="glyph ${script.color}">MITM</span>
        <span>
          <b>${escapeHtml(script.name)}</b>
          <small>实验性 · ${escapeHtml(script.filename)}</small>
        </span>
        <i>预览</i>
      </button>
      <div class="raw-actions" aria-label="${escapeHtml(script.name)} 导入操作">
        <button class="row-copy" type="button" aria-label="导入 ${escapeHtml(script.name)}${script.reject ? " 和配套 Reject" : ""}">导入</button>
      </div>
    `;
    row.querySelector(".row-main").addEventListener("click", () => selectMitm(script));
    row.querySelector(".row-copy").addEventListener("click", () => importMitmSet(script));
    fragment.append(row);
  }
  if (filtered.length === 0) fragment.append(emptyState("没有匹配的 MITM 脚本"));
  els.mitmList.append(fragment);
}

async function selectMitm(script) {
  selectedMitm = script;
  renderMitm();
  els.importMitmCurrent.disabled = false;
  els.mitmPreviewTitle.textContent = script.name;
  els.mitmPreviewDescription.textContent = "实验性 MITM 规则集，仅供交流与学习。请审阅内容后再导入 Anywhere。";
  els.mitmPreviewCode.textContent = `${script.rawUrl}\n\n正在加载预览...`;
  try {
    const content = await fetchText(withCacheBust(script.rawUrl));
    const meta = parseMitmMeta(content);
    els.mitmPreviewTitle.textContent = meta.name || script.name;
    els.mitmPreviewDescription.textContent = `${meta.hostnameCount.toLocaleString()} 个 hostname · ${meta.ruleCount.toLocaleString()} 条规则 · 实验性功能，仅供交流与学习`;
    els.mitmPreviewCode.textContent = previewText(content, script.rawUrl);
  } catch {
    els.mitmPreviewCode.textContent = script.rawUrl;
  }
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

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function withCacheBust(url) {
  return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

function previewText(content, rawUrl) {
  const lines = content.split("\n").slice(0, 160).join("\n");
  return `${rawUrl}\n\n${lines}`;
}

function parseMitmMeta(content) {
  const lines = content.split(/\r?\n/);
  const name = lines.find((line) => line.trim().startsWith("name = "))?.split("=").slice(1).join("=").trim();
  const hostLine = lines.find((line) => line.trim().startsWith("hostname = "));
  const hostnameCount = hostLine
    ? hostLine.split("=").slice(1).join("=").split(",").map((item) => item.trim()).filter(Boolean).length
    : 0;
  const ruleCount = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("name =") && !trimmed.startsWith("hostname =");
  }).length;
  return { name, hostnameCount, ruleCount };
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

function colorForIndex(index) {
  return ["purple", "blue", "red", "orange", "pink", "green", "indigo", "gray"][index % 8];
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
  const preferred = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(stored || preferred);
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
