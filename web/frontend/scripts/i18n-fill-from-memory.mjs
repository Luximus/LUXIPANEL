// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Reuse an unambiguous existing translation of the same Spanish UI text.
// Dry run by default; --apply updates only currently missing leaves.

import fs from "node:fs";
import path from "node:path";
import {
  LOCALES, SCRIPT, NON_LATIN, I18N_DIR, loadLocaleDir, loadModuleFile,
  placeholders, sameSet, serializeModule, setDotted,
} from "./i18n-shared.mjs";

const apply = process.argv.includes("--apply");
const locales = LOCALES.filter((locale) => locale !== "es" && locale !== "en");
const flat = (value, prefix = "", out = {}) => {
  for (const [key, child] of Object.entries(value ?? {})) {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") out[dotted] = child;
    else if (child && typeof child === "object" && !Array.isArray(child)) flat(child, dotted, out);
  }
  return out;
};
const source = flat(loadLocaleDir("es"));

for (const locale of locales) {
  const current = flat(loadLocaleDir(locale));
  const memory = new Map();
  for (const [key, spanish] of Object.entries(source)) {
    const translated = current[key];
    if (typeof translated !== "string" || translated === spanish) continue;
    if (NON_LATIN.has(locale) && !SCRIPT[locale].test(translated)) continue;
    if (!memory.has(spanish)) memory.set(spanish, new Set());
    memory.get(spanish).add(translated);
  }

  const additions = [];
  for (const [key, spanish] of Object.entries(source)) {
    if (key in current) continue;
    // Dotted dictionary property names need their original segment arrays;
    // this conservative pass only handles ordinary dotted paths.
    if (key.includes("..") || key.includes("/")) continue;
    const translations = memory.get(spanish);
    if (translations?.size !== 1) continue;
    const translated = [...translations][0];
    if (!sameSet(placeholders(spanish), placeholders(translated))) continue;
    additions.push({ key, translated });
  }

  if (apply) {
    const files = new Map();
    for (const { key, translated } of additions) {
      const [namespace, ...segments] = key.split(".");
      let file = path.join(I18N_DIR, locale, `${namespace}.ts`);
      let objectPath = segments;
      if (namespace === "assistant") {
        const section = segments[0];
        const part = [1, 2, 3].find((n) =>
          Object.hasOwn(loadModuleFile(path.join(I18N_DIR, locale, "assistant", `part${n}.ts`)), section),
        );
        if (!part) throw new Error(`${locale}: no assistant part contains ${section}`);
        file = path.join(I18N_DIR, locale, "assistant", `part${part}.ts`);
      }
      if (!files.has(file)) {
        const exists = fs.existsSync(file);
        files.set(file, {
          body: exists ? loadModuleFile(file) : {},
          original: exists ? fs.readFileSync(file, "utf8") : "",
          name: namespace === "assistant" ? `assistantPart${path.basename(file).match(/\d+/)?.[0]}` : namespace,
        });
      }
      setDotted(files.get(file).body, objectPath.join("."), translated);
    }
    for (const [file, { body, original, name }] of files) {
      const header = original.startsWith("//") ? original.slice(0, original.indexOf("const ")) : "";
      fs.writeFileSync(file, header + serializeModule(name, body));
    }
  }
  console.log(`${locale}: ${additions.length} unambiguous missing translations ${apply ? "filled" : "available"}`);
}
