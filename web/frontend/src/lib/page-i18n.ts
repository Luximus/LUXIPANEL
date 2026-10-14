// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `loadI18n()` / `t()` / `fmt()` for extracted page scripts (F-03).
 *
 * Astro pages embed their i18n slice as
 * `<script type="application/json" id="<module>-i18n">…</script>`; 26 modules
 * copied the same three functions byte for byte, differing ONLY in that id.
 * `createPageI18n(elementId)` returns the trio bound to one id.
 *
 *   const { loadI18n, t, fmt } = createPageI18n("users-i18n");
 *   loadI18n();                       // from init(), on every astro:page-load
 *   t("table.title", "Usuarios");     // dotted path + verbatim ES fallback
 *   fmt(t("deleted", "{n} borrados"), { n: 3 });
 *
 * NOTE on `fmt`: it keeps the page-script semantics (`key in vars` → a var
 * explicitly set to `undefined` renders as "undefined"), NOT the
 * `@/i18n/client` `formatMessage` one (missing/undefined → keep the
 * `{placeholder}`). They agree for every real value; the distinction only
 * matters for an explicitly-undefined var.
 *
 * Dual consumption (mirrors api-client.ts / script-init.ts):
 *  • React/Astro: `import { createPageI18n } from "@/lib/page-i18n"`.
 *  • Extracted page scripts (esbuild `bundle:false`): import via the runtime URL
 *    `/scripts/extracted/lib/page-i18n.js`. THAT ENTRY MUST BE ADDED to
 *    `scripts/build-extracted.mjs` (`entry: "src/lib/page-i18n.ts"`,
 *    `outfile: "public/scripts/extracted/lib/page-i18n.js"`, `target: "es2020"`)
 *    or the pages import a missing module.
 * Standalone (no imports).
 */

export interface PageI18n {
  /** (Re)read the embedded JSON. Safe to call on every `init()`. */
  loadI18n(): void;
  /** Dotted-path lookup with a verbatim fallback (never returns undefined). */
  t(path: string, fallback: string): string;
  /** `{key}` interpolation over an already-resolved template. */
  fmt(template: string, vars: Record<string, string | number>): string;
  /** The raw parsed slice (empty object until `loadI18n()` runs). */
  readonly messages: () => Record<string, unknown>;
}

export function createPageI18n(elementId: string): PageI18n {
  let i18n: Record<string, unknown> = {};

  return {
    loadI18n(): void {
      try {
        const el = document.getElementById(elementId);
        if (el?.textContent) i18n = JSON.parse(el.textContent) as Record<string, unknown>;
      } catch {
        i18n = {};
      }
    },
    t(path: string, fallback: string): string {
      let node: unknown = i18n;
      for (const part of path.split(".")) {
        if (!node || typeof node !== "object") return fallback;
        node = (node as Record<string, unknown>)[part];
      }
      return typeof node === "string" ? node : fallback;
    },
    fmt(template: string, vars: Record<string, string | number>): string {
      return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
    },
    messages: () => i18n,
  };
}
