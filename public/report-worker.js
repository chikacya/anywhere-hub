import { attributeProxyTargets } from "./lib/attribution.mjs";
import { parsePrivacyReportStream } from "./lib/parser.mjs";

self.onmessage = async (event) => {
  const { file, options } = event.data || {};
  if (!file) {
    self.postMessage({ type: "error", message: "No file received." });
    return;
  }

  try {
    const parsed = await parsePrivacyReportStream(file, options, (progress) => {
      self.postMessage({ type: "progress", progress: summarize(progress) });
    });
    const report = attributeProxyTargets(parsed, options?.attribution || {});
    self.postMessage({ type: "done", report });
  } catch (error) {
    self.postMessage({ type: "error", message: error?.message || String(error) });
  }
};

function summarize(report) {
  return {
    lineCount: report.lineCount,
    networkCount: report.networkCount,
    appCount: Array.isArray(report.apps) ? report.apps.length : report.apps,
    proxyTargetCount: Array.isArray(report.proxyTargets)
      ? report.proxyTargets.length
      : report.proxyTargets,
    filteredSpecialCount: report.filteredSpecialCount,
  };
}
