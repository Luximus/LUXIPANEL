// Settings page — i18n + toast + small DOM/util helpers (leaf: only shared libs).
//
// The i18n trio (F-03/T-08) and the toast (F-04) come from the shared extracted
// libs. This page carries the `#toast-inner` / `#toast-icon` markup ("family C"),
// which `showToast` auto-detects, so the rendered pill is byte-identical.
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";

// ── i18n helpers ─────────────────────────────────────────────────
export const { loadI18n, t, fmt } = createPageI18n("settings-i18n");

export { showToast } from "/scripts/extracted/lib/toast.js";

export function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return ["true", "1", "yes", "on"].includes(v);
  }
  return Boolean(value);
}

export const PANEL_ASSET_ALIASES: Record<string, string> = {
  "/logo_300.webp": "/panel/logo_300.webp",
  "/logo_150.webp": "/panel/logo_150.webp",
  "/logo_50.webp": "/panel/logo_50.webp",
  "/favicon.ico": "/panel/favicon.ico",
};

export function normalizePanelAssetPath(value: string): string {
  const trimmed = value.trim();
  return PANEL_ASSET_ALIASES[trimmed] ?? trimmed;
}

export function setupToggle(btnId: string, inputId: string) {
  document.getElementById(btnId)?.addEventListener("click", () => {
    const inp = document.getElementById(inputId) as HTMLInputElement | null;
    const icon = document.querySelector(`#${btnId} i`);
    if (!inp || !icon) return;
    if (inp.type === "password") {
      inp.type = "text";
      icon.className = "ti ti-eye-off text-sm";
    } else {
      inp.type = "password";
      icon.className = "ti ti-eye text-sm";
    }
  });
}
