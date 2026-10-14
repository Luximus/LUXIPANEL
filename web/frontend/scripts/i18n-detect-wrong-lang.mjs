// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Comprehensive wrong-language detector for ALL 12 locales (including en).
// A leaf is a candidate when its value looks like it's in the WRONG language:
//  • Non-Latin locales (ar bn hi ja ko ru): value has NO native-script char but
//    has non-token Latin letters → untranslated (English/Spanish) leak.
//  • Latin locales + en (es en fr de it pt): value is byte-identical to the es
//    OR the en reference (a different language than the locale), minus tokens.
//    Catches Spanish-in-en, Spanish-in-fr, English-in-es, etc.
// Each candidate carries en + es + cur so the audit agent knows the meaning.
//
// Output: <outDir>/<locale>.candidates.json = [{ns,path,en,es,cur,match}] + summary.
//
// Usage: node scripts/i18n-detect-wrong-lang.mjs <outDir>

import fs from "fs";
import path from "path";
// flat/strip/offendingLatin/NON_LATIN/SCRIPT and the tech allowlist are shared
// with i18n-detect-untranslated.mjs (they used to be two drifting copies).
import {
  LOCALES,
  NON_LATIN,
  SCRIPT,
  TECH_ALLOW as ALLOW,
  flattenToDotted as flat,
  loadLocaleDir,
  offendingLatinWords as offendingLatin,
  readCanonicalOrder,
  strip,
} from "./i18n-shared.mjs";

const outDir = process.argv[2];
if (!outDir) { console.error("usage: node scripts/i18n-detect-wrong-lang.mjs <outDir>"); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const TOKEN_RE = /^(\s*|[\d\s.,:%\/|+\-–—()<>\[\]{}#@*•·…'"]+)$/;

const order = readCanonicalOrder();
const data = Object.fromEntries(LOCALES.map((l) => [l, flat(loadLocaleDir(l, order))]));
const en = data.en, es = data.es;
const summary = [];

for (const locale of LOCALES) {
  const cur = data[locale];
  const candidates = [];
  for (const key of Object.keys(en)) {
    const cv = cur[key];
    if (typeof cv !== "string") continue;
    const stripped = strip(cv).trim();
    if (TOKEN_RE.test(cv) || !/[A-Za-zÀ-ÿ]{2,}/.test(stripped)) continue;
    if (ALLOW.has(cv.trim())) continue;

    let match = null;
    if (NON_LATIN.has(locale)) {
      const hasNative = SCRIPT[locale]?.test(cv) ?? false;
      if (!hasNative && offendingLatin(cv).length > 0) match = "latin-leak";
    } else {
      // Latin/en locale: value identical to a DIFFERENT-language reference.
      // (TOKEN_RE/ALLOW above already dropped pure tokens; the rest the agent judges.)
      if (locale !== "es" && cv === es[key]) match = "es";
      else if (locale !== "en" && cv === en[key]) match = "en";
    }
    if (match) candidates.push({ ns: key.split(".")[0], path: key, en: en[key], es: es[key], cur: cv, match });
  }
  fs.writeFileSync(path.join(outDir, `${locale}.candidates.json`), JSON.stringify(candidates, null, 2));
  const byMatch = {};
  for (const c of candidates) byMatch[c.match] = (byMatch[c.match] || 0) + 1;
  summary.push({ locale, count: candidates.length, byMatch });
  console.log(`${locale}: ${candidates.length} candidates ${JSON.stringify(byMatch)}`);
}
fs.writeFileSync(path.join(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
console.log(`\nTotal: ${summary.reduce((n, s) => n + s.count, 0)} across ${LOCALES.length} locales → ${outDir}`);
