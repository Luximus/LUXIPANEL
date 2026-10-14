// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Generic flat-keymap apply: keys are FULL dotted paths whose FIRST segment is
// the i18n namespace (e.g. "users.permCatalog.mail", "settings.labels.x").
// Validates {placeholders} vs the es reference, nests by path, deep-merges into
// the locale's per-module files (adds keys, never removes). Multi-namespace safe.
//
// Usage: node scripts/i18n-apply-flat.mjs <locale> <flatTranslationsJson> <flatEsRefJson>

import fs from "fs";
import { placeholders as ph, sameSet as same, setDotted } from "./i18n-shared.mjs";
import { mergeIntoLocale } from "./i18n-merge-delta.mjs";

const [, , locale, trPath, refPath] = process.argv;
if (!locale || !trPath || !refPath) {
  console.error("usage: node scripts/i18n-apply-flat.mjs <locale> <translations> <esRef>");
  process.exit(1);
}
const ref = JSON.parse(fs.readFileSync(refPath, "utf8"));
const tr = JSON.parse(fs.readFileSync(trPath, "utf8"));

const nested = {};
let applied = 0;
const issues = [];
for (const key of Object.keys(ref)) {
  let val = tr[key];
  if (typeof val !== "string" || val.trim() === "") { issues.push(`${key}: empty→es`); val = ref[key]; }
  else if (!same(ph(val), ph(ref[key]))) { issues.push(`${key}: placeholder mismatch→es`); val = ref[key]; }
  setDotted(nested, key, val);
  applied++;
}
mergeIntoLocale(locale, nested);
console.log(`${locale}: applied ${applied} keys${issues.length ? ` (${issues.length} fell back to es)` : ""}`);
for (const i of issues.slice(0, 8)) console.log(`   - ${i}`);
