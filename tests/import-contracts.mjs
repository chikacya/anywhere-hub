import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const body = app.slice(app.indexOf('function publishedModuleURL('), app.indexOf('function setBusy('));
const imports = [];
const location = { href: '' };
let fail = false;
const context = vm.createContext({
  URL,
  RAW_BASE: 'https://raw.githubusercontent.com/chikacya/anywhere-rules/main',
  window: { location }, recordImport: paths => imports.push(paths), showToast() {},
  fetch: async () => fail ? { ok: false, json: async () => ({ error: 'offline' }) } : { ok: true },
});
vm.runInContext(body, context);
vm.runInContext(app.slice(app.indexOf('const EXCLUDED_MITM_PATHS'), app.indexOf('const COMMON_INDEX_URL')), context);
const queued = [];
context.openRoutingQueue = (links, paths) => queued.push({links, paths});
context.openRuleSetImport(['https://example.com/a.arrs', 'https://example.com/b.arrs'], ['rules/common/a.arrs']);
assert.equal(queued.length, 1);
assert.equal(location.href, '');
context.openRuleSetImport(['https://example.com/a.arrs?x=1&y=2'], ['rules/common/a.arrs']);
const route = new URL(location.href);
assert.equal(route.host, 'add-rule-set');
assert.deepEqual(route.searchParams.getAll('link'), ['https://example.com/a.arrs?x=1&y=2']);
assert.equal(decodeURIComponent(location.href.split('?link=')[1]), 'https://example.com/a.arrs?x=1&y=2');
context.document = { body: { append() {} }, createElement() {
  const nodes = new Map();
  return { open: false, setAttribute() {}, remove() {}, showModal() { this.open = true; }, close() { this.open = false; }, querySelector(key) { if (!nodes.has(key)) nodes.set(key, {}); return nodes.get(key); } };
} };
vm.runInContext(app.slice(app.indexOf('function openRoutingQueue('), app.indexOf('async function openModuleImport(')), context);
const links = ['https://example.com/one.arrs', 'https://example.com/two.arrs'];
context.openRuleSetImport(links, ['rules/common/one.arrs', 'rules/common/two.arrs']);
const queue = context.openRoutingQueue.state;
assert.equal(queue.index, 0);
queue.dialog.querySelector('[data-next]').onclick();
assert.equal(new URL(location.href).searchParams.get('link'), links[0]);
assert.equal(queue.index, 1);
queue.dialog.querySelector('[data-retry]').onclick();
assert.equal(new URL(location.href).searchParams.get('link'), links[0]);
assert.equal(queue.index, 1);
queue.dialog.close();
context.openRuleSetImport(links, ['rules/common/one.arrs', 'rules/common/two.arrs']);
assert.equal(context.openRoutingQueue.state.index, 1);
queue.dialog.querySelector('[data-next]').onclick();
assert.equal(new URL(location.href).searchParams.get('link'), links[1]);
assert.equal(new URL(location.href).searchParams.getAll('link').length, 1);
queue.dialog.querySelector('[data-next]').onclick();
assert.equal(context.openRoutingQueue.state, null);
const button = { disabled: false, textContent: '一键导入' };
await context.openModuleImport({ module: 'modules/Fixture.amod', path: 'mitm/Fixture.amrs' }, button);
assert.equal(new URL(location.href).host, 'add-module');
assert.equal(new URL(location.href).searchParams.get('link'), context.RAW_BASE + '/modules/Fixture.amod');
assert.equal(button.disabled, false);
const count = imports.length;
location.href = '';
fail = true;
await context.openModuleImport({ module: 'modules/Fixture.amod', path: 'mitm/Fixture.amrs' }, button);
assert.equal(location.href, '');
assert.equal(imports.length, count);
assert.equal(button.disabled, false);
await context.openModuleImport({ module: '../bad.amod', path: 'mitm/Fixture.amrs' }, button);
assert.equal(location.href, '');
console.log('Import contracts: routing links, published modules, failure and pending reset passed');

const startup = { path: 'mitm/StartupAds.amrs', title: 'Startup', updated: '2026-10-15', iconUrl: '', sourceVersion: 'upstream', version: 'selected-app:revision', module: 'modules/StartupAds.amod', description: 'source', metadataLoaded: true };
const catalog = { resources: { [startup.path]: { title: startup.title, updated: startup.updated, version: 'upstream', module: startup.module, description: startup.description } } };
context.mitmScripts = [startup];
context.rules = [];
vm.runInContext(app.slice(app.indexOf('function catalogHasChanges('), app.indexOf('function refreshActiveCatalog(')), context);
assert.equal(context.catalogHasChanges('mitm', catalog), false);
catalog.resources['mitm/YouTubeEnhanceDualSubs.amrs'] = {};
catalog.resources['mitm/YouTubeBlockADDualSubsArg.amrs'] = {};
assert.equal(context.catalogHasChanges('mitm', catalog), false);
context.mitmScripts = [{ ...startup, synthetic: true }];
assert.equal(context.catalogHasChanges('mitm', { resources: {} }), false);
context.mitmScripts = [{ ...startup, path: 'mitm/Test.amrs', version: 'module-1' }];
const normalCatalog = { resources: { 'mitm/Test.amrs': { ...catalog.resources[startup.path], moduleVersion: 'module-1' } } };
assert.equal(context.catalogHasChanges('mitm', normalCatalog), false);
normalCatalog.resources['mitm/Test.amrs'].moduleVersion = 'module-2';
assert.equal(context.catalogHasChanges('mitm', normalCatalog), true);
console.log('Catalog contracts: scoped versions and synthetic cards do not cause redraw; module changes detected');
