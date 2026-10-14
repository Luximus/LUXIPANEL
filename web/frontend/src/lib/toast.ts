// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared bottom-right toast (F-04).
 *
 * `showToast(msg, ok)` was re-declared in 27 page scripts with three
 * divergent families:
 *   A. plain `#toast` + `#toast-msg`, 3000 ms, `getElementById(…)!` (no guard);
 *   B. same markup, 3500 ms, with an `if (!toast) return` guard;
 *   C. `#toast` wrapper + `#toast-inner` + `#toast-icon`, 3500 ms.
 *
 * This module keeps the SAME `showToast(msg, ok = true)` signature for all
 * three and auto-detects the markup: if `#toast-inner` exists it renders the C
 * layout (icon + tinted pill), otherwise the A/B one (the flat pill). Missing
 * nodes are a silent no-op — the `!` variants crashed the handler instead.
 *
 * Dual consumption (mirrors api-client.ts / confirm.ts / job-poll.ts):
 *  • React/Astro: `import { showToast } from "@/lib/toast"`.
 *  • Extracted page scripts (esbuild `bundle:false`): import via the runtime URL
 *    `/scripts/extracted/lib/toast.js`. THAT ENTRY MUST BE ADDED to
 *    `scripts/build-extracted.mjs` (`entry: "src/lib/toast.ts"`,
 *    `outfile: "public/scripts/extracted/lib/toast.js"`, `target: "es2020"`)
 *    or the pages import a missing module.
 * Standalone (no imports).
 */

/** Default auto-hide delay. Families B and C already used this value. */
export const TOAST_DURATION_MS = 3500;

/** Legacy family-A auto-hide delay. Some modules still rely on the shorter
 *  3000 ms timing verbatim; pass this as `durationMs` to preserve it. Named so
 *  the value has a single source — do NOT "align" it to TOAST_DURATION_MS. */
export const TOAST_LEGACY_MS = 3000;

/** Flat pill markup (`#toast` is the styled element itself). */
const TOAST_FLAT_CLASS = "fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border px-4 py-3 shadow-lg text-sm font-medium";
const TOAST_FLAT_OK = "border-emerald-500/30 bg-card text-emerald-500";
const TOAST_FLAT_ERR = "border-destructive/30 bg-card text-destructive";

/** Wrapper markup (`#toast-inner` is the styled element, `#toast-icon` leads). */
const TOAST_INNER_CLASS = "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm";
const TOAST_INNER_OK = "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
const TOAST_INNER_ERR = "border-destructive/30 bg-destructive/10 text-destructive";

export interface ShowToastOptions {
  /** Auto-hide delay in ms. Pass 3000 to keep the family-A timing verbatim. */
  durationMs?: number;
  /** Override the DOM ids (defaults: `toast` / `toast-msg` / `toast-inner` / `toast-icon`). */
  ids?: { toast?: string; msg?: string; inner?: string; icon?: string };
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string, ok = true, options: ShowToastOptions = {}): void {
  if (typeof document === "undefined") return;
  const ids = options.ids ?? {};
  const toast = document.getElementById(ids.toast ?? "toast");
  const msgEl = document.getElementById(ids.msg ?? "toast-msg");
  if (!toast || !msgEl) return;

  msgEl.textContent = msg;

  const inner = document.getElementById(ids.inner ?? "toast-inner");
  if (inner) {
    inner.className = `${TOAST_INNER_CLASS} ${ok ? TOAST_INNER_OK : TOAST_INNER_ERR}`;
    const icon = document.getElementById(ids.icon ?? "toast-icon");
    if (icon) icon.className = `text-base ${ok ? "ti ti-circle-check" : "ti ti-circle-x"}`;
    toast.classList.remove("hidden");
  } else {
    // Replacing `className` wholesale is what drops the `hidden` class here.
    toast.className = `${TOAST_FLAT_CLASS} ${ok ? TOAST_FLAT_OK : TOAST_FLAT_ERR}`;
  }

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toast.classList.add("hidden"), options.durationMs ?? TOAST_DURATION_MS);
}
