// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Applies a structure-aware hosting-API-doc translation for one locale, with
// hard validation that the FIXED cells (HTTP method, path, status code, error
// constant, param name/type/default, compactEndpoints id/num/method/path, and
// the status enum) are byte-identical to the English reference. Only the
// translatable cells (descriptions/titles/notes/auth words) may differ.
// On any structural/fixed-cell mismatch the locale is REJECTED (not applied).
//
// Usage: node scripts/i18n-apply-hosting.mjs <locale> <translatedHostingJsonPath>

import fs from "fs";
import { loadModuleFile } from "./i18n-shared.mjs";
import { mergeIntoLocale } from "./i18n-merge-delta.mjs";

const [, , locale, jsonPath] = process.argv;
if (!locale || !jsonPath) {
  console.error("usage: node scripts/i18n-apply-hosting.mjs <locale> <json>");
  process.exit(1);
}

const en = loadModuleFile("./src/i18n/en/hosting.ts");
const tr = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const errs = [];

function eqLen(a, b, label) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) errs.push(`${label}: length ${a?.length} != ${b?.length}`);
}

// isolation.features: 3 objects, both fields translatable (only shape checked).
eqLen(tr.isolation?.features, en.isolation.features, "isolation.features");

// endpoints.rows: keep [0] method, [1] path.
eqLen(tr.endpoints?.rows, en.endpoints.rows, "endpoints.rows");
en.endpoints.rows.forEach((row, i) => {
  const t = tr.endpoints?.rows?.[i] ?? [];
  if (t.length !== 4) errs.push(`endpoints.rows[${i}]: arity ${t.length}!=4`);
  if (t[0] !== row[0]) errs.push(`endpoints.rows[${i}].method "${t[0]}"!="${row[0]}"`);
  if (t[1] !== row[1]) errs.push(`endpoints.rows[${i}].path "${t[1]}"!="${row[1]}"`);
});

// list.params: keep [0] name, [1] type, [2] default; status row [3] enum kept.
eqLen(tr.list?.params, en.list.params, "list.params");
en.list.params.forEach((row, i) => {
  const t = tr.list?.params?.[i] ?? [];
  if (t.length !== 4) errs.push(`list.params[${i}]: arity ${t.length}!=4`);
  for (const j of [0, 1, 2]) if (t[j] !== row[j]) errs.push(`list.params[${i}][${j}] "${t[j]}"!="${row[j]}"`);
  if (row[0] === "status" && t[3] !== row[3]) errs.push(`list.params[status].enum "${t[3]}"!="${row[3]}"`);
});

// errors.rows: keep [0] code, [1] constant.
eqLen(tr.errors?.rows, en.errors.rows, "errors.rows");
en.errors.rows.forEach((row, i) => {
  const t = tr.errors?.rows?.[i] ?? [];
  if (t.length !== 3) errs.push(`errors.rows[${i}]: arity ${t.length}!=3`);
  for (const j of [0, 1]) if (t[j] !== row[j]) errs.push(`errors.rows[${i}][${j}] "${t[j]}"!="${row[j]}"`);
});

// compactEndpoints: keep id, num, method, path.
eqLen(tr.compactEndpoints, en.compactEndpoints, "compactEndpoints");
en.compactEndpoints.forEach((ep, i) => {
  const t = tr.compactEndpoints?.[i] ?? {};
  for (const k of ["id", "num", "method", "path"]) if (t[k] !== ep[k]) errs.push(`compactEndpoints[${i}].${k} "${t[k]}"!="${ep[k]}"`);
});

if (errs.length) {
  console.log(`${locale}: REJECTED — ${errs.length} fixed-cell/structure violations:`);
  for (const e of errs.slice(0, 20)) console.log(`   - ${e}`);
  process.exit(1);
}

const leaves = mergeIntoLocale(locale, { hosting: tr });
console.log(`${locale}: OK — hosting tables applied (locale now ${leaves} leaves)`);
