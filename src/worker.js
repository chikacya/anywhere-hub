import { DurableObject } from "cloudflare:workers";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const RESOURCE_PATH = /^(?:rules\/common\/[^/?#]+\.arrs|mitm\/[^/?#]+\.amrs)$/i;
const RAW_BASE = "https://raw.githubusercontent.com/chikacya/anywhere-rules/main";

async function resourceCatalog(request, env, kind) {
  const url = new URL(request.url);
  const bust = url.searchParams.has("t") ? `?t=${Date.now()}` : `?v=${Math.floor(Date.now() / 60000)}`;
  try {
    const response = await fetch(`${RAW_BASE}/hub/${kind}.json${bust}`);
    if (response.ok) {
      const data = await response.json();
      if (data?.resources && Object.keys(data.resources).length) {
        return new Response(JSON.stringify(data), {
          headers: { ...JSON_HEADERS, "cache-control": "public, max-age=60" },
        });
      }
    }
  } catch {}
  const fallback = await env.ASSETS.fetch(new Request(new URL(`/resource-metadata-${kind}.json`, url.origin)));
  if (!fallback.ok) return new Response(JSON.stringify({ error: "Catalog unavailable" }), { status: 503, headers: JSON_HEADERS });
  return new Response(fallback.body, { headers: { ...JSON_HEADERS, "cache-control": "public, max-age=60" } });
}

export class ImportStats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS imports (path TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0)");
  }

  list() {
    return Object.fromEntries([...this.sql.exec("SELECT path, count FROM imports")].map(({ path, count }) => [path, count]));
  }

  increment(paths) {
    for (const path of paths) {
      this.sql.exec("INSERT INTO imports (path, count) VALUES (?, 1) ON CONFLICT(path) DO UPDATE SET count = count + 1", path);
    }
    return Object.fromEntries(paths.map((path) => [path, this.sql.exec("SELECT count FROM imports WHERE path = ?", path).one().count]));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const catalogKind = url.pathname.match(/^\/api\/catalog\/(common|mitm)$/)?.[1];
    if (catalogKind) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET" } });
      return resourceCatalog(request, env, catalogKind);
    }
    if (url.pathname !== "/api/import-stats") return env.ASSETS.fetch(request);
    const headers = JSON_HEADERS;
    if (request.method !== "GET" && request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...headers, allow: "GET, POST" } });
    }
    const stats = env.IMPORT_STATS.get(env.IMPORT_STATS.idFromName("global-imports-v1"));
    if (request.method === "GET") return new Response(JSON.stringify({ counts: await stats.list() }), { headers });

    if (request.headers.get("origin") && request.headers.get("origin") !== url.origin) {
      return new Response(JSON.stringify({ error: "Invalid origin" }), { status: 403, headers });
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return new Response(JSON.stringify({ error: "Expected JSON" }), { status: 415, headers });
    }
    if (Number(request.headers.get("content-length")) > 8192) {
      return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers });
    }
    let body;
    try {
      const source = await request.text();
      if (source.length > 8192) throw new Error("Payload too large");
      body = JSON.parse(source);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
    }
    if (!Array.isArray(body.paths) || body.paths.length < 1 || body.paths.length > 48 ||
        body.paths.some((path) => typeof path !== "string" || path.length > 240 || !RESOURCE_PATH.test(path) ||
          path.split("/").some((segment) => segment === "." || segment === ".."))) {
      return new Response(JSON.stringify({ error: "Invalid paths" }), { status: 400, headers });
    }
    const paths = [...new Set(body.paths)];
    return new Response(JSON.stringify({ counts: await stats.increment(paths) }), { headers });
  },
};
