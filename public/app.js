import {initializeStartupSelector} from './lib/startup-selector.mjs';
let startupSelector;
import { buildArrsFiles, targetsToRules } from "./lib/arrs.mjs";
import { displayBundleName } from "./lib/bundle-names.mjs";
import { createZip } from "./lib/zip.mjs";
import { enrichMitmFollows, hasMitmUpdate, mitmVersion, readMitmFollows, saveMitmFollows } from "./lib/mitm-updates.mjs?v=20260928-hub-updates3";

const RAW_BASE = "https://raw.githubusercontent.com/chikacya/anywhere-rules/main";
const COMMON_INDEX_URL = `${RAW_BASE}/rules/common/index.json`;
const BK7_INDEX_URL = `${RAW_BASE}/rules/index.json`;
const MITM_API_URL = "https://api.github.com/repos/chikacya/anywhere-rules/contents/mitm?ref=main";
const CATALOG_URLS = { common: "./api/catalog/common", mitm: "./api/catalog/mitm" };
const METADATA_URLS = {
  common: "./resource-metadata-common.json",
  mitm: "./resource-metadata-mitm.json",
};
const METADATA_READ_BYTES = 48 * 1024;
const BK7_PAGE_SIZE = 72;
const MAX_IMPORT_LINKS = 48;
const CATALOG_REFRESH_MS = 2 * 60 * 1000;
const BK7_SELECTION_KEY = "anywhere-hub-bk7-selection";

const els = {
  tabs: [...document.querySelectorAll("[data-tab]")],
  panels: [...document.querySelectorAll("[data-panel]")],
  libraryTabs: [...document.querySelectorAll("[data-library]")],
  libraryPanels: [...document.querySelectorAll("[data-library-panel]")],
  toast: document.querySelector("#toast"),
  themeToggle: document.querySelector("#themeToggle"),
  themeMeta: document.querySelector('meta[name="theme-color"]'),
  installHint: document.querySelector("#installHint"),
  dismissInstallHint: document.querySelector("#dismissInstallHint"),

  refreshRules: document.querySelector("#refreshRules"),
  rulesStatus: document.querySelector("#rulesStatus"),
  rulesSearch: document.querySelector("#rulesSearch"),
  rulesList: document.querySelector("#rulesList"),
  importSelectedRules: document.querySelector("#importSelectedRules"),

  refreshBk7: document.querySelector("#refreshBk7"),
  bk7Status: document.querySelector("#bk7Status"),
  bk7Search: document.querySelector("#bk7Search"),
  bk7List: document.querySelector("#bk7List"),
  bk7SelectVisible: document.querySelector("#bk7SelectVisible"),
  bk7ClearSelection: document.querySelector("#bk7ClearSelection"),
  bk7LoadMore: document.querySelector("#bk7LoadMore"),
  bk7Sentinel: document.querySelector("#bk7Sentinel"),
  bk7BatchBar: document.querySelector("#bk7BatchBar"),
  bk7SelectedCount: document.querySelector("#bk7SelectedCount"),
  importSelectedBk7: document.querySelector("#importSelectedBk7"),

  refreshMitm: document.querySelector("#refreshMitm"),
  mitmStatus: document.querySelector("#mitmStatus"),
  mitmSearch: document.querySelector("#mitmSearch"),
  mitmList: document.querySelector("#mitmList"),
  mitmUpdatesFilter: document.querySelector("#mitmUpdatesFilter"),
  mitmUpdateCount: document.querySelector("#mitmUpdateCount"),
  mitmUpdateSheet: document.querySelector("#mitmUpdateSheet"),
  mitmSheetClose: document.querySelector("#mitmSheetClose"),
  mitmSheetIcon: document.querySelector("#mitmSheetIcon"),
  mitmSheetTitle: document.querySelector("#mitmSheetTitle"),
  mitmSheetPrevious: document.querySelector("#mitmSheetPrevious"),
  mitmSheetCurrent: document.querySelector("#mitmSheetCurrent"),
  mitmSheetRaw: document.querySelector("#mitmSheetRaw"),
  mitmSheetConfirm: document.querySelector("#mitmSheetConfirm"),
  mitmSheetLater: document.querySelector("#mitmSheetLater"),
  mitmSheetUnfollow: document.querySelector("#mitmSheetUnfollow"),

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
let bk7Files = [];
let bk7Groups = [];
let bk7VisibleCount = BK7_PAGE_SIZE;
let bk7BatchOffset = 0;
let selectedBk7Urls = readStoredBk7Selection();
let expandedBk7Groups = new Set();
let toastTimer;
let ruleMetadataPromise;
let mitmMetadataPromise;
let bk7LoadPromise;
let bk7RenderFrame;
let bk7Observer;
let importCounts = {};
let importCountsLoaded = false;
let mitmFollows = readMitmFollows(window.localStorage);
let mitmUpdatesOnly = false;
let activeMitmSheetPath = "";
let mitmSheetTrigger;
const embeddedMetadataPromises = new Map();
const catalogPromises = new Map();
const catalogCheckedAt = new Map();
const catalogRefreshes = new Map();

initTheme();
bindEvents();
initPwa();
activateTab(readInitialTab(), { updateHash: false });
loadRepositoryData();
void loadImportStats();

function bindEvents() {
  for (const tab of els.tabs) tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  for (const tab of els.libraryTabs) tab.addEventListener("click", () => activateLibrary(tab.dataset.library));

  els.themeToggle.addEventListener("click", toggleTheme);
  els.dismissInstallHint.addEventListener("click", dismissInstallHint);
  els.refreshRules.addEventListener("click", () => loadRules({ force: true }));
  els.refreshMitm.addEventListener("click", () => loadMitm({ force: true }));
  els.rulesSearch.addEventListener("input", renderRules);
  els.mitmSearch.addEventListener("input", renderMitm);
  els.mitmUpdatesFilter.addEventListener("click", () => {
    mitmUpdatesOnly = !mitmUpdatesOnly;
    renderMitm();
  });
  els.mitmSheetClose.addEventListener("click", closeMitmSheet);
  els.mitmSheetLater.addEventListener("click", closeMitmSheet);
  els.mitmSheetConfirm.addEventListener("click", confirmMitmUpdate);
  els.mitmSheetUnfollow.addEventListener("click", unfollowFromMitmSheet);
  els.mitmUpdateSheet.addEventListener("click", (event) => {
    if (event.target === els.mitmUpdateSheet) closeMitmSheet();
  });
  els.mitmUpdateSheet.addEventListener("close", () => {
    document.body.classList.remove("mitm-sheet-open");
    activeMitmSheetPath = "";
    if (mitmSheetTrigger?.isConnected) mitmSheetTrigger.focus();
    mitmSheetTrigger = null;
  });
  els.importSelectedRules.addEventListener("click", importSelectedRules);

  els.refreshBk7.addEventListener("click", () => loadBk7({ force: true }));
  els.bk7Search.addEventListener("input", scheduleRenderBk7);
  els.bk7SelectVisible.addEventListener("click", selectFilteredBk7);
  els.bk7ClearSelection.addEventListener("click", clearBk7Selection);
  els.bk7LoadMore.addEventListener("click", loadMoreBk7);
  els.importSelectedBk7.addEventListener("click", importSelectedBk7);

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
  window.addEventListener("hashchange", () => activateTab(readInitialTab(), { updateHash: false }));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refreshActiveCatalog();
  });
  window.addEventListener("pageshow", () => void refreshActiveCatalog());
  window.setInterval(() => void refreshActiveCatalog(), 30 * 1000);
}

