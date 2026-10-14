// Cron page — system deps (generic banner) + daemon service banner.
import { initModuleDeps } from "/scripts/extracted/lib/module-deps.js?v=20260609a";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { withSudo } from "/scripts/extracted/lib/sudo.js?v=20260506c";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { t, $, showToast } from "./dom";
import { loadJobs } from "./jobs";
import { loadAgents } from "./agents";

  // ---------------------------------------------------------------------------
  // System deps (generic banner) + daemon service banner
  // ---------------------------------------------------------------------------
  // "Not installed" is handled by the generic <ModuleDepsBanner module="cron">
  // (check via GET /api/system-deps/cron). The INSTALL keeps the cron module's
  // own endpoint because it does extra setup besides the package (runner
  // wrapper + /opt/luxipanel/cron/bin — see cron-daemon.service.ts). Its body
  // is compatible: the helper sends { keys, sudoPassword? } and the endpoint
  // only reads sudoPassword.
  let depsWereMissing = false;
  export function checkDeps() {
    void initModuleDeps({
      module: "cron",
      installEndpoint: "/api/cron/install",
      onReady: () => {
        const wasMissing = depsWereMissing;
        depsWereMissing = false;
        loadServiceStatus();
        if (wasMissing) {
          loadJobs();
          loadAgents();
        }
      },
      onMissing: () => {
        depsWereMissing = true;
        // Without the package there is no service state worth showing.
        $("cron-install-banner")?.classList.add("hidden");
      },
    });
  }

  /** Shows the amber banner only when cron is installed but the daemon is stopped. */
  export async function loadServiceStatus() {
    const banner = $("cron-install-banner");
    const res = await api.get<any>("/api/cron/status");
    if (!res.ok) { banner?.classList.add("hidden"); $("cron-service-state")!.textContent = res.error || t("toasts.error", "Error"); return; }
    const d = res.data ?? {};
    const active = Boolean(d.service?.active);
    const state = $("cron-service-state");
    if (state) state.textContent = !d.installed ? t("settings.notInstalled", "Cron no está instalado") : active ? t("settings.active", "Servicio activo") : t("service.stopped", "El servicio cron está detenido");
    const unit = $("cron-service-unit"); if (unit) unit.textContent = d.service?.unit || "";
    $("cron-service-enable")?.classList.toggle("hidden", !d.installed || active);
    $("cron-service-disable")?.classList.toggle("hidden", !d.installed || !active);
    if (d.installed && !d.service?.active) {
      $("cron-banner-title")!.textContent = t("service.stopped", "El servicio cron está detenido");
      $("cron-banner-desc")!.textContent = t("service.stoppedDesc", "Las tareas no se ejecutarán hasta activarlo.");
      banner?.classList.remove("hidden");
    } else {
      banner?.classList.add("hidden");
    }
  }

  export function wireService() {
    $("cron-settings-modal-trigger")?.addEventListener("click", () => void loadServiceStatus());
    const change = async (action: "enable" | "disable") => {
      if (action === "disable" && !await openConfirm(t("settings.disableConfirm", "¿Detener el servicio Cron? Las tareas dejarán de ejecutarse."), { title: t("settings.disable", "Detener servicio"), variant: "danger" })) return;
      const res = await withSudo((sudoPassword: string | undefined) => api.post(`/api/cron/service/${action}`, { sudoPassword }));
      showToast(res.ok ? (action === "enable" ? t("toasts.serviceEnabled", "Servicio activado") : t("settings.disabled", "Servicio detenido")) : (res.error || t("toasts.serviceEnableError", "No se pudo cambiar el servicio")), res.ok);
      if (res.ok) void loadServiceStatus();
    };
    $("btn-enable-service")?.addEventListener("click", () => void change("enable"));
    $("cron-service-enable")?.addEventListener("click", () => void change("enable"));
    $("cron-service-disable")?.addEventListener("click", () => void change("disable"));
  }
