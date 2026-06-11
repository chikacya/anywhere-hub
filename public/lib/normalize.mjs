const COMMON_SECOND_LEVEL_SUFFIXES = new Set([
  "com.cn",
  "net.cn",
  "org.cn",
  "gov.cn",
  "edu.cn",
  "ac.cn",
  "co.uk",
  "org.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.jp",
  "ne.jp",
  "or.jp",
  "co.kr",
  "or.kr",
  "com.hk",
  "net.hk",
  "org.hk",
  "com.tw",
  "net.tw",
  "org.tw",
  "com.sg",
  "com.br",
  "com.tr",
  "com.mx",
]);

export function normalizeTarget(value) {
  if (typeof value !== "string") return null;

  let target = value.trim();
  if (!target) return null;

  target = stripUrlBits(target);
  target = stripPort(target);
  target = target.replace(/\.$/, "").toLowerCase();

  if (!target) return null;

  const ipv4 = parseIPv4(target);
  if (ipv4) {
    return {
      kind: "ipv4",
      value: ipv4.text,
      ruleType: 0,
      specialRange: classifyIPv4(ipv4.parts),
    };
  }

  const ipv6 = normalizeIPv6(target);
  if (ipv6) {
    return {
      kind: "ipv6",
      value: ipv6,
      ruleType: 1,
      specialRange: classifyIPv6(ipv6),
    };
  }

  const hostname = normalizeHostname(target);
  if (!hostname) return null;

  return {
    kind: "domain",
    value: hostname,
    ruleType: 2,
    registrableDomain: getRegistrableDomain(hostname),
    specialRange: null,
  };
}

export function getRegistrableDomain(hostname) {
  if (!hostname || hostname.includes(":")) return "";
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (labels.length < 2) return hostname;

  const lastTwo = labels.slice(-2).join(".");
  const lastThree = labels.slice(-3).join(".");
  if (labels.length >= 3 && COMMON_SECOND_LEVEL_SUFFIXES.has(lastTwo)) {
    return lastThree;
  }
  return lastTwo;
}

export function isFilteredSpecialRange(target, options = {}) {
  if (!target?.specialRange) return false;
  const filters = {
    fakeIp: true,
    privateIp: true,
    localIp: true,
    reservedIp: false,
    ...options,
  };

  if (target.specialRange === "fake-ip") return filters.fakeIp;
  if (target.specialRange === "private") return filters.privateIp;
  if (target.specialRange === "local") return filters.localIp;
  if (target.specialRange === "reserved") return filters.reservedIp;
  return false;
}

function stripUrlBits(value) {
  let target = value;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) {
    try {
      return new URL(target).hostname;
    } catch {
      target = target.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    }
  }
  return target.split(/[/?#]/, 1)[0];
}

function stripPort(value) {
  if (value.startsWith("[") && value.includes("]")) {
    return value.slice(1, value.indexOf("]"));
  }

  const colonCount = (value.match(/:/g) || []).length;
  if (colonCount === 1) {
    const [host, port] = value.split(":");
    if (/^\d+$/.test(port)) return host;
  }
  return value;
}

function parseIPv4(value) {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const nums = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const num = Number(part);
    if (num < 0 || num > 255) return null;
    nums.push(num);
  }
  return { text: nums.join("."), parts: nums };
}

function normalizeIPv6(value) {
  const candidate = value.replace(/^\[/, "").replace(/\]$/, "");
  if (!candidate.includes(":")) return null;
  if (!/^[0-9a-f:.%]+$/i.test(candidate)) return null;
  const withoutZone = candidate.split("%", 1)[0];
  if ((withoutZone.match(/::/g) || []).length > 1) return null;
  const groups = withoutZone.split(":").filter(Boolean);
  if (groups.length > 8) return null;
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group) || group.includes("."))) {
    return null;
  }
  return withoutZone.toLowerCase();
}

function normalizeHostname(value) {
  if (value.length > 253) return null;
  if (value.includes("..")) return null;
  const labels = value.split(".");
  if (labels.length < 2) return null;
  for (const label of labels) {
    if (!label || label.length > 63) return null;
    if (!/^[a-z0-9-]+$/i.test(label)) return null;
    if (label.startsWith("-") || label.endsWith("-")) return null;
  }
  return value;
}

function classifyIPv4(parts) {
  const [a, b, c] = parts;
  if (a === 198 && (b === 18 || b === 19)) return "fake-ip";
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
    return "private";
  }
  if (a === 127 || (a === 169 && b === 254) || a === 0) return "local";
  if (
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224 ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  ) {
    return "reserved";
  }
  return null;
}

function classifyIPv6(value) {
  if (value === "::1" || value === "::") return "local";
  if (/^f[cd]/i.test(value)) return "private";
  if (/^fe8|^fe9|^fea|^feb/i.test(value)) return "local";
  return null;
}
