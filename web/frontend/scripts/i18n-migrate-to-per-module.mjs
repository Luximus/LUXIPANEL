// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// ONE-SHOT migration: split the monolithic src/i18n/locales/<locale>.ts files
// into per-module source files src/i18n/<locale>/<namespace>.ts, then prove the
// split is loss-free by re-combining each locale and deep-equalling it against
// the original monolith. Generates namespaces.generated.ts + es-aggregate.
// Does NOT delete the monoliths (done manually once verification is green) and
// does NOT emit public assets (that is the build's job, scripts/i18n-split-namespaces.mjs).

import fs from "fs";
import path from "path";
import vm from "vm";
import {
  I18N_DIR,
  LOCALES,
  SHAPE_LOCALE,
  loadLocaleDir,
  writeLocaleDir,
  writeNamespacesGenerated,
  writeEsAggregate,
} from "./i18n-shared.mjs";

const localesDir = path.join(I18N_DIR, "locales");

// Read a legacy monolith (`const x: Messages = {...} as const; export default x;`).
function loadMonolith(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  src = src.replace(/^import type .*?;\s*/m, "");
  src = src.replace(/^const\s+\w+(?::\s*Messages)?\s*=\s*/m, "module.exports = ");
  src = src.replace(/\s+as const;\s*$/m, ";");
  src = src.replace(/^export default\s+\w+;\s*$/m, "");
  const context = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(src, context, { filename: filePath });
  return context.module.exports;
}

function deepEqual(a, b, pathStr = "") {
  if (a === b) return null;
  if (typeof a !== typeof b) return `${pathStr}: type ${typeof a} != ${typeof b}`;
  if (typeof a !== "object" || a === null || b === null) return `${pathStr}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return `${pathStr}: key count ${ak.length} != ${bk.length}`;
  for (const k of ak) {
    if (!(k in b)) return `${pathStr}.${k}: missing on right`;
    const r = deepEqual(a[k], b[k], `${pathStr}.${k}`);
    if (r) return r;
  }
  return null;
}

// Canonical namespace order = es monolith key order.
const esMono = loadMonolith(path.join(localesDir, `${SHAPE_LOCALE}.ts`));
const ORDER = Object.keys(esMono);
console.log(`Canonical order: ${ORDER.length} namespaces (from ${SHAPE_LOCALE}.ts)`);

let failures = 0;
for (const locale of LOCALES) {
  const monoPath = path.join(localesDir, `${locale}.ts`);
  if (!fs.existsSync(monoPath)) {
    console.error(`  ✗ ${locale}: monolith missing (${monoPath})`);
    failures++;
    continue;
  }
  const mono = loadMonolith(monoPath);
  const keys = Object.keys(mono);

  // Parity: every locale must carry exactly the canonical namespace set.
  const missing = ORDER.filter((k) => !(k in mono));
  const extra = keys.filter((k) => !ORDER.includes(k));
  if (missing.length || extra.length) {
    console.error(`  ✗ ${locale}: namespace mismatch missing=${missing} extra=${extra}`);
    failures++;
    continue;
  }

  // Write per-module files in canonical order.
  writeLocaleDir(locale, mono, ORDER);

  // Round-trip: re-load the per-module files and deep-equal vs the monolith.
  const recombined = loadLocaleDir(locale, ORDER);
  const diff = deepEqual(mono, recombined, locale);
  if (diff) {
    console.error(`  ✗ ${locale}: round-trip MISMATCH -> ${diff}`);
    failures++;
  } else {
    console.log(`  ✓ ${locale}: ${ORDER.length} module files, round-trip exact`);
  }
}

writeNamespacesGenerated(ORDER);
writeEsAggregate(ORDER);
console.log("Wrote namespaces.generated.ts + es-aggregate.generated.ts");

if (failures) {
  console.error(`\nMIGRATION FAILED: ${failures} locale(s) with issues.`);
  process.exit(1);
}
console.log(`\nMIGRATION OK: ${LOCALES.length} locales × ${ORDER.length} namespaces, all round-trip exact.`);