function readInitialTab() {
  const hash = window.location.hash.slice(1);
  return ["library", "privacy", "mitm"].includes(hash) ? hash : "library";
}

function activateTab(name, { updateHash = true } = {}) {
  for (const tab of els.tabs) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  for (const panel of els.panels) {
    const active = panel.dataset.panel === name;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  }
  if (updateHash && window.location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
  window.scrollTo(0, 0);
  if (name === "library") {
    void hydrateRuleMetadata(rules);
    if (activeLibrary() === "bk7") void loadBk7();
  }
  if (name === "mitm") void hydrateMitmMetadata(mitmScripts);
  void refreshActiveCatalog();
}

function activeLibrary() {
  return els.libraryTabs.find((tab) => tab.classList.contains("active"))?.dataset.library || "common";
}

function activateLibrary(name) {
  for (const tab of els.libraryTabs) {
    const active = tab.dataset.library === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  for (const panel of els.libraryPanels) {
    const active = panel.dataset.libraryPanel === name;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  }
  window.scrollTo(0, 0);
  if (name === "common") void hydrateRuleMetadata(rules);
  if (name === "bk7") void loadBk7();
  if (name === "common") void refreshActiveCatalog();
}

async function loadRepositoryData() {
  await Promise.allSettled([loadRules(), loadMitm()]);
}

async function loadRules({ force = false } = {}) {
  setLoading(els.refreshRules, true, "同步中");
  els.rulesStatus.textContent = "正在同步 GitHub main/rules/common...";
  try {
    const data = await fetchJson(`${COMMON_INDEX_URL}${force ? `?t=${Date.now()}` : ""}`, { force });
    rules = (data.files || [])
      .filter((item) => item.output_path?.startsWith("common/") && item.output_path.endsWith(".arrs"))
      .map((item) => ({
        name: item.name,
        title: item.name,
        description: item.description || "Anywhere Routing Rule Set",
        ruleCount: item.rule_count ?? 0,
        skippedCount: item.skipped_count ?? 0,
        path: `rules/${item.output_path}`,
        rawUrl: `${RAW_BASE}/rules/${item.output_path}`,
        iconUrl: "",
      }));
    selectedRuleUrls = new Set([...selectedRuleUrls].filter((url) => rules.some((rule) => rule.rawUrl === url)));
    ruleMetadataPromise = undefined;
    renderRules();
    els.rulesStatus.textContent = `已同步 ${rules.length} 个常用规则集`;
    if (activeLibrary() === "common") void hydrateRuleMetadata(rules, force);
  } catch (error) {
    els.rulesStatus.textContent = `同步失败：${error.message}`;
    showToast("规则集同步失败，请稍后重试");
  } finally {
    setLoading(els.refreshRules, false, "同步远程");
  }
}

function renderRules() {
  const query = els.rulesSearch.value.trim().toLowerCase();
  const filtered = rules.filter((rule) => `${rule.title} ${rule.name} ${rule.description} ${rule.path}`.toLowerCase().includes(query));
  const fragment = document.createDocumentFragment();
  for (const rule of filtered) {
    const checked = selectedRuleUrls.has(rule.rawUrl);
    const card = document.createElement("article");
    card.className = `resource-card ${checked ? "selected" : ""}`;
    card.innerHTML = `
      <div class="resource-card-head">
        ${resourceIcon("globe", rule.iconUrl)}
        <label class="resource-select" aria-label="选择 ${escapeHtml(rule.title)}"><input class="row-select" type="checkbox" ${checked ? "checked" : ""}></label>
      </div>
      <div class="resource-card-copy"><h3>${escapeHtml(rule.title)}</h3><p>${escapeHtml(rule.description)}</p></div>
      <div class="resource-meta"><span>${rule.ruleCount.toLocaleString()} 条规则</span>${rule.skippedCount ? `<span>跳过 ${rule.skippedCount}</span>` : ""}</div>
      <div class="resource-stats"><span class="resource-stat-pill download-stat" data-import-path="${escapeHtml(rule.path)}">${importCountText(rule.path)}</span>${rule.updated ? `<time class="resource-stat-pill update-stat" datetime="${escapeHtml(rule.updated)}">${escapeHtml(rule.updated)}</time>` : ""}</div>
      <div class="resource-actions"><a class="preview-link" href="${escapeHtml(rule.rawUrl)}" target="_blank" rel="noreferrer">查看 Raw</a><button class="resource-import" type="button" aria-label="导入 ${escapeHtml(rule.title)}">一键导入</button></div>
    `;
    card.querySelector(".row-select").addEventListener("change", (event) => toggleRuleSelection(rule, event.currentTarget.checked));
    card.querySelector(".resource-import").addEventListener("click", () => openRuleSetImport([rule.rawUrl], [rule.path]));
    hydrateResourceIcon(card);
    fragment.append(card);
  }
  if (!filtered.length) fragment.append(emptyState("没有匹配的规则集"));
  els.rulesList.replaceChildren(fragment);
  updateRuleImportButtons();
}

function toggleRuleSelection(rule, checked) {
  if (checked) selectedRuleUrls.add(rule.rawUrl);
  else selectedRuleUrls.delete(rule.rawUrl);
  renderRules();
}

function updateRuleImportButtons() {
  els.importSelectedRules.disabled = selectedRuleUrls.size === 0;
  els.importSelectedRules.textContent = selectedRuleUrls.size ? `导入所选 ${selectedRuleUrls.size}` : "导入所选";
}

function importSelectedRules() {
  const selected = rules.filter((rule) => selectedRuleUrls.has(rule.rawUrl));
  openRuleSetImport(selected.map((rule) => rule.rawUrl), selected.map((rule) => rule.path));
}

async function loadBk7({ force = false } = {}) {
  if (bk7LoadPromise && !force) return bk7LoadPromise;
  setLoading(els.refreshBk7, true, "同步中");
  els.bk7Status.textContent = "正在读取 Blackmatrix7 目录索引...";
  bk7LoadPromise = fetchJson(`${BK7_INDEX_URL}${force ? `?t=${Date.now()}` : ""}`, { force })
    .then((data) => {
      bk7Files = (data.files || []).map((item) => ({
        name: item.name,
        sourcePath: item.source_path,
        outputFile: item.output_path.split("/").pop(),
        path: `rules/${item.output_path}`,
        rawUrl: `${RAW_BASE}/rules/${item.output_path}`,
        ruleCount: item.rule_count ?? 0,
        skippedCount: item.skipped_count ?? 0,
      }));
      const availableUrls = new Set(bk7Files.map((file) => file.rawUrl));
      selectedBk7Urls = new Set([...selectedBk7Urls].filter((url) => availableUrls.has(url)));
      bk7Groups = groupBk7Files(bk7Files);
      bk7BatchOffset = 0;
      bk7VisibleCount = BK7_PAGE_SIZE;
      els.bk7Status.textContent = `已同步 ${bk7Files.length.toLocaleString()} 个文件，${bk7Groups.length.toLocaleString()} 个目录。`;
      renderBk7();
      observeBk7Sentinel();
    })
    .catch((error) => {
      els.bk7Status.textContent = `目录同步失败：${error.message}`;
      showToast("BK7 目录同步失败，请稍后重试");
    })
    .finally(() => {
      setLoading(els.refreshBk7, false, "同步目录");
      bk7LoadPromise = undefined;
    });
  return bk7LoadPromise;
}

function groupBk7Files(files) {
  const groups = new Map();
  for (const file of files) {
    const [, , directory = file.name] = file.path.split("/");
    if (!groups.has(directory)) groups.set(directory, { key: directory, files: [] });
    groups.get(directory).files.push(file);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      files: group.files.sort((a, b) => a.path.localeCompare(b.path)),
      ruleCount: group.files.reduce((total, file) => total + file.ruleCount, 0),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function filteredBk7Groups() {
  const query = els.bk7Search.value.trim().toLowerCase();
  if (!query) return bk7Groups;
  return bk7Groups.filter((group) => {
    const searchable = `${group.key} ${group.files.map((file) => `${file.name} ${file.path} ${file.sourcePath}`).join(" ")}`.toLowerCase();
    return searchable.includes(query);
  });
}

function scheduleRenderBk7() {
  bk7VisibleCount = BK7_PAGE_SIZE;
  cancelAnimationFrame(bk7RenderFrame);
  bk7RenderFrame = requestAnimationFrame(renderBk7);
}

function renderBk7() {
  const filtered = filteredBk7Groups();
  const visibleGroups = filtered.slice(0, bk7VisibleCount);
  const fragment = document.createDocumentFragment();
  for (const group of visibleGroups) fragment.append(createBk7Group(group));
  if (!visibleGroups.length) fragment.append(emptyState(bk7Groups.length ? "没有匹配的 BK7 规则集" : "目录加载后将在这里显示"));
  els.bk7List.replaceChildren(fragment);
  els.bk7LoadMore.hidden = visibleGroups.length >= filtered.length;
  updateBk7Controls(filtered.length);
}

function createBk7Group(group) {
  const selectedCount = group.files.filter((file) => selectedBk7Urls.has(file.rawUrl)).length;
  const expanded = expandedBk7Groups.has(group.key);
  const groupElement = document.createElement("article");
  groupElement.className = `bk7-group ${selectedCount ? "selected" : ""}`;
  groupElement.innerHTML = `
    <div class="bk7-group-row">
      <label class="bk7-check" aria-label="选择 ${escapeHtml(group.key)} 的全部 ${group.files.length} 个规则文件"><input type="checkbox" ${selectedCount === group.files.length ? "checked" : ""}></label>
      <button class="bk7-open" type="button" aria-expanded="${expanded}" aria-label="${expanded ? "收起" : "展开"} ${escapeHtml(group.key)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        <span class="bk7-group-copy"><b>${escapeHtml(group.key)}</b><span>${group.files.length} 个变体 · ${formatRuleCount(group.ruleCount)} 条规则</span></span>
      </button>
      <span class="bk7-rule-count">${formatRuleCount(group.ruleCount)} 条</span>
      <a class="button secondary" href="${escapeHtml(group.files[0].rawUrl)}" target="_blank" rel="noreferrer">Raw</a>
    </div>
  `;
  const checkbox = groupElement.querySelector("input");
  checkbox.indeterminate = selectedCount > 0 && selectedCount < group.files.length;
  checkbox.addEventListener("change", () => toggleBk7Group(group, checkbox.checked));
  groupElement.querySelector(".bk7-open").addEventListener("click", () => {
    if (expandedBk7Groups.has(group.key)) expandedBk7Groups.delete(group.key);
    else expandedBk7Groups.add(group.key);
    renderBk7();
  });
  if (expanded) groupElement.append(createBk7Variants(group));
  return groupElement;
}

function createBk7Variants(group) {
  const variants = document.createElement("div");
  variants.className = "bk7-variants";
  variants.innerHTML = `<p class="bk7-variants-note">每项均可单独导入：上方为 Anywhere 导入文件名，下方为 Blackmatrix7 上游来源。</p>`;
  for (const file of group.files) {
    const variant = document.createElement("div");
    variant.className = "bk7-variant";
    variant.innerHTML = `
      <label aria-label="选择 ${escapeHtml(file.outputFile)}"><input type="checkbox" ${selectedBk7Urls.has(file.rawUrl) ? "checked" : ""}></label>
      <span class="bk7-variant-copy"><b>${escapeHtml(file.outputFile)}</b><span>${escapeHtml(describeBk7Variant(file))} · ${formatRuleCount(file.ruleCount)} 条规则${file.skippedCount ? ` · 跳过 ${file.skippedCount}` : ""}</span><small>来源：${escapeHtml(file.sourcePath)}</small></span>
      <a href="${escapeHtml(file.rawUrl)}" target="_blank" rel="noreferrer">Raw</a>
    `;
    variant.querySelector("input").addEventListener("change", (event) => toggleBk7File(file, event.currentTarget.checked));
    variants.append(variant);
  }
  return variants;
}

function describeBk7Variant(file) {
  const name = file.outputFile.replace(/\.arrs$/i, "").toLowerCase();
  const notes = [];
  if (/(^|_)all(?:_|$)/.test(name)) notes.push("全量组合");
  if (/(^|_)no_resolve(?:_|$)/.test(name)) notes.push("不进行 DNS 解析");
  else if (/(^|_)resolve(?:_|$)/.test(name)) notes.push("启用 DNS 解析");
  if (/(^|_)domain(?:_|$)/.test(name)) notes.push("仅域名匹配");
  if (/(^|_)(?:ip|cidr)(?:_|$)/.test(name)) notes.push("IP / CIDR 匹配");
  if (/(^|_)reject(?:_|$)/.test(name)) notes.push("拦截策略");
  return notes.join(" · ") || "上游原始变体";
}

function toggleBk7Group(group, checked) {
  bk7BatchOffset = 0;
  for (const file of group.files) {
    if (checked) selectedBk7Urls.add(file.rawUrl);
    else selectedBk7Urls.delete(file.rawUrl);
  }
  persistBk7Selection();
  renderBk7();
}

function toggleBk7File(file, checked) {
  bk7BatchOffset = 0;
  if (checked) selectedBk7Urls.add(file.rawUrl);
  else selectedBk7Urls.delete(file.rawUrl);
  persistBk7Selection();
  renderBk7();
}

function selectFilteredBk7() {
  bk7BatchOffset = 0;
  for (const group of filteredBk7Groups()) for (const file of group.files) selectedBk7Urls.add(file.rawUrl);
  persistBk7Selection();
  renderBk7();
}

function clearBk7Selection() {
  bk7BatchOffset = 0;
  selectedBk7Urls.clear();
  persistBk7Selection();
  renderBk7();
}

function loadMoreBk7() {
  bk7VisibleCount += BK7_PAGE_SIZE;
  renderBk7();
}

function updateBk7Controls(filteredCount = filteredBk7Groups().length) {
  const hasSelection = selectedBk7Urls.size > 0;
  els.bk7SelectVisible.disabled = filteredCount === 0;
  els.bk7ClearSelection.disabled = !hasSelection;
  els.importSelectedBk7.disabled = !hasSelection;
  els.bk7BatchBar.hidden = !hasSelection;
  els.bk7SelectedCount.textContent = `已选 ${selectedBk7Urls.size.toLocaleString()} 项`;
  els.importSelectedBk7.textContent = selectedBk7Urls.size > MAX_IMPORT_LINKS
    ? `导入第 ${Math.floor(bk7BatchOffset / MAX_IMPORT_LINKS) + 1}/${Math.ceil(selectedBk7Urls.size / MAX_IMPORT_LINKS)} 批`
    : `批量导入 ${selectedBk7Urls.size}`;
}

function importSelectedBk7() {
  const selected = bk7Files.filter((file) => selectedBk7Urls.has(file.rawUrl));
  if (!selected.length) return;
  const batch = selected.slice(bk7BatchOffset, bk7BatchOffset + MAX_IMPORT_LINKS);
  if (selected.length > MAX_IMPORT_LINKS) {
    const confirmed = window.confirm(`现在将第 ${Math.floor(bk7BatchOffset / MAX_IMPORT_LINKS) + 1} 批 ${batch.length} 项交给 Anywhere。已选项目不会自动清除，确认导入成功后可手动清空。`);
    if (!confirmed) return;
  }
  openRuleSetImport(batch.map((file) => file.rawUrl));
  bk7BatchOffset = bk7BatchOffset + batch.length >= selected.length ? 0 : bk7BatchOffset + batch.length;
  updateBk7Controls();
}

function observeBk7Sentinel() {
  if (!("IntersectionObserver" in window) || bk7Observer) return;
  bk7Observer = new IntersectionObserver((entries) => {
    const [entry] = entries;
    if (!entry.isIntersecting || activeLibrary() !== "bk7") return;
    const count = filteredBk7Groups().length;
    if (bk7VisibleCount < count) loadMoreBk7();
  }, { rootMargin: "520px 0px" });
  bk7Observer.observe(els.bk7Sentinel);
}

async function loadMitm({ force = false } = {}) {
  setLoading(els.refreshMitm, true, "同步中");
  els.mitmStatus.textContent = "正在同步 GitHub main/mitm...";
  try {
    const catalog = await getRemoteCatalog("mitm", force);
    if (catalog) {
      mitmScripts = Object.entries(catalog.resources)
        .filter(([path]) => path.startsWith("mitm/") && path.endsWith(".amrs"))
        .map(([path, metadata]) => ({
          name: path.split("/").pop().replace(/\.amrs$/i, ""),
          title: metadata.title || path.split("/").pop().replace(/\.amrs$/i, ""),
          filename: path.split("/").pop(),
          path,
          rawUrl: `${RAW_BASE}/${path}`,
          reject: metadata.reject ? { rawUrl: `${RAW_BASE}/${metadata.reject}` } : null,
          iconUrl: metadata.icon ? `data:image/png;base64,${metadata.icon}` : "",
          updated: metadata.updated || "",
          version: metadata.version || "",
          metadataLoaded: true,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const data = await fetchJson(`${MITM_API_URL}${force ? `&t=${Date.now()}` : ""}`, { force });
      const mitmFiles = data.filter((item) => item.type === "file");
      const rejectFiles = new Map(mitmFiles.filter((item) => item.name.endsWith(".arrs")).map((item) => [item.name.toLowerCase(), item]));
      mitmScripts = mitmFiles
        .filter((item) => item.name.endsWith(".amrs"))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          name: item.name.replace(/\.amrs$/i, ""),
          title: item.name.replace(/\.amrs$/i, ""),
          filename: item.name,
          path: item.path,
          rawUrl: `${RAW_BASE}/${item.path}`,
          reject: findRejectForMitm(item, rejectFiles),
          iconUrl: "",
        }));
    }
    enrichStoredMitmVersions();
    mitmMetadataPromise = undefined;
    renderMitm();
    if (els.mitmUpdateSheet.open) refreshMitmSheet();
    els.mitmStatus.textContent = `已同步 ${mitmScripts.length} 个 MITM 脚本`;
    if (readInitialTab() === "mitm") void hydrateMitmMetadata(mitmScripts, force);
  } catch (error) {
    els.mitmStatus.textContent = `同步失败：${error.message}`;
    showToast("MITM 脚本同步失败，请稍后重试");
  } finally {
    setLoading(els.refreshMitm, false, "同步远程");
  }
}

function renderMitm() {
  if (startupSelector) {
    let collection=mitmScripts.find(s=>s.path==='mitm/StartupAds.amrs');
    if(!collection){collection={path:'mitm/StartupAds.amrs',title:'应用开屏去广告',name:'StartupAds',filename:'StartupAds.amrs',rawUrl:'https://raw.githubusercontent.com/chikacya/anywhere-rules/main/mitm/StartupAds.amrs',iconUrl:'/icons/startup-ads.png',updated:startupSelector.catalog.updated};mitmScripts.unshift(collection);}
    const position=mitmScripts.indexOf(collection);if(position>0){mitmScripts.splice(position,1);mitmScripts.unshift(collection);}
    collection.version=startupSelector.revision;
  }
  const query = els.mitmSearch.value.trim().toLowerCase();
  const updates = mitmScripts.filter((script) => hasMitmUpdate(mitmFollows[script.path], script));
  els.mitmUpdateCount.textContent = String(updates.length);
  els.mitmUpdatesFilter.setAttribute("aria-pressed", String(mitmUpdatesOnly));
  els.mitmUpdatesFilter.classList.toggle("active", mitmUpdatesOnly);
  const filtered = mitmScripts.filter((script) =>
    (!mitmUpdatesOnly || hasMitmUpdate(mitmFollows[script.path], script)) &&
    `${script.title} ${script.name} ${script.filename} ${script.path==='mitm/StartupAds.amrs'&&startupSelector?startupSelector.catalog.apps.map(a=>a.label).join(' '):''}`.toLowerCase().includes(query));
  const fragment = document.createDocumentFragment();
  for (const script of filtered) {
    const followed = Boolean(mitmFollows[script.path]);
    const hasUpdate = hasMitmUpdate(mitmFollows[script.path], script);
    const card = document.createElement("article");
    card.className = "resource-card";
    card.dataset.path = script.path;
    card.innerHTML = `
      <div class="resource-card-head">${resourceIcon("anywhere", script.iconUrl)}${hasUpdate
        ? `<button class="mitm-update-badge" type="button" aria-label="查看 ${escapeHtml(script.title)} 的更新"><span class="update-dot" aria-hidden="true"></span>有更新</button>`
        : `<button class="mitm-follow ${followed ? "followed" : ""}" type="button" aria-pressed="${followed}" aria-label="${followed ? "取消关注" : "关注"} ${escapeHtml(script.title)} 的更新" title="${followed ? "取消关注更新" : "关注更新"}"><svg viewBox="0 0 24 24" aria-hidden="true">${followed ? '<path d="m5 12 4.5 4.5L19 7"/>' : '<path d="M12 5v14M5 12h14"/>'}</svg><span>${followed ? "已关注" : "关注"}</span></button>`}</div>
      <div class="resource-card-copy"><h3>${escapeHtml(script.title)}</h3><p>${script.reject ? "脚本与配套 Reject 规则将一并导入" : "请求与响应改写脚本"}</p></div>
      <div class="resource-meta"><span>.amrs</span><span>${script.reject ? "含 Reject" : "脚本规则"}</span></div>
      <div class="resource-stats"><span class="resource-stat-pill download-stat" data-import-path="${escapeHtml(script.path)}">${importCountText(script.path)}</span>${script.updated ? `<time class="resource-stat-pill update-stat" datetime="${escapeHtml(script.updated)}">${escapeHtml(script.updated)}</time>` : ""}</div>
      <div class="resource-actions"><a class="preview-link" href="${escapeHtml(script.rawUrl)}" target="_blank" rel="noreferrer">查看 Raw</a><button class="resource-import" type="button" aria-label="${hasUpdate ? "查看更新" : "导入"} ${escapeHtml(script.title)}">${hasUpdate ? "查看更新" : "一键导入"}</button></div>
    `;
    card.querySelector(".mitm-update-badge")?.addEventListener("click", (event) => openMitmSheet(script, event.currentTarget));
    card.querySelector(".mitm-follow")?.addEventListener("click", () => toggleMitmFollow(script));
    card.querySelector(".resource-import").addEventListener("click", () => {
      if (script.path === "mitm/StartupAds.amrs" && startupSelector) { startupSelector.open(card.querySelector(".resource-import"), query); return; }
      if (hasUpdate) {
        openMitmSheet(script, card.querySelector(".resource-import"));
        return;
      }
      openRuleSetImport([script.rawUrl, script.reject?.rawUrl].filter(Boolean), [script.path]);
    });
    if(script.path==='mitm/StartupAds.amrs'&&startupSelector){card.querySelector('.resource-import').textContent=startupSelector.count?'调整组合':'选择应用';card.querySelector('.resource-import').setAttribute('aria-label','选择应用');card.querySelector('.resource-card-copy p').textContent='组合常用应用，按需去开屏';card.querySelector('.resource-meta').innerHTML='<span>.amrs</span><span>可自选</span><span>静态转换</span>';}
    hydrateResourceIcon(card);
    fragment.append(card);
  }
  if (!filtered.length) {
    const empty = emptyState(mitmUpdatesOnly ? "当前没有待处理的脚本更新。关注脚本后，有新版本时会出现在这里。" : "没有匹配的 MITM 脚本");
    if (mitmUpdatesOnly) {
      const showAll = document.createElement("button");
      showAll.type = "button";
      showAll.className = "button secondary";
      showAll.textContent = "查看全部脚本";
      showAll.addEventListener("click", () => {
        mitmUpdatesOnly = false;
        els.mitmSearch.value = "";
        renderMitm();
        els.mitmUpdatesFilter.focus();
      });
      empty.append(showAll);
    }
    fragment.append(empty);
  }
  els.mitmList.replaceChildren(fragment);
}

function enrichStoredMitmVersions() {
  const next = enrichMitmFollows(mitmFollows, mitmScripts);
  if (next !== mitmFollows && saveMitmFollows(window.localStorage, next)) mitmFollows = next;
}

function updateMitmFollows(next, message) {
  if (!saveMitmFollows(window.localStorage, next)) {
    showToast("当前浏览器无法保存关注状态");
    return false;
  }
  mitmFollows = next;
  renderMitm();
  showToast(message);
  return true;
}

function toggleMitmFollow(script) {
  const next = { ...mitmFollows };
  if (next[script.path]) {
    delete next[script.path];
    if (!updateMitmFollows(next, `已取消关注 ${script.title}`)) return;
  } else {
    next[script.path] = mitmVersion(script);
    if (!updateMitmFollows(next, `已关注 ${script.title} 的更新`)) return;
  }
  [...els.mitmList.querySelectorAll(".resource-card")]
    .find((card) => card.dataset.path === script.path)
    ?.querySelector(".mitm-follow")?.focus({ preventScroll: true });
}

function openMitmSheet(script, trigger) {
  mitmSheetTrigger = trigger;
  activeMitmSheetPath = script.path;
  refreshMitmSheet();
  document.body.classList.add("mitm-sheet-open");
  els.mitmUpdateSheet.showModal();
}

function refreshMitmSheet() {
  const script = mitmScripts.find((item) => item.path === activeMitmSheetPath);
  if (!script || !hasMitmUpdate(mitmFollows[script.path], script)) {
    if (els.mitmUpdateSheet.open) closeMitmSheet();
    return;
  }
  els.mitmSheetIcon.innerHTML = resourceIcon("anywhere", script.iconUrl);
  hydrateResourceIcon(els.mitmSheetIcon);
  els.mitmSheetTitle.textContent = script.title;
  els.mitmSheetPrevious.textContent = mitmFollows[script.path].updated || "日期未知";
  els.mitmSheetCurrent.textContent = script.updated || "日期未知";
  els.mitmSheetRaw.href = script.rawUrl;
}

function closeMitmSheet() {
  if (els.mitmUpdateSheet.open) els.mitmUpdateSheet.close();
}

function confirmMitmUpdate() {
  const script = mitmScripts.find((item) => item.path === activeMitmSheetPath);
  if (!script) return closeMitmSheet();
  const next = { ...mitmFollows, [script.path]: mitmVersion(script) };
  if (updateMitmFollows(next, `已记录 ${script.title} 为当前版本`)) closeMitmSheet();
}

function unfollowFromMitmSheet() {
  const script = mitmScripts.find((item) => item.path === activeMitmSheetPath);
  if (!script) return closeMitmSheet();
  const next = { ...mitmFollows };
  delete next[script.path];
  if (updateMitmFollows(next, `已取消关注 ${script.title}`)) closeMitmSheet();
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
      setStatus(`已读取 ${progress.lineCount.toLocaleString()} 行，网络记录 ${progress.networkCount.toLocaleString()} 条，代理容器目标 ${progress.proxyTargetCount.toLocaleString()} 个。`);
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
      filters: { fakeIp: els.filterFake.checked, privateIp: els.filterPrivate.checked, localIp: els.filterLocal.checked },
      attribution: { allowSharedExact: els.allowShared.checked },
    },
  });
}

function renderReport() {
  if (!report) return;
  const summary = report.attributionSummary;
  setStatus(`完成：${report.networkCount.toLocaleString()} 条网络记录，${report.apps.length.toLocaleString()} 个应用，${summary.unresolvedCount.toLocaleString()} 个代理容器目标待确认。`);
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
  const apps = getFilteredApps();
  const fragment = document.createDocumentFragment();
  for (const app of apps) {
    const row = document.createElement("label");
    row.className = "app-row";
    row.innerHTML = `<input type="checkbox" ${selectedBundleIDs.has(app.bundleID) ? "checked" : ""}><span class="app-main"><span class="app-name">${escapeHtml(displayBundleName(app.bundleID))}</span><span class="app-meta">${app.count.toLocaleString()} 条规则候选 · hits ${app.hits.toLocaleString()}</span></span><button type="button" class="button quiet">预览</button>`;
    const checkbox = row.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedBundleIDs.add(app.bundleID);
      else selectedBundleIDs.delete(app.bundleID);
      updateDownloadButtons();
    });
    row.querySelector("button").addEventListener("click", (event) => {
      event.preventDefault();
      showPreview(app.bundleID);
    });
    fragment.append(row);
  }
  if (!apps.length) fragment.append(emptyState("没有匹配的应用"));
  els.apps.replaceChildren(fragment);
  updateDownloadButtons();
  if (apps[0]) showPreview(apps[0].bundleID);
  else els.preview.value = "";
}

