// i18n bridge for the monitor page — reads the SSR-emitted
// <script id="monitor-i18n"> JSON (the `monitor` namespace) and resolves keys
// with a literal fallback when a key is missing. Extracted from monitor-v2.js.
let MON_I18N = {};
try { const _el = document.getElementById("monitor-i18n"); if (_el?.textContent) MON_I18N = JSON.parse(_el.textContent); } catch { MON_I18N = {}; }
export function t(path, fallback) {
  let node = MON_I18N;
  for (const part of path.split(".")) { if (!node || typeof node !== "object") return fallback; node = node[part]; }
  return typeof node === "string" ? node : fallback;
}
export function tf(path, fallback, params = {}) {
  return t(path, fallback).replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined || params[k] === null ? m : String(params[k])));
}
