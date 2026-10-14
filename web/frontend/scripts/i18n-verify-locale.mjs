// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Verifies that one locale's per-module source files (src/i18n/<locale>/*.ts)
// reconstruct EXACTLY to a ground-truth JSON snapshot of the original monolith.
// Emits a JSON verdict on stdout. Used by the per-language verification agents.
//
// Usage: node scripts/i18n-verify-locale.mjs <locale> <truthJsonPath> [canonicalEsTruthJsonPath]

import fs from "fs";
import path from "path";
import { localeDirPath, loadModuleFile, readCanonicalOrder } from "./i18n-shared.mjs";

const locale = process.argv[2];
const truthPath = process.argv[3];
const esTruthPath = process.argv[4];

function leafCount(o) {
  if (o && typeof o === "object" && !Array.isArray(o)) return Object.values(o).reduce((n, v) => n + leafCount(v), 0);
  return 1;
}
function firstDiff(a, b, p = "") {
  if (a === b) return null;
  if (typeof a !== typeof b) return `${p}: type ${typeof a}!=${typeof b}`;
  if (typeof a !== "object" || a === null || b === null) return `${p}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${p}: array-ness differs`;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return `${p}: key count ${ak.length}!=${bk.length}`;
  for (const k of ak) {
    if (!(k in b)) return `${p}.${k}: missing on right`;
    const r = firstDiff(a[k], b[k], `${p}.${k}`);
    if (r) return r;
  }
  return null;
}

const verdict = { locale, ok: false, fileCount: 0, expectedNamespaces: 0, roundTripExact: false, namespaceParity: false, leaves: 0, esLeafShapeMatch: null, issues: [] };

try {
  const order = readCanonicalOrder() ?? [];
  verdict.expectedNamespaces = order.length;
  const dir = localeDirPath(locale);
  if (!fs.existsSync(dir)) throw new Error(`locale dir missing: ${dir}`);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));
  verdict.fileCount = files.length;
  const presentNs = new Set(files.map((f) => f.replace(/\.ts$/, "")));
  const missing = order.filter((ns) => !presentNs.has(ns));
  const extra = [...presentNs].filter((ns) => !order.includes(ns));
  if (missing.length) verdict.issues.push(`missing namespaces: ${missing.join(", ")}`);
  if (extra.length) verdict.issues.push(`extra namespaces: ${extra.join(", ")}`);
  verdict.namespaceParity = missing.length === 0 && extra.length === 0 && files.length === order.length;

  // Reconstruct the locale from its per-module files, in canonical order.
  const recombined = {};
  for (const ns of order) {
    const fp = path.join(dir, `${ns}.ts`);
    if (!fs.existsSync(fp)) continue;
    const src = fs.readFileSync(fp, "utf8");
    if (!/export default \w+;\s*$/.test(src)) verdict.issues.push(`${ns}.ts: no trailing 'export default'`);
    if (!/\}\s+as const;/.test(src)) verdict.issues.push(`${ns}.ts: no 'as const' assertion`);
    recombined[ns] = loadModuleFile(fp);
  }
  verdict.leaves = leafCount(recombined);

  // Round-trip vs the ground-truth snapshot (original monolith content).
  const truth = JSON.parse(fs.readFileSync(truthPath, "utf8"));
  const diff = firstDiff(truth, recombined, locale);
  verdict.roundTripExact = diff === null;
  if (diff) verdict.issues.push(`round-trip diff -> ${diff}`);

  // Structural mirror vs canonical es shape (same key tree, ignoring values).
  if (esTruthPath && fs.existsSync(esTruthPath)) {
    const esTruth = JSON.parse(fs.readFileSync(esTruthPath, "utf8"));
    const shapeOnly = (o) => (o && typeof o === "object" && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, shapeOnly(o[k])])) : Array.isArray(o) ? o.map(shapeOnly) : 0);
    const shapeDiff = firstDiff(shapeOnly(esTruth), shapeOnly(recombined), `${locale}~es`);
    verdict.esLeafShapeMatch = shapeDiff === null;
    if (shapeDiff) verdict.issues.push(`es-shape diff -> ${shapeDiff}`);
  }

  verdict.ok = verdict.roundTripExact && verdict.namespaceParity && verdict.issues.length === 0;
} catch (e) {
  verdict.issues.push(`exception: ${e.message}`);
}

console.log(JSON.stringify(verdict, null, 2));
process.exit(verdict.ok ? 0 : 1);
