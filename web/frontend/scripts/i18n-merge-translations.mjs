// Assembles the chunked translation workflow output into the per-module source
// files src/i18n/<code>/<namespace>.ts (via writeLocaleDir).
// Groups chunks by language, deep-combines them, then deep-merges onto the
// Spanish source (source = structural authority; translated leaf wins when
// present & shape-compatible, else Spanish fallback). Reports parity per language.
//
// Usage: node scripts/i18n-merge-translations.mjs <workflow-output.json>
import fs from "fs";
import path from "path";
import { writeLocaleDir, readCanonicalOrder } from "./i18n-shared.mjs";

const outputFile = process.argv[2];
if (!outputFile) {
  console.error("usage: node scripts/i18n-merge-translations.mjs <workflow-output.json>");
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const source = JSON.parse(fs.readFileSync("/tmp/es.json", "utf8"));

const parsed = JSON.parse(fs.readFileSync(outputFile, "utf8"));
function findChunks(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj.chunks)) return obj.chunks;
  if (Array.isArray(obj) && obj.every((x) => x && typeof x === "object" && "code" in x && "json" in x)) return obj;
  for (const v of Object.values(obj)) {
    const r = findChunks(v);
    if (r) return r;
  }
  return null;
}
const chunks = findChunks(parsed);
if (!chunks) { console.error("Could not locate chunks[] in workflow output."); process.exit(1); }

let leafTotal = 0;
const countLeaves = (o) => {
  if (o === null) { leafTotal++; return; }
  if (Array.isArray(o)) { o.forEach((e) => (e && typeof e === "object" ? countLeaves(e) : leafTotal++)); return; }
  if (typeof o === "object") { Object.values(o).forEach(countLeaves); return; }
  leafTotal++;
};
countLeaves(source);

// deep-assign partial translated chunk into the per-language accumulator
function assign(target, src) {
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      target[k] = target[k] && typeof target[k] === "object" && !Array.isArray(target[k]) ? target[k] : {};
      assign(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

// merge translated onto source shape (source authoritative); count coverage
function merge(src, tr, stats) {
  if (src === null) return src;
  if (typeof src === "string") {
    if (typeof tr === "string" && tr.trim().length > 0) { stats.translated++; return tr; }
    stats.fallback++; return src;
  }
  if (Array.isArray(src)) {
    if (Array.isArray(tr) && tr.length === src.length) return src.map((s, i) => merge(s, tr[i], stats));
    return src.map((s) => merge(s, undefined, stats));
  }
  if (typeof src === "object") {
    const out = {};
    for (const k of Object.keys(src)) out[k] = merge(src[k], tr && typeof tr === "object" ? tr[k] : undefined, stats);
    return out;
  }
  return src;
}

const varName = (code) => code.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""));

// group chunks by language
const byCode = {};
let parseFails = 0;
for (const { code, chunk, json } of chunks) {
  byCode[code] = byCode[code] || {};
  try { assign(byCode[code], JSON.parse(json)); }
  catch { parseFails++; }
}

const order = readCanonicalOrder() ?? undefined;
const report = [];
for (const code of Object.keys(byCode)) {
  const stats = { translated: 0, fallback: 0 };
  const merged = merge(source, byCode[code], stats);
  const pct = Math.round((stats.translated / leafTotal) * 100);
  // Write per-module source files src/i18n/<code>/<namespace>.ts (no monolith).
  writeLocaleDir(code, merged, order ?? Object.keys(merged));
  report.push({ code, translated: stats.translated, fallback: stats.fallback, total: leafTotal, pct });
}

console.log(`Source leaf strings: ${leafTotal} | chunk parse failures: ${parseFails}`);
for (const r of report.sort((a, b) => a.pct - b.pct)) {
  console.log(`  ${r.code}: ${r.translated}/${r.total} (${r.pct}%)  fallback=${r.fallback}`);
}
fs.writeFileSync("/tmp/i18n-merge-report.json", JSON.stringify(report, null, 2));
