// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Detects leaves whose value is likely in the WRONG language for its locale
// (untranslated English leaking in, mostly), to feed the per-locale translation
// audit agents. NOT a fixer — it only narrows the ~5457 leaves/locale down to a
// suspect set so agents judge a few hundred candidates instead of everything.
//
// Two signals:
//  • Non-Latin-script locales (ar bn hi ja ko ru): a value containing Latin
//    words [A-Za-z]{2,} that aren't tech tokens/brands/placeholders is almost
//    certainly untranslated. High precision.
//  • Latin-script locales (es fr de it pt): value identical to the EN value
//    (minus tech tokens) — likely copied/untranslated. Noisier (cognates), so
//    agents must judge.
//
// Output: <outDir>/<locale>.candidates.json = [{ ns, path, en, cur }] + summary.
//
// Usage: node scripts/i18n-detect-untranslated.mjs <outDir>

import fs from "fs";
import path from "path";
// flat/strip/offendingLatinWords/NON_LATIN/SCRIPT and the tech allowlist are
// shared with i18n-detect-wrong-lang.mjs (they used to be two drifting copies).
import {
  NON_LATIN,
  SCRIPT,
  flattenToDotted as flat,
  loadLocaleDir,
  offendingLatinWords,
  readCanonicalOrder,
  strip,
} from "./i18n-shared.mjs";

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: node scripts/i18n-detect-untranslated.mjs <outDir>");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const LATIN = ["es", "fr", "de", "it", "pt"]; // en = reference, not audited

const order = readCanonicalOrder();
const en = flat(loadLocaleDir("en", order));
const summary = [];

for (const locale of [...LATIN, ...NON_LATIN]) {
  const cur = flat(loadLocaleDir(locale, order));
  const candidates = [];
  for (const key of Object.keys(en)) {
    const ev = en[key];
    const cv = cur[key];
    if (cv === undefined || typeof cv !== "string") continue;
    const stripped = strip(cv).trim();
    if (!/[A-Za-z-￿]/.test(stripped)) continue; // only punctuation/numbers/placeholders → skip

    let suspect = false;
    if (NON_LATIN.has(locale)) {
      // Clear leak = NO native-script char at all AND there are non-token Latin
      // words. Partially-translated values (native script + tech terms) are fine.
      const hasNative = SCRIPT[locale]?.test(cv) ?? false;
      if (!hasNative && offendingLatinWords(cv).length > 0) suspect = true;
    } else {
      // Latin locale: identical to EN and the EN side has real letters → candidate.
      if (cv === ev && /[A-Za-z]{3,}/.test(stripped) && stripped.length > 2) suspect = true;
    }
    if (suspect) {
      const ns = key.split(".")[0];
      candidates.push({ ns, path: key, en: ev, cur: cv });
    }
  }
  fs.writeFileSync(path.join(outDir, `${locale}.candidates.json`), JSON.stringify(candidates, null, 2));
  const byNs = {};
  for (const c of candidates) byNs[c.ns] = (byNs[c.ns] || 0) + 1;
  summary.push({ locale, count: candidates.length, byNs });
  console.log(`${locale}: ${candidates.length} candidates`);
}

fs.writeFileSync(path.join(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
console.log(`\nTotal candidates: ${summary.reduce((n, s) => n + s.count, 0)} across ${summary.length} locales`);
console.log(`Written to ${outDir}`);
