import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAW_BASE = "https://raw.githubusercontent.com/chikacya/anywhere-rules/main";
const COMMON_INDEX_URL = `${RAW_BASE}/rules/common/index.json`;
const MITM_API_URL = "https://api.github.com/repos/chikacya/anywhere-rules/contents/mitm?ref=main";
const METADATA_READ_BYTES = 48 * 1024;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDirectory = path.join(root, "public");

const [commonCatalog, mitmCatalog] = await Promise.all([readCatalog("common"), readCatalog("mitm")]);
const [commonIndex, mitmIndex] = await Promise.all([
  commonCatalog ? null : fetchJson(COMMON_INDEX_URL),
  mitmCatalog ? null : fetchJson(MITM_API_URL),
]);
const resourceGroups = {
  common: commonCatalog ? Object.keys(commonCatalog) : commonIndex.files
    .filter((item) => item.output_path?.startsWith("common/") && item.output_path.endsWith(".arrs"))
    .map((item) => `rules/${item.output_path}`)
    .sort(),
  mitm: mitmCatalog ? Object.keys(mitmCatalog) : mitmIndex
    .filter((item) => item.type === "file" && item.name.endsWith(".amrs"))
    .map((item) => item.path)
    .sort(),
};

await mkdir(outputDirectory, { recursive: true });
for (const [kind, paths] of Object.entries(resourceGroups)) {
  const catalog = kind === "common" ? commonCatalog : mitmCatalog;
  const entries = catalog
    ? paths.map((resourcePath) => [resourcePath, catalog[resourcePath]]).filter(([, metadata]) => metadata)
    : await mapWithConcurrency(paths, readMetadata);
  const output = path.join(outputDirectory, `resource-metadata-${kind}.json`);
  await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), resources: Object.fromEntries(entries) })}\n`);
  console.log(`Wrote ${entries.length} ${kind} metadata entries to ${output}`);
}

async function readCatalog(kind) {
  try {
    const data = process.env.CATALOG_DIR
      ? JSON.parse(await readFile(path.join(process.env.CATALOG_DIR, `${kind}.json`), "utf8"))
      : await fetchJson(`${RAW_BASE}/hub/${kind}.json`);
    return data.resources || null;
  } catch {
    return null;
  }
}

async function readMetadata(resourcePath) {
  const response = await fetch(`${RAW_BASE}/${resourcePath}`, {
    headers: { Range: `bytes=0-${METADATA_READ_BYTES - 1}` },
  });
  if (!response.ok) throw new Error(`${resourcePath}: HTTP ${response.status}`);
  const source = await response.text();
  const title = source.match(/^\s*name\s*=\s*(.+?)\s*$/im)?.[1] || "";
  const icon = source.match(/^\s*icon-light\s*=\s*([A-Za-z0-9+/=]+)\s*$/im)?.[1] || "";
  if (!title || !icon) throw new Error(`${resourcePath}: missing name or icon-light metadata`);
  return [resourcePath, { title, icon }];
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function mapWithConcurrency(items, mapper, limit = 4) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }));
  return results;
}