function renderUnresolved() {
  if (!report) return;
  els.unresolved.innerHTML = (report.unresolvedProxyTargets || []).slice(0, 80).map((target) => {
    const candidates = target.candidateApps?.length ? `候选：${target.candidateApps.slice(0, 3).join(", ")}` : "未找到可靠候选";
    return `<li><code>${escapeHtml(target.value)}</code><span>${target.hits.toLocaleString()} hits · ${escapeHtml(target.attribution)} · ${escapeHtml(candidates)}</span></li>`;
  }).join("");
}

function showPreview(bundleID) {
  const app = report?.apps.find((item) => item.bundleID === bundleID);
  if (!app) return;
  els.preview.value = buildFilesForApp(app)[0]?.content.split("\n").slice(0, 180).join("\n") || "";
}

function downloadArtifact(bundleIDs) {
  if (!report || !bundleIDs.length) return;
  revokeUrls();
  const files = buildFilesForBundles(bundleIDs);
  if (!files.length) return;
  const singleFile = files.length === 1;
  const blob = singleFile ? new Blob([files[0].content], { type: "text/plain;charset=utf-8" }) : createZip(files);
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  const link = document.createElement("a");
  link.href = url;
  link.download = singleFile ? files[0].filename : "anywhere-app-rules.zip";
  link.click();
}

