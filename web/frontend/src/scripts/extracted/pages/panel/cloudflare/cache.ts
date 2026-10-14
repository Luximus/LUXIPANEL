// Cloudflare page — cache purge (everything / by URL).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { state } from "./state";
import { t, fmt, esc, showToast, $ } from "./dom";

// ── Cache ────────────────────────────────────────────────────────────────────
export async function purgeAll() {
  if (!state.zoneId) return;
  if (!(await openConfirm(t("cache.confirmPurgeAll", "¿Purgar TODA la caché de la zona?"), { title: t("cache.confirmPurgeTitle", "Purgar caché"), confirmText: t("cache.confirmPurgeBtn", "Purgar") }))) return;
  const btn = $("cf-purge-all") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  const res = await api.post(`/api/cloudflare/zones/${encodeURIComponent(state.zoneId)}/purge`, { everything: true });
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("cache.purged", "Caché purgada"));
}

export async function purgeUrls() {
  if (!state.zoneId) return;
  const textarea = $("cf-purge-urls") as HTMLTextAreaElement | null;
  const files = (textarea?.value ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (files.length === 0) return;
  const btn = $("cf-purge-urls-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  const res = await api.post(`/api/cloudflare/zones/${encodeURIComponent(state.zoneId)}/purge`, { files });
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  if (textarea) textarea.value = "";
  showToast(t("cache.purged", "Caché purgada"));
}
