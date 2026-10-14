// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Audit source dictionaries before their JSON assets are generated.
// Usage: node scripts/i18n-audit-coverage.mjs [--json]

import { LOCALES, loadLocaleDir, readCanonicalOrder } from "./i18n-shared.mjs";

const order = readCanonicalOrder() ?? [];
const reference = loadLocaleDir("es", order);
const flatten = (value, prefix = "", out = {}) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, out);
  } else {
    out[prefix] = value;
  }
  return out;
};
const referenceLeaves = flatten(reference);
const tokens = (value) => [...String(value).matchAll(/\{[a-zA-Z_][\w.]*\}/g)].map(([match]) => match).sort();
const issues = {};

for (const locale of LOCALES) {
  const leaves = flatten(loadLocaleDir(locale, order));
  const missing = Object.keys(referenceLeaves).filter((key) => !(key in leaves));
  const extra = Object.keys(leaves).filter((key) => !(key in referenceLeaves));
  const type = Object.keys(referenceLeaves).filter((key) => key in leaves && typeof referenceLeaves[key] !== typeof leaves[key]);
  const placeholders = Object.keys(referenceLeaves).filter((key) =>
    key in leaves && JSON.stringify(tokens(referenceLeaves[key])) !== JSON.stringify(tokens(leaves[key])),
  );
  const empty = Object.keys(leaves).filter((key) => typeof leaves[key] === "string" && !leaves[key].trim() && String(referenceLeaves[key] ?? "").trim());
  issues[locale] = { leaves: Object.keys(leaves).length, missing, extra, type, placeholders, empty };
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ referenceLeaves: Object.keys(referenceLeaves).length, issues }, null, 2));
} else {
  console.log(`Reference: ${Object.keys(referenceLeaves).length} leaves, ${order.length} namespaces`);
  for (const [locale, result] of Object.entries(issues)) {
    console.log(`${locale}: ${result.leaves} leaves; missing ${result.missing.length}; extra ${result.extra.length}; type ${result.type.length}; placeholders ${result.placeholders.length}; empty ${result.empty.length}`);
    for (const kind of ["missing", "extra", "type", "placeholders", "empty"]) {
      if (result[kind].length) console.log(`  ${kind}: ${result[kind].slice(0, 25).join(", ")}${result[kind].length > 25 ? " …" : ""}`);
    }
  }
}

if (Object.values(issues).some(({ missing, extra, type, placeholders, empty }) => missing.length || extra.length || type.length || placeholders.length || empty.length)) process.exitCode = 1;