function buildFilesForBundles(bundleIDs) {
  return bundleIDs.flatMap((bundleID) => {
    const app = report.apps.find((item) => item.bundleID === bundleID);
    return app ? buildFilesForApp(app) : [];
  });
}

function buildFilesForApp(app) {
  return buildArrsFiles(readableRuleSetName(app), targetsToRules(app.targets), {
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
  return report.apps.filter((app) => !query || `${displayBundleName(app.bundleID)} ${app.bundleID}`.toLowerCase().includes(query));
}

function updateDownloadButtons() {
  const hasSelection = selectedBundleIDs.size > 0;
  els.downloadSelected.disabled = !hasSelection;
  els.downloadAll.disabled = !report?.apps.length;
  if (!report) return;
  const selectedCount = buildFilesForBundles([...selectedBundleIDs]).length;
  const totalCount = buildFilesForBundles(report.apps.map((app) => app.bundleID)).length;
  els.downloadSelected.textContent = selectedCount === 1 ? "下载所选 .arrs" : "下载所选 ZIP";
  els.downloadAll.textContent = totalCount === 1 ? "下载全部 .arrs" : "下载全部 ZIP";
}

function findRejectForMitm(item, rejectFiles) {
  const baseName = item.name.replace(/\.amrs$/i, "");
  const candidates = [`${baseName}Reject.arrs`, `${baseName.replace(/(?:BlockAD|PriceUnlock|Unlock)$/i, "")}Reject.arrs`];
  const reject = candidates.map((name) => rejectFiles.get(name.toLowerCase())).find(Boolean);
  return reject ? { rawUrl: `${RAW_BASE}/${reject.path}` } : null;
}

function hydrateRuleMetadata(ruleSets, force = false) {
  if (ruleMetadataPromise || !ruleSets.length) return ruleMetadataPromise;
  ruleMetadataPromise = hydrateResourceMetadata(ruleSets, "common", force).finally(() => {
    if (rules === ruleSets) ruleMetadataPromise = undefined;
  });
  return ruleMetadataPromise;
}

function hydrateMitmMetadata(scripts, force = false) {
  if (mitmMetadataPromise || !scripts.length || scripts.every((script) => script.metadataLoaded)) return mitmMetadataPromise;
  mitmMetadataPromise = hydrateResourceMetadata(scripts, "mitm", force).finally(() => {
    if (mitmScripts === scripts) mitmMetadataPromise = undefined;
  });
  return mitmMetadataPromise;
}

async function hydrateResourceMetadata(resources, type, force) {
  const metadataByPath = await getEmbeddedResourceMetadata(type, force);
  const current = type === "common" ? () => rules : () => mitmScripts;
  if (current() !== resources) return;
  let changed = false;
  for (let index = 0; index < resources.length; index += 1) {
    const metadata = metadataByPath[resources[index].path];
    if (!metadata) continue;
    resources[index] = { ...resources[index], title: metadata.title || resources[index].title, iconUrl: metadata.icon ? `data:image/png;base64,${metadata.icon}` : resources[index].iconUrl, updated: metadata.updated || "", version: metadata.version || "", metadataLoaded: true };
    changed = true;
  }
  if (changed) {
    if (type === "mitm") enrichStoredMitmVersions();
    type === "common" ? renderRules() : renderMitm();
  }
  const pending = resources.map((resource, index) => ({ resource, index })).filter(({ resource }) => !resource.metadataLoaded);
  await mapWithConcurrency(pending, async ({ resource, index }) => {
    const metadata = await fetchRuleSetMetadata(resource.rawUrl, resource, force);
    if (current() !== resources) return;
    resources[index] = { ...resources[index], ...metadata, metadataLoaded: true };
    type === "common" ? renderRules() : renderMitm();
  }, 2);
}

async function fetchRuleSetMetadata(rawUrl, fallback, force) {
  try {
    const response = await fetch(`${rawUrl}${force ? `?t=${Date.now()}` : ""}`, {
      cache: force ? "no-store" : "force-cache",
      headers: { Range: `bytes=0-${METADATA_READ_BYTES - 1}` },
    });
    if (!response.ok) return fallback;
    return { ...fallback, ...readRuleSetMetadata(await response.text()) };
  } catch {
    return fallback;
  }
}

function readRuleSetMetadata(source) {
  const title = source.match(/^\s*name\s*=\s*(.+?)\s*$/im)?.[1] || source.match(/^\s*#\s*NAME\s*:\s*(.+?)\s*$/im)?.[1] || "";
  const icon = source.match(/^\s*icon-light\s*=\s*([A-Za-z0-9+/=]+)\s*$/im)?.[1] || "";
  return { ...(title ? { title } : {}), ...(icon ? { iconUrl: `data:image/png;base64,${icon}` } : {}) };
}

async function getRemoteCatalog(type, force = false) {
  if (force) catalogPromises.delete(type);
  if (!catalogPromises.has(type)) {
    catalogCheckedAt.set(type, Date.now());
    const url = `${CATALOG_URLS[type]}${force ? `?t=${Date.now()}` : ""}`;
    catalogPromises.set(type, fetchJson(url, { force, cache: "default" })
      .then((data) => data?.resources && Object.keys(data.resources).length ? data : null)
      .catch(() => null));
  }
  return catalogPromises.get(type);
}

function catalogHasChanges(type, catalog) {
  const resources = type === "common" ? rules : mitmScripts;
  const entries = Object.entries(catalog.resources)
    .filter(([path]) => type === "common" ? /^rules\/common\/[^/]+\.arrs$/i.test(path) : /^mitm\/[^/]+\.amrs$/i.test(path));
  if (entries.length !== resources.length) return true;
  const current = new Map(resources.map((resource) => [resource.path, resource]));
  return entries.some(([path, metadata]) => {
    const resource = current.get(path);
    return !resource || resource.title !== (metadata.title || resource.name) ||
      resource.updated !== (metadata.updated || "") ||
      resource.iconUrl !== (metadata.icon ? `data:image/png;base64,${metadata.icon}` : "") ||
      (type === "mitm" && (resource.version !== (metadata.version || "") ||
        (resource.reject?.rawUrl || "") !== (metadata.reject ? `${RAW_BASE}/${metadata.reject}` : "")));
  });
}

function refreshActiveCatalog() {
  if (document.hidden) return;
  const type = readInitialTab() === "mitm" ? "mitm" : readInitialTab() === "library" && activeLibrary() === "common" ? "common" : "";
  if (!type || !(type === "common" ? rules : mitmScripts).length ||
      Date.now() - (catalogCheckedAt.get(type) || 0) < CATALOG_REFRESH_MS) return;
  if (catalogRefreshes.has(type)) return catalogRefreshes.get(type);
  const refresh = (async () => {
    const catalog = await getRemoteCatalog(type, true);
    if (!catalog || !catalogHasChanges(type, catalog)) return;
    if (type === "mitm") await loadMitm();
    else await loadRules();
  })().finally(() => catalogRefreshes.delete(type));
  catalogRefreshes.set(type, refresh);
  return refresh;
}

async function getEmbeddedResourceMetadata(type, force = false) {
  const catalog = await getRemoteCatalog(type, force);
  if (catalog) return catalog.resources;
  if (!embeddedMetadataPromises.has(type)) {
    embeddedMetadataPromises.set(type, fetch(METADATA_URLS[type], { cache: "force-cache" })
      .then((response) => response.ok ? response.json() : {})
      .then((data) => data.resources || {})
      .catch(() => ({})));
  }
  return embeddedMetadataPromises.get(type);
}

async function mapWithConcurrency(items, mapper, limit = 4) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await mapper(items[index]);
    }
  }));
}

