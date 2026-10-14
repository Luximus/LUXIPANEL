// Pure formatting/escaping helpers for the monitor page. No DOM or module
// state — safe to import anywhere. Extracted from monitor-v2.js.
export function fmtBytes(bps) {
  if (bps > 1e6) return `${(bps / 1e6).toFixed(1)} MB/s`;
  if (bps > 1e3) return `${(bps / 1e3).toFixed(1)} KB/s`;
  return `${Math.round(bps)} B/s`;
}
export function fmtMem(kb) {
  if (kb >= 1048576) return `${(kb / 1048576).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(0)} MB`;
  return `${kb} KB`;
}
export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[c]);
}
