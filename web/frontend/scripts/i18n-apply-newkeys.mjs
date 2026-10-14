// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Applies a flat translation map of NEW assistant keys for one locale: validates
// that every reference key is present and that {placeholders} match the es
// reference, nests the flat dotted keys under the "assistant" namespace, and
// deep-merges them in (adds new keys, never removes existing ones).
//
// Usage: node scripts/i18n-apply-newkeys.mjs <locale> <flatTranslationsJson> <flatEsRefJson>

import fs from "fs";
import { placeholders, sameSet, setDotted } from "./i18n-shared.mjs";
import { mergeIntoLocale } from "./i18n-merge-delta.mjs";

const [, , locale, trPath, refPath] = process.argv;
if (!locale || !trPath || !refPath) {
  console.error("usage: node scripts/i18n-apply-newkeys.mjs <locale> <translations> <esRef>");
  process.exit(1);
}

const ref = JSON.parse(fs.readFileSync(refPath, "utf8"));
const tr = JSON.parse(fs.readFileSync(trPath, "utf8"));

const issues = [];
const clean = {};
for (const key of Object.keys(ref)) {
  const t = tr[key];
  if (typeof t !== "string" || t.trim() === "") {
    issues.push(`${key}: missing/empty → fallback to es`);
    clean[key] = ref[key]; // keep Spanish rather than leave a hole
    continue;
  }
  if (!sameSet(placeholders(t), placeholders(ref[key]))) {
    issues.push(`${key}: placeholder mismatch (ref=${[...placeholders(ref[key])].join(",")} got=${[...placeholders(t)].join(",")}) → fallback`);
    clean[key] = ref[key];
    continue;
  }
  clean[key] = t;
}

// nest flat dotted keys under the assistant namespace
const nested = { assistant: {} };
for (const [path, val] of Object.entries(clean)) setDotted(nested.assistant, path, val);

mergeIntoLocale(locale, nested);
console.log(`${locale}: applied ${Object.keys(clean).length} keys${issues.length ? ` (${issues.length} fell back to es)` : ""}`);
for (const i of issues.slice(0, 10)) console.log(`   - ${i}`);