function resourceIcon(fallback, iconUrl = "") {
  const fallbackMarkup = fallback === "globe"
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.1 2.4 3.1 5.2 3.1 8.5s-1 6.1-3.1 8.5c-2.1-2.4-3.1-5.2-3.1-8.5s1-6.1 3.1-8.5Z"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 18.5 12 4l7 14.5-3.6-1.8H8.6L5 18.5Z"/><path d="M9.2 14.2h5.6"/></svg>`;
  if (!iconUrl) return `<span class="resource-icon fallback-icon ${fallback}" aria-hidden="true">${fallbackMarkup}</span>`;
  return `<span class="resource-icon app-icon"><img src="${iconUrl}" alt="" width="52" height="52" decoding="async"><span class="fallback-icon ${fallback}" aria-hidden="true">${fallbackMarkup}</span></span>`;
}

function hydrateResourceIcon(container) {
  const image = container.querySelector(".app-icon img");
  if (!image) return;
  const reveal = () => image.classList.add("ready");
  image.addEventListener("load", reveal, { once: true });
  image.addEventListener("error", () => { image.hidden = true; });
  if (image.complete && image.naturalWidth > 0) reveal();
}

async function fetchJson(url, { force = false, cache = "no-cache" } = {}) {
  const response = await fetch(url, { cache: force ? "no-store" : cache, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadImportStats() {
  try {
    const data = await fetchJson("./api/import-stats");
    importCounts = data.counts || {};
    importCountsLoaded = true;
    refreshImportCountLabels();
  } catch {
    importCountsLoaded = false;
  }
}

function importCountText(path) {
  return importCountsLoaded ? `下载量 ${formatRuleCount(importCounts[path] || 0)}` : "";
}

function refreshImportCountLabels() {
  for (const label of document.querySelectorAll("[data-import-path]")) {
    label.textContent = importCountText(label.dataset.importPath);
  }
}

function recordImport(paths) {
  if (!paths.length) return;
  const body = new Blob([JSON.stringify({ paths })], { type: "application/json" });
  if (navigator.sendBeacon?.("./api/import-stats", body)) return;
  void fetch("./api/import-stats", { method: "POST", body, keepalive: true }).catch(() => {});
}

function openRuleSetImport(links, paths = []) {
  const validLinks = links.filter(Boolean);
  if (!validLinks.length) return;
  recordImport(paths);
  window.location.href = `anywhere://add-rule-set?${validLinks.map((link) => `link=${encodeURIComponent(link)}`).join("&")}`;
  showToast(`正在打开 Anywhere 导入 ${validLinks.length} 个规则集`);
}

