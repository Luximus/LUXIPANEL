// Module-dev page — action dispatch (document delegation → handleAction).
import { loadAll } from "./data";
import { createWithAssistant, openChatForModule } from "./assistant";
import { openDetail } from "./detail";
import { openPrDialog } from "./pr";
import { openConfirm } from "./confirm-dialog";
import { runChecks, runTests, installPreview, uninstallPreview } from "./checks";
import { state } from "./state";
import { showToast, t } from "./dom";

// ── Dispatch de acciones (delegación en document) ─────────────────────────────
export function handleAction(action: string, code: string) {
  if (!state.marketplaceAvailable && ["submit", "resubmit", "unpublish", "republish"].includes(action)) {
    showToast(t("toasts.marketplaceUnavailable", "La publicación en el marketplace no está disponible en este panel local."), false);
    return;
  }
  if (state.stale && ["submit", "resubmit", "unpublish", "republish"].includes(action)) {
    showToast(t("toasts.marketplaceStale", "La información del marketplace está desactualizada. Actualiza antes de cambiar el estado del módulo."), false);
    return;
  }
  switch (action) {
    case "retry":
      void loadAll();
      break;
    case "create":
      createWithAssistant();
      break;
    case "detail":
      void openDetail(code);
      break;
    case "chat":
      openChatForModule(code);
      break;
    case "submit":
      openPrDialog("submit", code);
      break;
    case "resubmit":
      openPrDialog("resubmit", code);
      break;
    case "unpublish":
      openConfirm("unpublish", code);
      break;
    case "republish":
      openConfirm("republish", code);
      break;
    case "checks":
      void runChecks(code);
      break;
    case "test":
      void runTests(code);
      break;
    case "preview":
      void installPreview(code);
      break;
    case "preview-uninstall":
      void uninstallPreview(code);
      break;
  }
}
