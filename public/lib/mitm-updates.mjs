const STORAGE_KEY = "anywhere-hub-mitm-follows-v1";
const SCRIPT_PATH = /^mitm\/[^/?#]+\.amrs$/i;

export function readMitmFollows(storage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved)
      .filter(([path, version]) => SCRIPT_PATH.test(path) && version && typeof version === "object")
      .map(([path, version]) => [path, {
        updated: typeof version.updated === "string" ? version.updated : "",
        revision: typeof version.revision === "string" ? version.revision : "",
      }]));
  } catch {
    return {};
  }
}

export function saveMitmFollows(storage, follows) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(follows));
    return true;
  } catch {
    return false;
  }
}

export function mitmVersion(script) {
  return { updated: script.updated || "", revision: script.version || "" };
}

export function hasMitmUpdate(saved, script) {
  if (!saved || (!saved.updated && !saved.revision)) return false;
  const current = mitmVersion(script);
  if (saved.revision && current.revision) return saved.revision !== current.revision;
  return Boolean(saved.updated && current.updated && saved.updated !== current.updated);
}

export function enrichMitmFollows(follows, scripts) {
  let next = follows;
  for (const script of scripts) {
    const saved = next[script.path];
    if (!saved || saved.revision || !script.version || saved.updated !== (script.updated || "")) continue;
    if (next === follows) next = { ...follows };
    next[script.path] = { ...saved, revision: script.version };
  }
  return next;
}