function setBusy(busy) {
  els.parse.disabled = busy;
  els.file.disabled = busy;
  els.parse.textContent = busy ? "正在解析" : "开始解析";
}

function setLoading(button, loading, text) {
  button.disabled = loading;
  button.textContent = text;
}

function setStatus(text) { els.status.textContent = text; }
function revokeUrls() { for (const url of objectUrls) URL.revokeObjectURL(url); objectUrls = []; }
function emptyState(text) { const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = text; return empty; }
function formatRuleCount(value) { return Number(value || 0).toLocaleString(); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function readStoredBk7Selection() {
  try { return new Set(JSON.parse(sessionStorage.getItem(BK7_SELECTION_KEY) || "[]")); } catch { return new Set(); }
}

function persistBk7Selection() {
  sessionStorage.setItem(BK7_SELECTION_KEY, JSON.stringify([...selectedBk7Urls]));
}

function initTheme() {
  applyTheme(localStorage.getItem("theme") || "light");
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", next);
  applyTheme(next);
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalized;
  els.themeMeta.content = normalized === "dark" ? "#000000" : "#f5f5f7";
  els.themeToggle.setAttribute("aria-label", normalized === "dark" ? "切换浅色模式" : "切换深色模式");
  els.themeToggle.setAttribute("aria-pressed", String(normalized === "dark"));
}

function initPwa() {
  if ("serviceWorker" in navigator && ["https:", "http:"].includes(window.location.protocol)) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isIos && !standalone && !localStorage.getItem("anywhere-hub-install-hint-dismissed")) els.installHint.hidden = false;
}

function dismissInstallHint() {
  localStorage.setItem("anywhere-hub-install-hint-dismissed", "1");
  els.installHint.hidden = true;
}

initializeStartupSelector({onChange:()=>renderMitm()}).then(value=>{startupSelector=value;renderMitm();}).catch(error=>showToast("开屏选择加载失败："+error.message));
