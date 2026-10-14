// Module-dev page — confirm dialog (unpublish / republish a module).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { state } from "./state";
import { t, fmt, showToast, $ } from "./dom";
import { loadAll } from "./data";

// ── Confirmación (despublicar / reactivar) ───────────────────────────────────
export function openConfirm(mode: "unpublish" | "republish", code: string) {
  state.confirmMode = mode;
  state.confirmCode = code;
  const dlg = $("dlg-md-confirm") as HTMLDialogElement | null;
  if (!dlg) return;
  const title = $("md-confirm-title");
  const body = $("md-confirm-body");
  if (title) {
    title.textContent =
      mode === "unpublish"
        ? t("modals.unpublishTitle", "Despublicar módulo")
        : t("modals.republishTitle", "Reactivar módulo");
  }
  if (body) {
    const template =
      mode === "unpublish"
        ? t("modals.unpublishBody", "El módulo {code} pasará a estado inactivo y dejará de estar disponible en el marketplace. Podrás reactivarlo más tarde.")
        : t("modals.republishBody", "El módulo {code} volverá a estar público en el marketplace.");
    body.textContent = fmt(template, { code });
  }
  dlg.showModal();
}

export async function runConfirm() {
  const { confirmMode: mode, confirmCode: code } = state;
  const okBtn = $("md-confirm-ok") as HTMLButtonElement | null;
  if (okBtn) okBtn.disabled = true;
  const res = await api.post(`/api/module-dev/modules/${encodeURIComponent(code)}/${mode}`, {});
  if (okBtn) okBtn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("toasts.actionFailed", "La operación falló"), false);
    return;
  }
  ($("dlg-md-confirm") as HTMLDialogElement | null)?.close();
  showToast(
    mode === "unpublish"
      ? t("toasts.unpublished", "Módulo despublicado")
      : t("toasts.republished", "Módulo reactivado"),
  );
  await loadAll();
}
