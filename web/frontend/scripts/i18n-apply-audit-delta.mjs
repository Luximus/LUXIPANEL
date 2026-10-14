// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Applies a per-locale wrong-language audit delta (flat {dottedPath: newValue})
// to the per-module source files, with safety gates:
//  • the path MUST already exist in the locale (never introduces new keys);
//  • the new value's placeholder set ({x}) MUST equal the EN reference's set
//    (rejects corrections that drop/add/rename placeholders);
//  • only string leaves are touched.
// Rejected corrections are logged and skipped; accepted ones are deep-merged via
// i18n-merge-delta and written back as per-module files (parity preserved).
//
// Usage: node scripts/i18n-apply-audit-delta.mjs <locale> <deltaJsonPath>

import fs from "fs";
import {
  loadLocaleDir,
  placeholders,
  readCanonicalOrder,
  sameSet,
  setDotted,
} from "./i18n-shared.mjs";
import { mergeIntoLocale } from "./i18n-merge-delta.mjs";

const [, , locale, deltaPath] = process.argv;
if (!locale || !deltaPath) {
  console.error("usage: node scripts/i18n-apply-audit-delta.mjs <locale> <deltaJsonPath>");
  process.exit(1);
}

const order = readCanonicalOrder();
const en = loadLocaleDir("en", order);
const cur = loadLocaleDir(locale, order);

function getPath(obj, dotted) {
  let node = obj;
  for (const part of dotted.split(".")) {
    if (!node || typeof node !== "object" || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}
const flat = JSON.parse(fs.readFileSync(deltaPath, "utf8"));
const nested = {};
let accepted = 0;
const rejected = [];

for (const [dotted, newVal] of Object.entries(flat)) {
  const enVal = getPath(en, dotted);
  const curVal = getPath(cur, dotted);
  if (typeof curVal !== "string") {
    rejected.push(`${dotted}: not a string leaf in ${locale} (skip)`);
    continue;
  }
  if (typeof newVal !== "string" || newVal.trim() === "") {
    rejected.push(`${dotted}: empty/non-string correction (skip)`);
    continue;
  }
  // Placeholder parity vs EN reference (fallback: vs current value).
  const ref = typeof enVal === "string" ? enVal : curVal;
  if (!sameSet(placeholders(newVal), placeholders(ref))) {
    rejected.push(
      `${dotted}: placeholder mismatch ref=${[...placeholders(ref)].join(",")} new=${[...placeholders(newVal)].join(",")}`,
    );
    continue;
  }
  if (newVal === curVal) continue; // no-op
  // Build nested delta.
  setDotted(nested, dotted, newVal);
  accepted++;
}

if (accepted > 0) {
  const leaves = mergeIntoLocale(locale, nested);
  console.log(`${locale}: applied ${accepted} corrections (locale now ${leaves} leaves)`);
} else {
  console.log(`${locale}: 0 corrections applied`);
}
if (rejected.length) {
  console.log(`${locale}: ${rejected.length} rejected:`);
  for (const r of rejected.slice(0, 40)) console.log(`   - ${r}`);
  if (rejected.length > 40) console.log(`   … +${rejected.length - 40} more`);
}
