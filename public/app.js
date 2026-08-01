import { buildArrsFiles, targetsToRules } from "./lib/arrs.mjs";
import { displayBundleName } from "./lib/bundle-names.mjs";
import { createZip } from "./lib/zip.mjs";

const RAW_BASE = "https://raw.githubusercontent.com/chikacya/anywhere-rules/main";
const COMMON_INDEX_URL = `${RAW_BASE}/rules/common/index.json`;
const MITM_API_URL = "https://api.github.com/repos/chikacya/anywhere-rules/contents/mitm?ref=main";
const ICON_BASE = "https://raw.githubusercontent.com/luestr/IconResource/main/App_icon/120px";
const OTHER_ICON_BASE = "https://raw.githubusercontent.com/luestr/IconResource/main/Other_icon/120px";
const LARGE_ICON_BASE = "https://raw.githubusercontent.com/luestr/IconResource/main/App_icon/1024px";
const ICON_RAW_BASE = "https://raw.githubusercontent.com/luestr/IconResource/main";
const ICON_TREE_URL = "https://api.github.com/repos/luestr/IconResource/git/trees/main?recursive=1";
const APP_STORE_ICON_URL = `${OTHER_ICON_BASE}/AppStore.png`;
const XIAOHONGSHU_ICON_URL = `${LARGE_ICON_BASE}/${encodeURIComponent("小红书.png")}`;
const FANQIE_NOVEL_ICON_URL = `${LARGE_ICON_BASE}/${encodeURIComponent("番茄小说.png")}`;
const PIXIV_ICON_URL = `${LARGE_ICON_BASE}/pixiv.png`;
const APPLE_MAPS_ICON_URL = "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/67/05/f8/6705f876-0db2-711d-0d42-524ef6432165/maps-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/120x120bb.jpg";
const ONEDRIVE_ICON_URL = "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/68/bd/d6/68bdd6c8-0699-a2e2-ec51-3e0c5333798a/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/120x120bb.jpg";
const FACEBOOK_ICON_URL = "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/f9/16/25/f91625c5-c207-b2db-9994-0cf496af8154/Icon-Production-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/120x120bb.jpg";
const STEAM_ICON_URL = `${LARGE_ICON_BASE}/Steam_Mobile.png`;
const MITM_APP_ICONS = {
  AmapBlockAD: "Amap.png",
  AppleWLOC: APP_STORE_ICON_URL,
  AppleWLOCArg: APP_STORE_ICON_URL,
  BilibiliBlockAD: "Bilibili.png",
  FanQieNovelBlockAD: FANQIE_NOVEL_ICON_URL,
  GoogleCNRedirect: "Google.png",
  HupuBlockAD: "HUPU.png",
  JDPriceUnlock: "JD.png",
  KuanBlockAD: "CoolApk.png",
  PinduoduoBlockAD: "PinDuoDuo.png",
  PixivBlockAD: PIXIV_ICON_URL,
  SMZDMBlockAD: "smzdm.png",
  SpotifyUnlock: "Spotify.png",
  TelegramToSwiftgram: "Telegram.png",
  TelegramToTurrit: "Telegram.png",
  WangyiyunBlockAD: "NeteaseCloudMusic.png",
  WangyiyunBlockADArg: "NeteaseCloudMusic.png",
  WeiboBlockAD: "Weibo.png",
  XiaohongshuBlockAD: XIAOHONGSHU_ICON_URL,
  XimalayaBlockAD: "Himalaya.png",
  YouTubeBlockAD: "YouTube.png",
  YouTubeBlockADDualSubsArg: "YouTube.png",
  iRingoMaps: APPLE_MAPS_ICON_URL,
  iRingoMapsArg: APPLE_MAPS_ICON_URL,
  iRingoWeatherKit: "AppleWeather.png",
  iRingoWeatherKitArg: "AppleWeather.png",
  XwebBlockAD: "X.png",
};
const RULE_APP_ICONS = {
  AppleCN: APP_STORE_ICON_URL,
  AppleProxy: APP_STORE_ICON_URL,
  Apple: APP_STORE_ICON_URL,
  AppleServices: APP_STORE_ICON_URL,
  AppleMusic: APP_STORE_ICON_URL,
  Google: "Google.png",
  YouTube: "YouTube.png",
  Microsoft: "MicrosoftCopilot.png",
  GitHub: "GitHub.png",
  Telegram: "Telegram.png",
  Telegram_NoIP: "Telegram.png",
  Twitter: "X.png",
  OneDrive: ONEDRIVE_ICON_URL,
  Instagram: "Instagram.png",
  Facebook: FACEBOOK_ICON_URL,
  Netflix: "Netflix.png",
  Disney: "Disney+.png",
  Spotify: "Spotify.png",
  TikTok: "TikTok.png",
  Bilibili: "Bilibili.png",
  WeChat: "Weixin.png",
  PayPal: "PayPal.png",
  Steam: STEAM_ICON_URL,
};

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
let iconManifestPromise;

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
        description: item.description || "Anywhere Routing Rule Set",
        ruleCount: item.rule_count ?? 0,
        skippedCount: item.skipped_count ?? 0,
        sources: item.sources || [],
        path: `rules/${item.output_path}`,
        rawUrl: `${RAW_BASE}/rules/${item.output_path}`,
        iconUrl: iconUrlForRule(item.name),
      }));
    selectedRuleUrls = new Set([...selectedRuleUrls].filter((url) => rules.some((rule) => rule.rawUrl === url)));
    renderRules();
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
    const card = document.createElement("article");
    card.className = `resource-card ${checked ? "selected" : ""}`;
    card.innerHTML = `
      <div class="resource-card-head">
        ${resourceIcon("globe", rule.iconUrl)}
        <label class="resource-select" aria-label="选择 ${escapeHtml(rule.name)}">
          <input class="row-select" type="checkbox" ${checked ? "checked" : ""}>
        </label>
      </div>
      <div class="resource-card-copy">
        <h3>${escapeHtml(rule.name)}</h3>
        <p>${escapeHtml(rule.description)}</p>
      </div>
      <div class="resource-meta">
        <span>${rule.ruleCount.toLocaleString()} 条规则</span>
        ${rule.skippedCount ? `<span>跳过 ${rule.skippedCount}</span>` : ""}
      </div>
      <div class="resource-actions">
        <a class="preview-link" href="${escapeHtml(rule.rawUrl)}" target="_blank" rel="noreferrer">查看 Raw</a>
        <button class="resource-import" type="button" aria-label="导入 ${escapeHtml(rule.name)}">一键导入</button>
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
        iconUrl: iconUrlForMitm(item.name.replace(/\.amrs$/i, "")),
      }));
    renderMitm();
    els.mitmStatus.textContent = `已同步 ${mitmScripts.length} 个 MITM .amrs`;
    void hydrateMitmMetadata(mitmScripts, force);
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

async function hydrateMitmMetadata(scripts, force) {
  const [titledScripts, iconManifest] = await Promise.all([
    Promise.all(
      scripts.map(async (script) => ({
        ...script,
        title: await fetchRuleSetTitle(script.rawUrl, script.title, force),
      })),
    ),
    getIconManifest().catch(() => []),
  ]);
  if (mitmScripts !== scripts) return;
  mitmScripts = titledScripts.map((script) => ({
    ...script,
    iconUrl: script.iconUrl || findAutomaticIcon(iconManifest, [script.title, script.name]),
  }));
  renderMitm();
}

async function fetchRuleSetTitle(rawUrl, fallback, force) {
  const controller = new AbortController();
  try {
    const response = await fetch(`${rawUrl}${force ? `?t=${Date.now()}` : ""}`, {
      cache: force ? "no-store" : "force-cache",
      signal: controller.signal,
    });
    if (!response.ok || !response.body) return fallback;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let source = "";
    while (source.length < 4096) {
      const { done, value } = await reader.read();
      if (done) break;
      source += decoder.decode(value, { stream: true });
      const title = readRuleSetTitle(source);
      if (title) return title;
    }
    return readRuleSetTitle(source) || fallback;
  } catch {
    return fallback;
  } finally {
    controller.abort();
  }
}

function readRuleSetTitle(source) {
  const match = source.match(/^\s*name\s*=\s*(.+?)\s*$/im) || source.match(/^\s*#\s*NAME\s*:\s*(.+?)\s*$/im);
  return match?.[1] || "";
}

async function getIconManifest() {
  if (!iconManifestPromise) {
    iconManifestPromise = fetch(ICON_TREE_URL, {
      cache: "force-cache",
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => (data.tree || [])
        .filter((item) => item.type === "blob" && /^App_icon\/(?:120px|1024px)\/.+\.(?:png|jpe?g|webp)$/i.test(item.path))
        .map((item) => ({
          key: normalizeIconKey(item.path.split("/").pop().replace(/\.[^.]+$/, "")),
          url: `${ICON_RAW_BASE}/${item.path}`,
          small: item.path.startsWith("App_icon/120px/"),
        }))
        .filter((item) => item.key),
      )
      .catch((error) => {
        iconManifestPromise = undefined;
        throw error;
      });
  }
  return iconManifestPromise;
}

function findAutomaticIcon(manifest, values) {
  const keys = values.flatMap(iconSearchKeys);
  let match = null;
  for (const icon of manifest) {
    for (const key of keys) {
      const minimumLength = /[\u3400-\u9fff]/.test(key) ? 2 : 4;
      if (key.length < minimumLength) continue;
      let score = 0;
      if (icon.key === key) score = 1000;
      else if (icon.key.includes(key)) score = 500 + key.length;
      else if (key.includes(icon.key) && icon.key.length >= minimumLength) score = 300 + icon.key.length;
      if (!score) continue;
      score += icon.small ? 10 : 0;
      if (!match || score > match.score) match = { score, url: icon.url };
    }
  }
  return match?.url || "";
}

function iconSearchKeys(value) {
  const full = normalizeIconKey(value);
  const concise = normalizeIconKey(String(value)
    .replace(/blockad|adblock|priceunlock|unlock|redirect|anywhere|mitm|ruleset|script|arg/gi, "")
    .replace(/去广告|去水印|增强版|基础版|参数版|净化合并版|广告修正|定位修改|跳转|解锁/g, ""));
  return [...new Set([full, concise].filter(Boolean))];
}

function normalizeIconKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function iconUrlForMitm(name) {
  return iconUrlFromMapping(MITM_APP_ICONS[name]);
}

function iconUrlForRule(name) {
  return iconUrlFromMapping(RULE_APP_ICONS[name]);
}

function iconUrlFromMapping(value) {
  if (!value) return "";
  return value.startsWith("https://") ? value : `${ICON_BASE}/${value}`;
}

function resourceIcon(fallback, iconUrl = "") {
  const fallbackMarkup = fallback === "globe"
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.1 2.4 3.1 5.2 3.1 8.5s-1 6.1-3.1 8.5c-2.1-2.4-3.1-5.2-3.1-8.5s1-6.1 3.1-8.5Z"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 18.5 12 4l7 14.5-3.6-1.8H8.6L5 18.5Z"/><path d="M9.2 14.2h5.6"/></svg>`;
  if (!iconUrl) {
    return `<span class="resource-icon fallback-icon ${fallback}" aria-hidden="true">${fallbackMarkup}</span>`;
  }
  return `<span class="resource-icon app-icon"><img src="${iconUrl}" alt="" width="52" height="52" decoding="async"><span class="fallback-icon ${fallback}" hidden aria-hidden="true">${fallbackMarkup}</span></span>`;
}

function hydrateResourceIcon(container) {
  const image = container.querySelector(".app-icon img");
  if (!image) return;
  image.addEventListener("error", () => {
    image.hidden = true;
    image.nextElementSibling.hidden = false;
  });
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
