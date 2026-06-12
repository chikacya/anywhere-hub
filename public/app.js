import { buildArrsFiles, targetsToRules } from "./lib/arrs.mjs";
import { displayBundleName } from "./lib/bundle-names.mjs";
import { createZip } from "./lib/zip.mjs";

const els = {
  file: document.querySelector("#file"),
  parse: document.querySelector("#parse"),
  status: document.querySelector("#status"),
  progress: document.querySelector("#progress"),
  stats: document.querySelector("#stats"),
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
  themeToggle: document.querySelector("#themeToggle"),
};

let report = null;
let selectedBundleIDs = new Set();
let objectUrls = [];

initTheme();
els.parse.addEventListener("click", parseSelectedFile);
els.downloadSelected.addEventListener("click", () => downloadArtifact([...selectedBundleIDs]));
els.downloadAll.addEventListener("click", () => downloadArtifact(report?.apps.map((app) => app.bundleID) || []));
els.themeToggle.addEventListener("click", toggleTheme);
els.selectAll.addEventListener("click", () => {
  for (const app of getFilteredApps()) selectedBundleIDs.add(app.bundleID);
  renderApps();
});
els.clearSelection.addEventListener("click", () => {
  selectedBundleIDs.clear();
  renderApps();
});
els.appSearch.addEventListener("input", renderApps);

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
  els.apps.innerHTML = "";
  els.unresolved.innerHTML = "";
  els.appSearch.value = "";
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
    <div><strong>${report.lineCount.toLocaleString()}</strong><span>读取行数</span></div>
    <div><strong>${report.networkCount.toLocaleString()}</strong><span>网络记录</span></div>
    <div><strong>${report.apps.length.toLocaleString()}</strong><span>应用</span></div>
    <div><strong>${(report.proxyTargets?.length || 0).toLocaleString()}</strong><span>代理容器目标</span></div>
    <div><strong>${summary.exactCount.toLocaleString()}</strong><span>精确归因</span></div>
    <div><strong>${summary.suffixCount.toLocaleString()}</strong><span>后缀归因</span></div>
    <div><strong>${summary.unresolvedCount.toLocaleString()}</strong><span>待确认</span></div>
    <div><strong>${report.filteredSpecialCount.toLocaleString()}</strong><span>过滤 IP</span></div>
  `;

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

  if (apps.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "没有匹配的应用";
    fragment.append(empty);
  }

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

function setBusy(busy) {
  els.parse.disabled = busy;
  els.file.disabled = busy;
}

function setStatus(text) {
  els.status.textContent = text;
}

function revokeUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
