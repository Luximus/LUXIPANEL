// Module-dev page — PR dialog (submit / resubmit a module to review).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { state, moduleForCode } from "./state";
import { t, showToast, $ } from "./dom";
import { loadAll } from "./data";

// ── Diálogo PR (enviar / reenviar) ───────────────────────────────────────────
export function openPrDialog(mode: "submit" | "resubmit", code: string) {
  state.prMode = mode;
  state.prCode = code;
  const dlg = $("dlg-md-pr") as HTMLDialogElement | null;
  if (!dlg) return;
  const title = $("md-pr-title");
  if (title) {
    title.textContent =
      mode === "submit"
        ? t("modals.submitTitle", "Enviar módulo a revisión")
        : t("modals.resubmitTitle", "Reenviar módulo corregido");
  }
  const codeEl = $("md-pr-code");
  if (codeEl) codeEl.textContent = code;
  const input = $("md-pr-url") as HTMLInputElement | null;
  if (input) {
    const mod = moduleForCode(code);
    input.value = mod?.prUrl ?? "";
  }
  $("md-pr-error")?.classList.add("hidden");
  dlg.showModal();
  setTimeout(() => input?.focus(), 50);
}

export async function submitPr() {
  const input = $("md-pr-url") as HTMLInputElement | null;
  const errorEl = $("md-pr-error");
  const prUrl = input?.value.trim() ?? "";
  if (!/^https:\/\/.+/.test(prUrl)) {
    if (errorEl) {
      errorEl.textContent = t("modals.prUrlInvalid", "Indica la URL https del Pull Request.");
      errorEl.classList.remove("hidden");
    }
    return;
  }
  const saveBtn = $("md-pr-save") as HTMLButtonElement | null;
  if (saveBtn) saveBtn.disabled = true;
  const res =
    state.prMode === "submit"
      ? await api.post("/api/module-dev/modules/submit", { moduleId: state.prCode, prUrl })
      : await api.post(`/api/module-dev/modules/${encodeURIComponent(state.prCode)}/resubmit`, { prUrl });
  if (saveBtn) saveBtn.disabled = false;
  if (!res.ok) {
    if (errorEl) {
      errorEl.textContent = res.error ?? t("toasts.actionFailed", "La operación falló");
      errorEl.classList.remove("hidden");
    }
    return;
  }
  ($("dlg-md-pr") as HTMLDialogElement | null)?.close();
  showToast(
    state.prMode === "submit"
      ? t("toasts.submitted", "Módulo enviado a revisión")
      : t("toasts.resubmitted", "Módulo reenviado a revisión"),
  );
  await loadAll();
}
