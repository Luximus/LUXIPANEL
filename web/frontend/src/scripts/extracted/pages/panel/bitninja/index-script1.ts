  import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
  import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
  import { escapeHtml } from "/scripts/extracted/lib/escape.js";
  import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
  import { showToast as showSharedToast } from "/scripts/extracted/lib/toast.js";
  import { readScopedPreference, writeScopedPreference } from "/scripts/extracted/lib/scoped-preferences.js";

  let bnRunId = 0;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  const { loadI18n, t, fmt } = createPageI18n("bitninja-i18n");

  function isBitninjaPage(): boolean {
    return !!document.getElementById("bitninja-root");
  }
  function isActiveRun(runId: number): boolean {
    return isBitninjaPage() && runId === bnRunId;
  }

  function showToast(msg: string, ok = true) {
    showSharedToast(msg, ok);
  }

  function sudoPassword(): string | undefined {
    const el = document.getElementById("bn-sudo") as HTMLInputElement | null;
    const v = el?.value.trim();
    return v ? v : undefined;
  }

  function showOutput(text: string) {
    const pre = document.getElementById("bn-output");
    if (!pre) return;
    if (!text) { pre.classList.add("hidden"); return; }
    pre.textContent = text;
    pre.classList.remove("hidden");
  }

  /** Common handling of a privileged-action response (sudo codes + output). */
  function handleResult(res: any, okMsg: string): boolean {
    const data = res?.data ?? {};
    if (data.code === "SUDO_PASSWORD_REQUIRED") {
      showToast(t("toasts.sudoRequired", "Introduce tu contraseña sudo y reintenta."), false);
      document.getElementById("bn-sudo")?.focus();
      showOutput(data.output ?? "");
      return false;
    }
    if (data.code === "SUDO_PASSWORD_INVALID") {
      showToast(t("toasts.sudoInvalid", "Contraseña sudo inválida."), false);
      document.getElementById("bn-sudo")?.focus();
      return false;
    }
    if (!res?.ok || data.ok === false) {
      showToast(t("toasts.actionFailed", "La acción falló. Revisa la salida."), false);
      showOutput(data.output ?? t("errors.unknown", "Error desconocido"));
      return false;
    }
    showToast(okMsg);
    showOutput(data.output ?? "");
    return true;
  }

  function setText(id: string, text: string, cls?: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (cls) el.className = cls;
  }

  function renderComponents(components: Array<{ name: string; active: boolean }>) {
    const grid = document.getElementById("bn-components");
    if (!grid) return;
    if (!components.length) {
      const noComponentsMsg = t("components.noReported", "El agente no reportó componentes.");
      grid.innerHTML = `<p class="text-xs text-muted-foreground">${noComponentsMsg}</p>`;
      return;
    }
    const activeLabel = t("components.active", "Activo");
    const inactiveLabel = t("components.inactive", "Inactivo");
    grid.innerHTML = components
      .map(
        (c) => `
        <div class="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
          <span class="text-sm font-medium">${escapeHtml(c.name)}</span>
          <button data-bn-component="${escapeHtml(c.name)}" data-bn-active="${c.active ? "1" : "0"}"
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
              c.active ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }">
            <i class="ti ti-${c.active ? "circle-check" : "circle"} text-sm"></i>${c.active ? activeLabel : inactiveLabel}
          </button>
        </div>`,
      )
      .join("");
    grid.querySelectorAll<HTMLButtonElement>("[data-bn-component]").forEach((btn) => {
      btn.addEventListener("click", () => toggleComponent(btn.dataset.bnComponent ?? "", btn.dataset.bnActive !== "1"));
    });
  }

  async function loadStatus(runId = bnRunId) {
    const res = await api.get<any>("/api/bitninja/status");
    if (!isActiveRun(runId)) return;
    if (!res.ok) {
      const badge = document.getElementById("bn-status-badge");
      if (badge) {
        badge.textContent = t("status.error", "No se pudo consultar el estado");
        badge.className = "shrink-0 rounded-full border px-3 py-1 text-xs font-medium border-destructive/30 text-destructive";
      }
      showOutput(res.error ?? t("errors.unknown", "Error desconocido"));
      return;
    }
    const d = (res.data ?? {}) as any;

    const badge = document.getElementById("bn-status-badge");
    const installCard = document.getElementById("bn-install-card");
    const manage = document.getElementById("bn-manage");
    if (!badge || !installCard || !manage) return;

    if (!d.installed) {
      badge.textContent = t("status.notInstalled", "No instalado");
      badge.className = "shrink-0 rounded-full border px-3 py-1 text-xs font-medium border-yellow-500/30 text-yellow-600";
      installCard.classList.remove("hidden");
      manage.classList.add("hidden");
      return;
    }

    installCard.classList.add("hidden");
    manage.classList.remove("hidden");
    const runningLabel = t("status.running", "Activo");
    const stoppedLabel = t("status.installedStopped", "Instalado (detenido)");
    badge.textContent = d.running ? runningLabel : stoppedLabel;
    badge.className = `shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
      d.running ? "border-emerald-500/30 text-emerald-600" : "border-destructive/30 text-destructive"
    }`;

    const serviceRunning = t("status.serviceRunning", "Corriendo");
    const serviceStopped = t("status.serviceStopped", "Detenido");
    const licenseValid = t("status.licenseValid", "Válida");
    const licenseReview = t("status.licenseReview", "Revisar");

    setText("bn-running", d.running ? serviceRunning : serviceStopped,
      `text-lg font-bold ${d.running ? "text-emerald-500" : "text-destructive"}`);
    setText("bn-license-state", d.licenseValid ? licenseValid : licenseReview,
      `text-lg font-bold ${d.licenseValid ? "text-emerald-500" : "text-yellow-600"}`);
    setText("bn-version", d.version || "—", "text-lg font-bold");
    renderComponents(Array.isArray(d.components) ? d.components : []);
  }

  async function installBitNinja() {
    const input = document.getElementById("bn-license-install") as HTMLInputElement | null;
    const licenseKey = input?.value.trim() ?? "";
    const btn = document.getElementById("btn-bn-install") as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    showToast(t("toasts.installing", "Instalando BitNinja… puede tardar unos minutos."));
    try {
      const res = await api.post<any>("/api/bitninja/packages", { ...(licenseKey ? { licenseKey } : {}), sudoPassword: sudoPassword() });
      if (handleResult(res, t("toasts.installed", "BitNinja instalado."))) {
        if (input) input.value = "";
        bnRunId += 1;
        await loadStatus(bnRunId);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function serviceAction(action: string) {
    const res = await api.post<any>("/api/bitninja/service", { action, sudoPassword: sudoPassword() });
    const okMsg = fmt(t("toasts.serviceAction", "Servicio: {action} OK."), { action });
    if (handleResult(res, okMsg)) {
      bnRunId += 1;
      await loadStatus(bnRunId);
    }
  }

  async function toggleComponent(component: string, enabled: boolean) {
    if (!component) return;
    const res = await api.post<any>("/api/bitninja/components", { component, enabled, sudoPassword: sudoPassword() });
    const msgKey = enabled ? "toasts.componentToggleEnabled" : "toasts.componentToggleDisabled";
    const msgTemplate = t(msgKey, enabled ? "{component}: activado." : "{component}: desactivado.");
    const okMsg = fmt(msgTemplate, { component });
    if (handleResult(res, okMsg)) {
      bnRunId += 1;
      await loadStatus(bnRunId);
    }
  }

  async function updateLicense() {
    const input = document.getElementById("bn-license-update") as HTMLInputElement | null;
    const licenseKey = input?.value.trim() ?? "";
    const res = await api.post<any>("/api/bitninja/license", { licenseKey, sudoPassword: sudoPassword() });
    if (handleResult(res, t("toasts.licenseApplied", "License key aplicada."))) {
      if (input) input.value = "";
      bnRunId += 1;
      await loadStatus(bnRunId);
    }
  }

  async function loadLogs() {
    const output = document.getElementById("bn-logs");
    if (!output) return;
    output.textContent = t("logsUi.loading", "Cargando registro…");
    const lines = Number(readScopedPreference("bitninja", "log-lines", "50"));
    const res = await api.get<{ output: string }>(`/api/bitninja/logs?lines=${lines}`);
    if (!isBitninjaPage()) return;
    output.textContent = res.ok ? (res.data?.output || t("logsUi.empty", "No hay eventos recientes.")) : (res.error || t("logsUi.loadError", "No se pudo cargar el registro."));
  }

  function configureRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = undefined;
    if (readScopedPreference("bitninja", "auto-refresh", "false") === "true") {
      refreshTimer = setInterval(() => { if (isBitninjaPage()) void loadStatus(); }, 30_000);
    }
  }

  function bind() {
    document.getElementById("btn-bn-install")?.addEventListener("click", installBitNinja);
    document.getElementById("btn-bn-license")?.addEventListener("click", updateLicense);
    document.getElementById("bn-load-logs")?.addEventListener("click", loadLogs);
    const auto = document.getElementById("bn-auto-refresh") as HTMLInputElement | null;
    if (auto) {
      auto.checked = readScopedPreference("bitninja", "auto-refresh", "false") === "true";
      auto.addEventListener("change", () => {
        writeScopedPreference("bitninja", "auto-refresh", String(auto.checked));
        configureRefresh();
      });
    }
    const lines = document.getElementById("bn-log-lines") as HTMLSelectElement | null;
    if (lines) {
      lines.value = readScopedPreference("bitninja", "log-lines", "50");
      lines.addEventListener("change", () => writeScopedPreference("bitninja", "log-lines", lines.value));
    }
    document.querySelectorAll<HTMLButtonElement>("[data-bn-service]").forEach((btn) => {
      btn.addEventListener("click", () => serviceAction(btn.dataset.bnService ?? ""));
    });
  }

  // Cooldown: module-eval + after-swap + page-load = up to 3 fires per entry.
  let initLastAt = 0;
  const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
  function init() {
    if (!isBitninjaPage()) return;
    if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
    initLastAt = Date.now();
    loadI18n();
    bind();
    configureRefresh();
    bnRunId += 1;
    loadStatus(bnRunId);
  }

  document.addEventListener("astro:before-swap", () => { bnRunId += 1; if (refreshTimer) clearInterval(refreshTimer); refreshTimer = undefined; });
  document.addEventListener("astro:page-load", init);
  document.addEventListener("astro:after-swap", init);
  init();
