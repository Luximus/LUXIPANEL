// For each non-es locale, compute the leaf-paths present in es-delta but missing
// from the locale's translated delta, then write small gap-chunk files
// (/tmp/i18n-gap-<code>-<i>.json, ~SIZE leaves each) and print a manifest.
import fs from "fs";
import { leafPaths, setPath } from "./i18n-shared.mjs";

const SIZE = Number(process.argv[2] || 55);
const CODES = ["en", "fr", "de", "it", "pt", "ru", "ar", "bn", "hi", "ja", "ko"];
const esDelta = JSON.parse(fs.readFileSync("/tmp/i18n-es-delta.json", "utf8"));

function get(o, path) { return path.reduce((a, k) => (a == null ? undefined : a[k]), o); }

const esLeaves = leafPaths(esDelta);
const manifest = [];

for (const code of CODES) {
  let tr = {};
  try { tr = JSON.parse(fs.readFileSync(`/tmp/i18n-${code}-delta.json`, "utf8")); } catch {}
  // Missing = es leaf paths whose value is absent (undefined) in the locale delta.
  const missing = esLeaves.filter(([path]) => get(tr, path) === undefined);
  let idx = 0;
  for (let i = 0; i < missing.length; i += SIZE) {
    const obj = {};
    for (const [path, val] of missing.slice(i, i + SIZE)) setPath(obj, path, val);
    const file = `/tmp/i18n-gap-${code}-${idx}.json`;
    fs.writeFileSync(file, JSON.stringify(obj));
    manifest.push({ code, file, n: idx, count: Math.min(SIZE, missing.length - i) });
    idx++;
  }
  console.log(`${code}: missing=${missing.length} -> ${idx} gap-chunks`);
}

fs.writeFileSync("/tmp/i18n-gap-manifest.json", JSON.stringify(manifest));
console.log(`\nmanifest tasks: ${manifest.length} (written /tmp/i18n-gap-manifest.json)`);
