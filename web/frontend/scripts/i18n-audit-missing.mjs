// Audit: find t("path","fallback") calls in extracted scripts whose key is
// missing from the source-of-truth namespace (es). Prints missing keys grouped
// by namespace with the fallback text.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const EXTRACTED = join(ROOT, "src/scripts/extracted");
const NS_ES = join(ROOT, "src/i18n/es");
const PAGES = join(ROOT, "src/pages");

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (e.endsWith(".ts") || e.endsWith(".astro")) out.push(p);
  }
  return out;
}

function loadNs(name) {
  const txt = readFileSync(join(NS_ES, name + ".ts"), "utf8");
  const start = txt.indexOf("{");
  const end = txt.lastIndexOf("} as const");
  const obj = txt.slice(start, end + 1);
  return new Function("return (" + obj + ")")();
}

function has(obj, path) {
  let node = obj;
  for (const part of path.split(".")) {
    if (!node || typeof node !== "object" || !(part in node)) return false;
    node = node[part];
  }
  return true;
}

// 1. Map i18n element-id -> namespace by scanning pages.
const idToNs = {};
const varToNs = {};
for (const p of walk(PAGES)) {
  if (!p.endsWith(".astro")) continue;
  const txt = readFileSync(p, "utf8");
  // const x = JSON.stringify(t["NS"])
  for (const m of txt.matchAll(/const\s+(\w+)\s*=\s*JSON\.stringify\(\s*t\["(\w+)"\]/g))
    varToNs[m[1]] = m[2];
  // id="X-i18n" ... set:html={JSON.stringify(t["NS"])}
  for (const m of txt.matchAll(/id="([\w-]+)-i18n"[^>]*set:html=\{JSON\.stringify\(\s*t\["(\w+)"\]\)\}/g))
    idToNs[m[1]] = m[2];
  // id="X-i18n" ... set:html={someVar}
  for (const m of txt.matchAll(/id="([\w-]+)-i18n"[^>]*set:html=\{(\w+)\}/g))
    if (varToNs[m[2]]) idToNs[m[1]] = varToNs[m[2]];
}

// Manual overrides for element ids whose page injects a sub-tree / aliased var.
const ID_OVERRIDE = {
  md: { ns: "moduleDev", prefix: "" },
  credentials: { ns: "settings", prefix: "credentials" },
  assistant: { ns: "assistant", prefix: "" },
};

// 2. Scan extracted scripts. Determine namespace per file via getElementById("X-i18n").
const nsCache = {};
const missing = {}; // ns -> { path -> fallback }
const unknownNs = {};
for (const f of walk(EXTRACTED)) {
  if (!f.endsWith(".ts")) continue;
  const txt = readFileSync(f, "utf8");
  const idm = txt.match(/getElementById\("([\w-]+)-i18n"\)/);
  const elId = idm ? idm[1] : null;
  const ov = elId ? ID_OVERRIDE[elId] : null;
  const ns = ov ? ov.ns : (elId ? idToNs[elId] : null);
  const prefix = ov ? ov.prefix : "";
  const calls = [...txt.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"\s*,\s*"((?:[^"\\]|\\.)*)"/g)];
  if (calls.length === 0) continue;
  if (!ns) { if (elId) unknownNs[elId] = (unknownNs[elId]||0)+calls.length; continue; }
  if (!nsCache[ns]) { try { nsCache[ns] = loadNs(ns); } catch (e) { nsCache[ns] = null; } }
  const obj = nsCache[ns];
  if (!obj) continue;
  for (const c of calls) {
    const fullPath = prefix ? prefix + "." + c[1] : c[1];
    const fb = c[2];
    if (!has(obj, fullPath)) {
      missing[ns] = missing[ns] || {};
      missing[ns][fullPath] = fb;
    }
  }
}

// Build nested delta: { ns: { nested paths -> value } }
import { writeFileSync } from "node:fs";
const delta = {};
for (const ns of Object.keys(missing)) {
  delta[ns] = delta[ns] || {};
  for (const path of Object.keys(missing[ns])) {
    let node = delta[ns];
    const parts = path.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = node[parts[i]] || {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = missing[ns][path];
  }
}
writeFileSync("/tmp/i18n-delta-es.json", JSON.stringify(delta, null, 2));

let total = 0;
for (const ns of Object.keys(missing).sort()) {
  const keys = Object.keys(missing[ns]);
  total += keys.length;
  console.log(`\n### ${ns} (${keys.length} missing)`);
  for (const k of keys.sort()) console.log(`  ${k}  =>  ${JSON.stringify(missing[ns][k])}`);
}
console.log(`\n=== TOTAL MISSING: ${total} ===`);
if (Object.keys(unknownNs).length) console.log("\nUNRESOLVED i18n element ids:", unknownNs);
