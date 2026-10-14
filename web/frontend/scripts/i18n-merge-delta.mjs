// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Deterministically deep-merges a translation delta into a locale and re-writes
// the affected per-module source files src/i18n/<code>/<namespace>.ts, preserving
// the exact `const <name> = {...} as const; export default <name>;` shape. Used
// by the i18n audit/migration passes. The structural mirror across all 12 locales
// is guaranteed because the SAME delta keyset is merged into each.
//
// A delta is a partial Messages object keyed by namespace, e.g.
//   { "users": { "table": { "columns": { "username": "User" } } } }
// Only the namespaces present in the delta are rewritten; the rest stay untouched.
//
// Usage:
//   node scripts/i18n-merge-delta.mjs <localeCode> <deltaJsonPath>
//   node scripts/i18n-merge-delta.mjs --selftest

import fs from "fs";
import { pathToFileURL } from "url";
import {
  LOCALES,
  deepMerge,
  loadLocaleDir,
  writeLocaleDir,
  serializeModule,
  loadModuleFile,
  readCanonicalOrder,
  localeDirPath,
} from "./i18n-shared.mjs";
import path from "path";

// deepMerge now lives in i18n-shared.mjs; re-exported here so the scripts that
// already import it from this module keep working.
export { deepMerge };

function countLeaves(obj) {
  let n = 0;
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) n += countLeaves(v);
    else n += 1;
  }
  return n;
}

export function mergeIntoLocale(code, delta) {
  const order = readCanonicalOrder() ?? undefined;
  const obj = loadLocaleDir(code, order);
  deepMerge(obj, delta);
  // Rewrite only the namespaces the delta touched (new namespaces included).
  writeLocaleDir(code, obj, Object.keys(delta));
  return countLeaves(obj);
}

// Round-trip self-test: for every locale, load each module file → serialize →
// reload and assert the JSON is identical.
function selftest() {
  let ok = true;
  for (const code of LOCALES) {
    const dir = localeDirPath(code);
    if (!fs.existsSync(dir)) {
      console.log(`SKIP ${code} (no dir)`);
      continue;
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));
    let leaves = 0;
    let localeOk = true;
    for (const f of files) {
      const ns = f.replace(/\.ts$/, "");
      const original = loadModuleFile(path.join(dir, f));
      leaves += countLeaves(original);
      // Re-parse the serialized text the same way loadModuleFile would.
      const tmp = path.join(dir, `.__rt_${ns}.ts`);
      fs.writeFileSync(tmp, serializeModule(ns, original));
      const round = loadModuleFile(tmp);
      fs.rmSync(tmp);
      if (JSON.stringify(original) !== JSON.stringify(round)) {
        localeOk = false;
        ok = false;
        console.log(`  FAIL ${code}/${ns}`);
      }
    }
    console.log(`${localeOk ? "OK " : "FAIL"} ${code}  ${files.length} modules  leaves=${leaves}`);
  }
  console.log(ok ? "\nROUND-TRIP OK for all locales" : "\nROUND-TRIP FAILED");
  if (!ok) process.exit(1);
}

// CLI only when executed directly (NOT when imported — importing must not run this).
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  const [, , arg1, arg2] = process.argv;
  if (arg1 === "--selftest") {
    selftest();
  } else if (arg1 && arg2) {
    const delta = JSON.parse(fs.readFileSync(arg2, "utf8"));
    const leaves = mergeIntoLocale(arg1, delta);
    console.log(`Merged delta into ${arg1}/ — now ${leaves} leaves`);
  }
}
