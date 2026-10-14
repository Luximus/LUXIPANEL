// Backups page — shared i18n + toast + byte formatting. Leaf module (no
// cross-submodule imports), so every submodule can import it freely.
//
// The i18n trio (F-03/T-08) and the toast (F-04) come from the shared extracted
// libs; only the module-specific bindings stay here. `fmtBytes` is NOT the
// canonical `@/lib/format` one: this page never renders a plain-bytes unit
// (sub-KB backups show as "N KB"), so the shared helper would change the strings.
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { showToast as showSharedToast, TOAST_LEGACY_MS } from "/scripts/extracted/lib/toast.js";

export const { loadI18n, t, fmt } = createPageI18n("backups-i18n");

/** F-04: shared toast, kept at the backups page's historical 3000 ms auto-hide. */
export function showToast(msg: string, ok = true) {
  showSharedToast(msg, ok, { durationMs: TOAST_LEGACY_MS });
}

export function fmtBytes(b: number): string {
  if (!b) return "—";
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  return `${(b / 1_024).toFixed(0)} KB`;
}
