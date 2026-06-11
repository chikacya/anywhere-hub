export const ANYWHERE_RULE_LIMIT = 10000;

export function buildArrsFiles(ruleSetName, rules, metadata = {}) {
  const sortedRules = [...rules].sort(compareRules);
  const chunks = [];
  for (let i = 0; i < sortedRules.length; i += ANYWHERE_RULE_LIMIT) {
    chunks.push(sortedRules.slice(i, i + ANYWHERE_RULE_LIMIT));
  }

  if (chunks.length === 0) chunks.push([]);

  return chunks.map((chunk, index) => {
    const suffix = chunks.length > 1 ? `_${String(index + 1).padStart(2, "0")}` : "";
    const name = `${ruleSetName}${suffix}`;
    return {
      name,
      filename: `${safeFilename(name)}.arrs`,
      count: chunk.length,
      content: renderArrs(name, chunk, metadata),
    };
  });
}

export function targetsToRules(targets) {
  const seen = new Set();
  const rules = [];
  for (const target of targets) {
    if (!target?.value || typeof target.ruleType !== "number") continue;
    const key = `${target.ruleType},${target.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push({ type: target.ruleType, value: target.value });
  }
  return rules;
}

export function safeFilename(name) {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120) || "Imported";
}

function renderArrs(name, rules, metadata) {
  const lines = [
    `# GENERATED-FOR: Anywhere Routing Rule Set`,
    `# SOURCE: iOS App Privacy Report`,
    `# GENERATED-AT: ${metadata.generatedAt || new Date().toISOString()}`,
  ];

  if (metadata.bundleID) lines.push(`# BUNDLE-ID: ${metadata.bundleID}`);
  if (metadata.note) lines.push(`# NOTE: ${metadata.note}`);
  lines.push(`# RULES: ${rules.length}`, "", `name = ${name}`);

  for (const rule of rules) {
    lines.push(`${rule.type}, ${rule.value}`);
  }
  return `${lines.join("\n")}\n`;
}

function compareRules(a, b) {
  if (a.type !== b.type) return a.type - b.type;
  return a.value.localeCompare(b.value);
}
