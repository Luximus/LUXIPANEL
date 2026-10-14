// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// i18n build step (`pnpm i18n:split`). Since 2026-06-25 the per-module files
// src/i18n/<locale>/<namespace>.ts ARE the source of truth and the runtime loads
// them directly (import.meta.glob in src/i18n/index.ts). This step no longer
// splits a monolith — it only (re)generates the derived artefacts:
//   • public/i18n/<versionHash>/<locale>/<namespace>.json  (client-side fetch)
//   • public/i18n/manifest.json                            (version + catalogue)
//   • src/i18n/namespaces.generated.ts                     (NAMESPACES order)
//   • src/i18n/es-aggregate.generated.ts                   (typeof-shape for types.ts)

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  ROOT,
  I18N_DIR,
  LOCALES,
  SHAPE_LOCALE,
  localeDirPath,
  loadModuleFile,
  readCanonicalOrder,
  writeNamespacesGenerated,
  writeEsAggregate,
} from "./i18n-shared.mjs";

const publicOutDir = path.join(ROOT, "public/i18n");

// Canonical namespace order: keep the committed order; fall back to the es dir
// (alphabetical) only on a fresh checkout. New namespaces appear after the
// known ones so the array stays stable across builds.
const esDir = localeDirPath(SHAPE_LOCALE);
if (!fs.existsSync(esDir)) {
  console.error(`[i18n] No per-module sources at ${esDir}. Run the migration first.`);
  process.exit(1);
}
const esNamespaces = fs
  .readdirSync(esDir)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => f.replace(/\.ts$/, ""));

const committed = readCanonicalOrder() ?? [];
const order = [
  ...committed.filter((ns) => esNamespaces.includes(ns)),
  ...esNamespaces.filter((ns) => !committed.includes(ns)).sort(),
];

// Version hash = digest of every per-module source file and its imported parts.
// Namespaces such as assistant.ts spread ./assistant/part*.ts; hashing only the
// aggregator leaves clients on a stale public JSON URL when a part changes.
const hash = crypto.createHash("sha256");
const hashNestedSources = (directory, localeDir) => {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) hashNestedSources(entryPath, localeDir);
    else if (entry.isFile() && entry.name.endsWith(".ts")) {
      hash.update(`${path.relative(localeDir, entryPath)}\n`);
      hash.update(fs.readFileSync(entryPath));
      hash.update("\n@@\n");
    }
  }
};
for (const locale of LOCALES) {
  for (const ns of order) {
    const fp = path.join(localeDirPath(locale), `${ns}.ts`);
    hash.update(`${locale}/${ns}\n`);
    if (fs.existsSync(fp)) hash.update(fs.readFileSync(fp));
    hash.update("\n@@\n");
    hashNestedSources(path.join(localeDirPath(locale), ns), localeDirPath(locale));
  }
}
const versionHash = hash.digest("hex").slice(0, 12);

fs.rmSync(publicOutDir, { recursive: true, force: true });
fs.mkdirSync(publicOutDir, { recursive: true });
const versionOutDir = path.join(publicOutDir, versionHash);

let emitted = 0;
const sourceNamespaces = Object.fromEntries(order.map((ns) => {
  const fp = path.join(localeDirPath(SHAPE_LOCALE), `${ns}.ts`);
  return [ns, fs.existsSync(fp) ? loadModuleFile(fp) : {}];
}));
const englishNamespaces = Object.fromEntries(order.map((ns) => {
  const fp = path.join(localeDirPath("en"), `${ns}.ts`);
  return [ns, deepFillObject(fs.existsSync(fp) ? loadModuleFile(fp) : {}, sourceNamespaces[ns])];
}));

function deepFillObject(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (!value || !fallback || typeof value !== "object" || typeof fallback !== "object" || Array.isArray(value) || Array.isArray(fallback)) return value;
  return Object.fromEntries(Object.entries(fallback).map(([key, child]) => [key, deepFillObject(value[key], child)]).concat(
    Object.entries(value).filter(([key]) => !(key in fallback)),
  ));
}

for (const locale of LOCALES) {
  const localeDir = localeDirPath(locale);
  if (!fs.existsSync(localeDir)) {
    console.warn(`[i18n] Missing locale dir ${locale} — skipped`);
    continue;
  }
  const publicLocaleDir = path.join(versionOutDir, locale);
  fs.mkdirSync(publicLocaleDir, { recursive: true });
  for (const ns of order) {
    const fp = path.join(localeDir, `${ns}.ts`);
    const value = locale === SHAPE_LOCALE
      ? sourceNamespaces[ns]
      : deepFillObject(fs.existsSync(fp) ? loadModuleFile(fp) : {}, englishNamespaces[ns]);
    fs.writeFileSync(path.join(publicLocaleDir, `${ns}.json`), JSON.stringify(value), "utf8");
    emitted++;
  }
}

writeNamespacesGenerated(order);
writeEsAggregate(order);

fs.writeFileSync(
  path.join(publicOutDir, "manifest.json"),
  JSON.stringify({ version: versionHash, locales: [...LOCALES], namespaces: order }, null, 2),
  "utf8",
);

console.log(
  `i18n: ${order.length} namespaces × ${LOCALES.length} locales → ${emitted} public JSON files. Version=${versionHash}`,
);
