  import { watchModuleData } from "/scripts/extracted/lib/live-data.js";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
  import { awaitJob } from "/scripts/extracted/lib/job-poll.js?v=1";
  import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
  import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
  import { runInstall, bindInstallModalClose } from "/scripts/extracted/lib/install-modal.js?v=1";
  import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
  import { escapeHtml, escapeJsAttr } from "/scripts/extracted/lib/escape.js";
  import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
  import { showToast as showSharedToast } from "/scripts/extracted/lib/toast.js";
  import { confirmMutateReload } from "/scripts/extracted/lib/crud.js";
  import { openDialog } from "/scripts/extracted/lib/dom.js";
  import { readScopedPreference, writeScopedPreference } from "/scripts/extracted/lib/scoped-preferences.js";

  // F-03/T-08: trío i18n compartido; solo cambia el id del payload.
  const { loadI18n, t, fmt } = createPageI18n("firewall-i18n");

  // Navigation epoch: bumped on init() and on astro:before-swap. Captured by
  // every loader BEFORE its fetch; a response whose captured epoch != current is
  // discarded (the user navigated / re-entered), so a late reply can never paint
  // the wrong target's page.
  let firewallRunId = 0;
  // Per-loader fetch stamps. Each loader bumps ITS OWN counter at fetch-start and
  // discards any response whose stamp is stale — this is the "estampar antes del
  // fetch, descartar atemporalmente" guard for rapid re-calls of the SAME loader
  // (e.g. two mutations within the 4s cooldown). We use one counter per loader on
  // purpose: the four loaders write DISJOINT DOM and run concurrently in init(),
  // so a single shared ++counter would make each sibling wrongly invalidate the
  // others. `firewallRunId` (epoch) handles navigation; these handle supersession.
  let statusRun = 0;
  let rulesRun = 0;
  let jailsRun = 0;
  let auditRun = 0;
  let auditProgressRun = 0;
  let auditReportRun = 0;
  // In-flight security-audit (Lynis) start request. Aborted on SPA navigation so
  // a scan launched right before leaving can't land its result on the wrong
  // target/page. api-client swallows the AbortError into a non-ok status-0
  // response, so we detect the abort via `signal.aborted` (see startAudit).
  let auditAbort: AbortController | null = null;
  let auditSupported: boolean | null = null;
  let firewallRules: any[] = [];

  // Escape user/target-controlled strings before interpolating into innerHTML
  // (jail names, IPs, rule comments come from the connected server / user input).
  // F-02: era el escapador canónico de 5 caracteres, copiado.
  const esc = escapeHtml;

  function isFirewallPage(): boolean {
    return !!document.getElementById("fw-status-card");
  }

  function isActiveRun(runId: number): boolean {
    return isFirewallPage() && runId === firewallRunId;
  }

  function hideSecurityAuditSection() {
    const section = document.getElementById("security-audit-section");
    if (section) section.classList.add("hidden");
  }
  function isSecurityAuditEnabled(): boolean {
    const section = document.getElementById("security-audit-section");
    return section?.getAttribute("data-enabled") === "true";
  }

  /** F-04: toast compartido, con el auto-ocultado histórico de 3000 ms. */
  function showToast(msg: string, ok = true) {
    showSharedToast(msg, ok, { durationMs: 3000 });
  }

  // Toggle the whole page between "needs install" and the normal manager view.
  // When UFW isn't present on the target we show only the install banner and
  // hide the status card, security audit and the rules/jails grid.
  function setInstalledView(installed: boolean) {
    document.getElementById("fw-not-installed")?.classList.toggle("hidden", installed);
    document.getElementById("fw-status-card")?.classList.toggle("hidden", !installed);
    document.getElementById("fw-modules")?.classList.toggle("hidden", !installed);
    // Security audit has its own enablement gate; only reveal it when installed.
    const audit = document.getElementById("security-audit-section");
    if (audit) audit.classList.toggle("hidden", !installed || !isSecurityAuditEnabled());
  }

  async function loadStatus() {
    const epoch = firewallRunId;
    const myRun = ++statusRun;
    const res = await api.get<any>("/api/firewall/status");
    if (myRun !== statusRun || !isActiveRun(epoch)) return;
    if (!res.ok) {
      const label = document.getElementById("fw-status-label");
      if (label) { label.textContent = res.error || t("runtime.statusError", "No se pudo consultar el estado"); label.className = "text-sm font-semibold text-destructive"; }
      return;
    }
    const d = res.data as any;
    const installed = d?.ufw?.installed ?? false;
    setInstalledView(installed);
    if (!installed) return; // nothing else to render until UFW is installed
    const enabled = d?.ufw?.active ?? false;
    const logLevel = document.getElementById("fw-log-level") as HTMLSelectElement | null;
    const currentLevel = String(d?.ufw?.logging || "").match(/\b(off|low|medium|high|full)\b/i)?.[1]?.toLowerCase();
    if (logLevel && currentLevel) logLevel.value = currentLevel;
    const label = document.getElementById("fw-status-label");
    const icon = document.getElementById("fw-icon");
    const policy = document.getElementById("fw-policy");
    const disableBtn = document.getElementById("btn-disable-fw");
    const enableBtn = document.getElementById("btn-enable-fw");
    if (!label || !icon || !policy || !disableBtn || !enableBtn) return;

    label.textContent = enabled ? t("labels.active", "Activo") : t("labels.inactive", "Inactivo");
    label.className = `text-xl font-bold ${enabled ? "text-emerald-500" : "text-destructive"}`;
    icon.className = `flex h-12 w-12 items-center justify-center rounded-xl ${enabled ? "bg-emerald-500/10" : "bg-destructive/10"}`;
    const iconI = icon.querySelector("i");
    if (iconI) {
      iconI.className = `ti ti-shield${enabled ? "-check" : "-off"} text-2xl ${enabled ? "text-emerald-500" : "text-destructive"}`;
    }
    policy.textContent = d?.ufw?.logging ? `${t("labels.logging", "Logging")}: ${d.ufw.logging}` : "";

    disableBtn.classList.toggle("hidden", !enabled);
    enableBtn.classList.toggle("hidden", enabled);
  }

  async function loadRules() {
    const epoch = firewallRunId;
    const myRun = ++rulesRun;
    const res = await api.get<any>("/api/firewall/rules");
    if (myRun !== rulesRun || !isActiveRun(epoch)) return;
    if (!res.ok) {
      const el = document.getElementById("rules-list");
      if (el) el.textContent = res.error || t("runtime.rulesLoadError", "No se pudieron cargar las reglas.");
      return;
    }
    firewallRules = (res.data as any)?.rules ?? res.data ?? [];
    renderRules();
  }

  function renderRules() {
    const el = document.getElementById("rules-list");
    if (!el) return;
    const search = (document.getElementById("fw-rule-search") as HTMLInputElement | null)?.value.trim().toLowerCase() || "";
    const actionFilter = readScopedPreference("firewall", "action-filter", "");
    const visible = firewallRules.filter((rule) =>
      (!actionFilter || String(rule.action || "").toUpperCase().split(/\s+/)[0] === actionFilter)
      && (!search || [rule.to, rule.from, rule.action, rule.comment].some((value) => String(value || "").toLowerCase().includes(search))));
    if (visible.length === 0) {
      el.innerHTML = `<div class="px-5 py-5 text-center text-sm text-muted-foreground">${firewallRules.length ? t("runtime.noMatchingRules", "Ninguna regla coincide con el filtro.") : t("empty.noRules", "Sin reglas")}</div>`;
      return;
    }
    el.innerHTML = visible.map((r: any) => {
      const action = String(r.action ?? "").toUpperCase();
      const allowish = action === "ALLOW" || action === "LIMIT";
      const badgeCls = allowish ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive";
      const dest = r.to && String(r.to).trim() ? esc(r.to) : t("labels.any", "any");
      return `
      <div class="flex items-center justify-between px-5 py-2.5">
        <div class="flex items-center gap-3">
          <span class="inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${badgeCls}">
            ${esc(action || "ALLOW")}
          </span>
          <span class="text-sm font-medium font-mono">${dest}</span>
          ${r.from && r.from !== "any" ? `<span class="text-xs text-muted-foreground">${t("labels.from", "from")} ${esc(r.from)}</span>` : ""}
          ${r.comment ? `<span class="text-xs text-muted-foreground italic">${esc(r.comment)}</span>` : ""}
        </div>
        <button onclick="analyzeRuleWithAssistant(${Number(r.number)})" class="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary" title="${t("aiAssistant.analyzeRule", "Analizar con IA")}">
          <i class="ti ti-sparkles text-sm"></i>
        </button>
        <button onclick="deleteRule(${Number(r.number)})" class="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <i class="ti ti-trash text-sm"></i>
        </button>
      </div>`;
    }).join("");
  }

  async function loadJails() {
    const epoch = firewallRunId;
    const myRun = ++jailsRun;
    const res = await api.get<any>("/api/firewall/fail2ban/jails");
    if (!res.ok || myRun !== jailsRun || !isActiveRun(epoch)) return;
    const jails: any[] = (res.data as any)?.jails ?? res.data ?? [];
    const el = document.getElementById("jails-list");
    if (!el) return;
    if (jails.length === 0) {
      el.innerHTML = `<div class="px-5 py-5 text-center text-sm text-muted-foreground">${t("empty.noJails", "Sin jails activos")}</div>`;
      return;
    }
    el.innerHTML = jails.map((j: any) => {
      const ips: string[] = j.bannedIPs ?? [];
      const count = j.currentlyBanned ?? ips.length;
      return `
      <div class="px-5 py-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-sm font-medium">${esc(j.name)}</span>
          <span class="text-xs text-muted-foreground">${fmt(t("labels.bannedCount", "{count} baneadas"), { count })}</span>
        </div>
        ${ips.slice(0, 5).map((ip: string) => `
          <div class="flex items-center justify-between ml-3 py-0.5">
            <code class="text-xs text-muted-foreground">${esc(ip)}</code>
            <button onclick="unbanIp('${escapeJsAttr(j.name)}', '${escapeJsAttr(ip)}')" class="text-xs text-primary hover:underline">${t("actions.unban", "desbanear")}</button>
          </div>`).join("")}
        ${ips.length > 5 ? `<p class="ml-3 text-xs text-muted-foreground">${fmt(t("labels.moreIps", "+{n} más"), { n: ips.length - 5 })}</p>` : ""}
      </div>`;
    }).join("");
  }

  (window as any).analyzeRuleWithAssistant = (number: number) => {
    const rule = firewallRules.find((item) => Number(item.number) === Number(number));
    if (!rule) return;
    const prompt = fmt(
      t(
        "aiAssistant.promptRule",
        "Analiza esta regla UFW existente del servidor conectado. Explica qué tráfico permite o bloquea, evalúa sus riesgos y sugiere si debe mantenerse, ajustarse o reemplazarse. Si propones cambios, incluye los comandos exactos.\n\nRegla #{number}\nAcción: {action}\nDestino/puerto: {to}\nOrigen: {from}\nProtocolo: {proto}\nComentario: {comment}",
      ),
      {
        number: Number(rule.number) || number,
        action: String(rule.action ?? "—"),
        to: String(rule.to ?? "any"),
        from: String(rule.from ?? "any"),
        proto: String(rule.proto ?? rule.protocol ?? "—"),
        comment: String(rule.comment ?? "—"),
      },
    );
    askAssistant(prompt, "analyzeRule");
  };

  // E-04: secuencia "confirmar → mutar → toast → awaitJob → recargar" compartida.
  (window as any).deleteRule = async (number: number) => {
    // The list can be cached while UFW renumbers rules after a deletion. Send
    // the rule's identity so the backend resolves its current position from a
    // live status read instead of deleting whatever now occupies this number.
    const rule = firewallRules.find((item) => Number(item.number) === number);
    if (!rule) {
      showToast(t("toasts.errorDelete", "No se encontró la regla; actualiza la lista."), false);
      void loadRules();
      return;
    }
    const signature = new URLSearchParams({
      to: String(rule.to ?? ""),
      from: String(rule.from ?? ""),
      action: String(rule.action ?? ""),
      comment: String(rule.comment ?? ""),
    });
    await confirmMutateReload({
      confirm: {
        message: fmt(t("confirm.deleteRuleMsg", "¿Eliminar la regla #{number}?"), { number }),
        options: { title: t("confirm.deleteRuleTitle", "Eliminar regla"), variant: "danger" },
      },
      request: () => api.delete(`/api/firewall/rules/${number}?${signature}`),
      toast: showToast,
      success: t("toasts.ruleDeleted", "Regla eliminada"),
      error: t("toasts.errorDelete", "Error al eliminar"),
      reload: () => { loadRules(); },
    });
  };

  (window as any).unbanIp = async (jail: string, ip: string) => {
    const res = await api.post("/api/firewall/fail2ban/unban", { jail, ip });
    if (res.ok) { showToast(fmt(t("toasts.ipUnbanned", "{ip} desbaneada"), { ip })); loadJails(); }
    else showToast(t("toasts.errorUnban", "Error al desbanear"), false);
  };

  document.getElementById("btn-enable-fw")?.addEventListener("click", async () => {
    const res = await api.post("/api/firewall/enable");
    if (res.ok) { showToast(t("toasts.fwEnabled", "Firewall activado")); loadStatus(); }
    else showToast(t("toasts.errorEnable", "Error al activar"), false);
  });

  document.getElementById("btn-disable-fw")?.addEventListener("click", async () => {
    if (!await openConfirm(t("confirm.disableFwMsg", "¿Desactivar el firewall? El servidor quedará sin protección de red."), { title: t("confirm.disableFwTitle", "Desactivar firewall"), confirmText: t("confirm.disableFwBtn", "Sí, desactivar"), variant: "danger" })) return;
    const res = await api.post("/api/firewall/disable");
    if (res.ok) { showToast(t("toasts.fwDisabled", "Firewall desactivado")); loadStatus(); }
    else showToast(t("toasts.errorDisable", "Error al desactivar"), false);
  });

  // Install UFW + Fail2ban on the target through the shared install modal. The
  // modal shows the live apt log and the helper routes any sudo-password
  // prompt through `withSudo`. In managed mode sudo usually just works via the
  // session passphrase. The backend installs the two packages sequentially to
  // avoid the apt lock.
  bindInstallModalClose("firewall");
  document.getElementById("btn-install-firewall")?.addEventListener("click", async () => {
    const res = await runInstall({
      id: "firewall",
      endpoint: "/api/firewall/install",
      body: { ufw: true, fail2ban: true },
      runningText: t("labels.installingText", "Instalando UFW y Fail2ban… puede tardar unos minutos."),
      successText: t("labels.installSuccessText", "Firewall instalado correctamente."),
    });
    if (res.ok) showToast(t("toasts.fwInstalled", "Firewall instalado"));
    // Refresh regardless: a partial install may still have added UFW.
    loadStatus();
    const view = new URLSearchParams(location.search).get("workspaceView");
    if (!view || view === "rules") loadRules();
    if (!view || view === "fail2ban") loadJails();
  });

  document.getElementById("btn-new-rule")?.addEventListener("click", () => openDialog("dialog-rule"));
  document.getElementById("rule-close")?.addEventListener("click", () => (document.getElementById("dialog-rule") as HTMLDialogElement).close());
  document.getElementById("rule-cancel")?.addEventListener("click", () => (document.getElementById("dialog-rule") as HTMLDialogElement).close());

  document.getElementById("form-rule")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("rule-error")!;
    errEl.classList.add("hidden");
    const body = {
      action: (document.getElementById("rule-action") as HTMLSelectElement).value,
      proto: (document.getElementById("rule-proto") as HTMLSelectElement).value,
      port: (document.getElementById("rule-port") as HTMLInputElement).value,
      from: (document.getElementById("rule-from") as HTMLInputElement).value || "any",
      comment: (document.getElementById("rule-comment") as HTMLInputElement).value || undefined,
    };
    const res = await api.post("/api/firewall/rules", body);
    if (res.ok) {
      (document.getElementById("dialog-rule") as HTMLDialogElement).close();
      showToast(t("toasts.ruleAdded", "Regla agregada"));
      await awaitJob(res);
      loadRules();
      maybeOfferCloudflareEdgeBlock(body.action, body.from);
    } else {
      errEl.textContent = res.error ?? t("errors.addRule", "Error al agregar regla");
      errEl.classList.remove("hidden");
    }
  });

  document.getElementById("btn-ban-ip")?.addEventListener("click", () => openDialog("dialog-ban"));
  document.getElementById("ban-close")?.addEventListener("click", () => (document.getElementById("dialog-ban") as HTMLDialogElement).close());
  document.getElementById("ban-cancel")?.addEventListener("click", () => (document.getElementById("dialog-ban") as HTMLDialogElement).close());

  document.getElementById("form-ban")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ip = (document.getElementById("ban-ip") as HTMLInputElement).value;
    const jail = (document.getElementById("ban-jail") as HTMLSelectElement).value;
    const res = await api.post("/api/firewall/fail2ban/ban", { ip, jail });
    if (res.ok) {
      (document.getElementById("dialog-ban") as HTMLDialogElement).close();
      showToast(fmt(t("toasts.ipBanned", "{ip} baneada en {jail}"), { ip, jail }));
      loadJails();
    } else showToast(t("toasts.errorBan", "Error al banear"), false);
  });

  // ---- CLOUDFLARE INTEGRATION ----
  // Contract gate: applies ONLY to cross-module Cloudflare UI (the edge-block
  // banner deep-linking into /panel/cloudflare), which renders solely when the
  // sidebar contains the cloudflare module link. The allow-preset button is
  // NOT gated: it belongs to the firewall module itself (endpoint
  // /api/firewall/cloudflare-allow, public CF ranges, no token).
  function hasCloudflareModule(): boolean {
    return document.querySelector('a[href="/panel/cloudflare"]') !== null;
  }

  // Light IPv4/IPv6/CIDR shape check (the /panel/cloudflare receiver re-validates).
  function isSpecificIp(value: string): boolean {
    const s = value.trim().toLowerCase();
    if (!s || s === "any") return false;
    if (/^(\d{1,3})(\.\d{1,3}){3}(\/\d{1,2})?$/.test(s)) return true;
    return s.includes(":") && /^[0-9a-f:]+(\/\d{1,3})?$/.test(s);
  }

  // After a successful deny/reject rule on a specific source IP, offer to also
  // block it at the Cloudflare edge (deep link handled by /panel/cloudflare).
  function maybeOfferCloudflareEdgeBlock(action: string, from: string) {
    if (!hasCloudflareModule()) return;
    if (action !== "deny" && action !== "reject") return;
    const ip = String(from ?? "").trim();
    if (!isSpecificIp(ip)) return;
    const banner = document.getElementById("cf-edge-banner");
    if (!banner) return;
    const href = "/panel/cloudflare?tab=access&ip=" + encodeURIComponent(ip);
    banner.innerHTML = `
      <div class="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p class="font-medium"><i class="ti ti-cloud-lock mr-1.5 text-primary"></i>${fmt(t("labels.cfEdgeBlockQuestion", "¿Bloquear {ip} también en el borde de Cloudflare?"), { ip: esc(ip) })}</p>
        <div class="flex shrink-0 items-center gap-2">
          <a href="${href}"
            class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <i class="ti ti-shield-lock text-sm"></i>${t("actions.blockInCloudflare", "Bloquear en Cloudflare")}
          </a>
          <button id="cf-edge-banner-dismiss" aria-label="${t("actions.dismiss", "Descartar")}"
            class="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <i class="ti ti-x text-sm"></i>
          </button>
        </div>
      </div>`;
    banner.classList.remove("hidden");
    document.getElementById("cf-edge-banner-dismiss")?.addEventListener("click", () => {
      banner.classList.add("hidden");
      banner.innerHTML = "";
    });
  }

  // Preset: allow Cloudflare's published ranges on 80/443 (one UFW rule per
  // range, applied by the firewall module as a single write-behind job).
  // Delegated at document level: element-bound listeners die on SPA swaps
  // (this script binds at module-eval), but document persists.
  async function handleCloudflareAllow() {
    const ok = await openConfirm(
      t("confirm.cfAllowMsg", "Se añadirán reglas UFW para permitir 80/443 desde los rangos oficiales de Cloudflare. ¿Continuar?"),
      { title: t("confirm.cfAllowTitle", "Permitir IPs de Cloudflare"), confirmText: t("confirm.cfAllowBtn", "Continuar") },
    );
    if (!ok) return;
    const btn = document.getElementById("btn-cf-allow") as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    try {
      const res = await api.post<any>("/api/firewall/cloudflare-allow");
      if (res.ok) {
        await awaitJob(res);
        const applied = Number((res.data as any)?.applied ?? 0);
        showToast(fmt(t("toasts.cfRulesApplied", "Reglas de Cloudflare aplicadas ({applied})"), { applied }));
        loadRules();
      } else {
        showToast(res.error ?? t("toasts.errorCfRules", "Error al aplicar reglas de Cloudflare"), false);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement | null)?.closest?.("#btn-cf-allow")) void handleCloudflareAllow();
  });

  // ---- AI ASSISTANT INTEGRATION ----
  // The firewall AI buttons drive the shared floating assistant module: they
  // open the chat drawer and auto-send a prompt in a fresh conversation. The
  // assistant has read tools (firewall.ufw_status / firewall.fail2ban_status)
  // so it inspects the *connected server's* real firewall state before
  // answering — no firewall-specific backend endpoint involved.
  function askAssistant(prompt: string, action: string) {
    requestAssistant({
      kind: "prompt",
      prompt,
      submit: "auto",
      conversation: "new",
      origin: { module: "firewall", action },
      target: { agentId: null, projectId: null },
    });
  }

  const promptUfw = () => t(
    "aiAssistant.promptUfw",
    "Analiza el firewall UFW del servidor conectado: revisa su estado y las reglas actuales (usa la herramienta firewall.ufw_status) y sugiéreme reglas UFW inteligentes para mejorar la seguridad sin romper los servicios en uso. Para cada regla propuesta explica el porqué e incluye el comando `ufw` exacto para aplicarla.",
  );
  const promptFail2ban = () => t(
    "aiAssistant.promptFail2ban",
    "Analiza Fail2ban en el servidor conectado: revisa las jails configuradas y las IPs baneadas (usa la herramienta firewall.fail2ban_status) y sugiéreme baneos y mejoras de configuración para protegerlo de ataques de fuerza bruta. Indica jail, IP/rango y motivo, y los comandos para aplicarlo.",
  );
  const promptAnalyze = () => t(
    "aiAssistant.promptAnalyze",
    "Realiza un análisis general de seguridad del firewall del servidor conectado. Revisa el estado de UFW y de Fail2ban (usa las herramientas firewall.ufw_status y firewall.fail2ban_status), identifica riesgos, puertos expuestos y configuraciones débiles, y entrégame recomendaciones priorizadas con los comandos para aplicarlas.",
  );

  document.getElementById("btn-ai-ufw")?.addEventListener("click", () => askAssistant(promptUfw(), "suggestRules"));
  document.getElementById("btn-ai-fail2ban")?.addEventListener("click", () => askAssistant(promptFail2ban(), "suggestBans"));
  document.getElementById("btn-ai-analyze")?.addEventListener("click", () => askAssistant(promptAnalyze(), "analyzeSecurity"));

  // ---- SECURITY AUDIT FUNCTIONS ----
  let currentAuditId: string | null = null;
  let auditCheckInterval: NodeJS.Timeout | null = null;

  async function loadAuditReports() {
    if (!isSecurityAuditEnabled()) {
      auditSupported = false;
      hideSecurityAuditSection();
      return;
    }
    if (auditSupported === false) return;
    const epoch = firewallRunId;
    const myRun = ++auditRun;
    const res = await api.get<any>("/api/security-audit/reports");
    if (res.status === 404) {
      auditSupported = false;
      hideSecurityAuditSection();
      return;
    }
    if (!res.ok || myRun !== auditRun || !isActiveRun(epoch)) return;
    auditSupported = true;
    const reports = (res.data as any) ?? [];
    const el = document.getElementById("audit-reports");
    if (!el) return;

    if (reports.length === 0) {
      el.innerHTML = `<p class="text-sm text-muted-foreground">${t("securityAudit.noReports", "No hay auditorías completadas. Inicia una nueva para comenzar.")}</p>`;
      return;
    }

    el.innerHTML = reports.map((r: any) => {
      const riskColor = r.aiAnalysis?.overallRisk === "critical" ? "destructive" : r.aiAnalysis?.overallRisk === "high" ? "warning" : "emerald";
      const date = new Date(r.startedAt).toLocaleString(document.documentElement.lang || undefined);
      return `
        <div class="p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onclick="viewAuditReport('${esc(r.id)}')">
          <div class="flex items-start justify-between mb-1.5">
            <span class="text-sm font-medium">${date}</span>
            <span class="text-xs font-semibold rounded px-2 py-0.5 ${riskColor === "destructive" ? "bg-destructive/10 text-destructive" : riskColor === "warning" ? "bg-yellow-500/10 text-yellow-500" : "bg-emerald-500/10 text-emerald-500"}">
              ${esc(r.aiAnalysis?.overallRisk?.toUpperCase() ?? t("labels.unknown", "DESCONOCIDO"))}
            </span>
          </div>
          <div class="text-xs text-muted-foreground">
            ${fmt(t("labels.findingsCount", "{n} hallazgos encontrados"), { n: r.findings?.length ?? 0 })}
            ${r.completedAt ? `• ${fmt(t("labels.completedAt", "Completado en {time}"), { time: new Date(r.completedAt).toLocaleTimeString(document.documentElement.lang || undefined) })}` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  async function startAudit() {
    if (!isSecurityAuditEnabled()) return;
    if (auditSupported === false) return;
    // Abort any previous in-flight start and open a fresh controller. Passing the
    // signal lets an SPA navigation (astro:before-swap) cancel a scan launched
    // just before leaving, so its result can't resolve onto the wrong target.
    auditAbort?.abort();
    auditAbort = new AbortController();
    const signal = auditAbort.signal;
    const res = await api.post<any>("/api/security-audit/start", {}, { signal });
    // Aborted by navigation/supersession: api-client swallows the AbortError into
    // a non-ok status-0 response, so we detect it via the signal and bail
    // silently — no spurious "Error al iniciar auditoría" toast.
    if (signal.aborted) return;
    if (res.status === 404) {
      auditSupported = false;
      hideSecurityAuditSection();
      return;
    }
    if (!res.ok) {
      showToast(t("toasts.errorStartAudit", "Error al iniciar auditoría"), false);
      return;
    }

    currentAuditId = res.data?.auditId;
    const progress = document.getElementById("audit-progress");
    const startBtn = document.getElementById("btn-start-audit") as HTMLButtonElement | null;
    if (!progress || !startBtn) return;
    progress.classList.remove("hidden");
    startBtn.disabled = true;

    // Poll for updates. SPA leak guard: a previous audit may still be
    // polling when the user clicks start again (handler reentry during
    // mount, drawer reopen). Always clear the previous handle first.
    if (auditCheckInterval) {
      clearInterval(auditCheckInterval);
      auditCheckInterval = null;
    }
    // 5s (was 2s): the audit report payload grows during the scan and there is
    // no lightweight status endpoint, so a tighter interval was ~30 req/min of
    // increasing size. Skipped entirely while the tab is hidden.
    auditCheckInterval = setInterval(checkAuditProgress, 5000);
  }

  async function checkAuditProgress() {
    if (!currentAuditId) return;
    if (typeof document !== "undefined" && document.hidden) return;

    const epoch = firewallRunId;
    const myRun = ++auditProgressRun;
    const res = await api.get<any>(`/api/security-audit/report/${currentAuditId}`);
    if (!res.ok || myRun !== auditProgressRun || !isActiveRun(epoch)) return;

    const report = res.data as any;
    const progressBar = document.getElementById("audit-progress-bar");
    const progressPct = document.getElementById("audit-progress-pct");
    const scanBitninja = document.getElementById("scan-bitninja");
    const scanLynis = document.getElementById("scan-lynis");
    const scanRkhunter = document.getElementById("scan-rkhunter");
    const scanChkrootkit = document.getElementById("scan-chkrootkit");
    const scanAi = document.getElementById("scan-ai");
    const progressWrap = document.getElementById("audit-progress");
    const startBtn = document.getElementById("btn-start-audit") as HTMLButtonElement | null;
    if (!progressBar || !progressPct || !scanBitninja || !scanLynis || !scanRkhunter || !scanChkrootkit || !scanAi || !progressWrap || !startBtn) return;
    const progress = report?.scanProgress ?? {};
    const avgProgress = (progress.bitninja + progress.lynis + progress.rkhunter + progress.chkrootkit + progress.aiAnalysis) / 5;

    progressBar.style.width = `${avgProgress}%`;
    progressPct.textContent = `${Math.round(avgProgress)}%`;
    scanBitninja.textContent = fmt(t("labels.scanBitNinjaProgress", "BitNinja: {pct}%"), { pct: progress.bitninja });
    scanLynis.textContent = fmt(t("labels.scanLynisProgress", "Lynis: {pct}%"), { pct: progress.lynis });
    scanRkhunter.textContent = fmt(t("labels.scanRkhunterProgress", "Rkhunter: {pct}%"), { pct: progress.rkhunter });
    scanChkrootkit.textContent = fmt(t("labels.scanChkrootkitProgress", "Chkrootkit: {pct}%"), { pct: progress.chkrootkit });
    scanAi.textContent = fmt(t("labels.scanAiProgress", "Análisis IA: {pct}%"), { pct: progress.aiAnalysis });

    if (report?.status === "completed" || report?.status === "failed") {
      if (auditCheckInterval) clearInterval(auditCheckInterval);
      progressWrap.classList.add("hidden");
      startBtn.disabled = false;
      currentAuditId = null;
      showToast(report.status === "completed" ? t("toasts.auditCompleted", "Auditoría completada") : t("toasts.auditFailed", "Auditoría falló"), report.status === "completed");
      loadAuditReports();
    }
  }

  (window as any).viewAuditReport = async (reportId: string) => {
    if (!isSecurityAuditEnabled()) return;
    if (auditSupported === false) return;
    const epoch = firewallRunId;
    const myRun = ++auditReportRun;
    const res = await api.get<any>(`/api/security-audit/report/${reportId}`);
    if (res.status === 404) {
      auditSupported = false;
      hideSecurityAuditSection();
      return;
    }
    // Superseded by a newer view / navigated away: bail silently (no toast, no
    // modal on the new page).
    if (myRun !== auditReportRun || !isActiveRun(epoch)) return;
    if (!res.ok) {
      showToast(t("toasts.errorLoadReport", "Error al cargar reporte"), false);
      return;
    }
    const report = res.data as any;
    const findings = (report?.findings ?? []).sort((a: any, b: any) => {
      const severity = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (severity[a.severity as keyof typeof severity] ?? 4) - (severity[b.severity as keyof typeof severity] ?? 4);
    });

    let html = `
      <div class="space-y-4 max-h-96 overflow-y-auto">
        <div class="space-y-2 pb-4 border-b border-border">
          <h4 class="font-semibold">${t("labels.overallRisk", "Riesgo General")}: <span class="${report.aiAnalysis?.overallRisk === "critical" ? "text-destructive" : report.aiAnalysis?.overallRisk === "high" ? "text-yellow-500" : "text-emerald-500"}">${esc(report.aiAnalysis?.overallRisk?.toUpperCase() ?? t("labels.unknown", "DESCONOCIDO"))}</span></h4>
          ${report.aiAnalysis?.keyThreats?.length ? `<p class="text-sm text-muted-foreground"><strong>${t("labels.keyThreats", "Amenazas clave")}:</strong> ${(report.aiAnalysis.keyThreats as string[]).map(esc).join(", ")}</p>` : ""}
          ${report.aiAnalysis?.recommendations?.length ? `<p class="text-sm text-muted-foreground"><strong>${t("labels.recommendations", "Recomendaciones")}:</strong> ${(report.aiAnalysis.recommendations as string[]).slice(0, 2).map(esc).join("; ")}</p>` : ""}
        </div>
        <div class="space-y-2">
          <h4 class="font-semibold">${fmt(t("labels.findingsTitle", "Hallazgos ({n})"), { n: findings.length })}</h4>
          ${findings.slice(0, 10).map((f: any) => `
            <div class="text-xs p-2 rounded border border-border bg-muted/30">
              <div class="flex items-start gap-2">
                <span class="text-xs font-bold rounded px-1.5 py-0.5 mt-0.5 flex-shrink-0 ${
                  f.severity === "critical" ? "bg-destructive/20 text-destructive" :
                  f.severity === "high" ? "bg-yellow-500/20 text-yellow-600" :
                  f.severity === "medium" ? "bg-blue-500/20 text-blue-600" :
                  f.severity === "low" ? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground"
                }">${esc(f.severity)}</span>
                <div class="flex-1">
                  <p class="font-medium">${esc(f.title)}</p>
                  <p class="text-muted-foreground line-clamp-2">${esc(f.description)}</p>
                  <p class="text-xs text-muted-foreground mt-1">${esc(f.scanner)}</p>
                </div>
              </div>
            </div>
          `).join("")}
          ${findings.length > 10 ? `<p class="text-xs text-muted-foreground text-center py-2">${fmt(t("labels.moreFindingsCount", "+{n} hallazgos más"), { n: findings.length - 10 })}</p>` : ""}
        </div>
      </div>
    `;

    const dlg = document.getElementById("dlg-audit-report") as HTMLDialogElement;
    const reportContent = document.getElementById("audit-report-content");
    if (!dlg || !reportContent) return;
    reportContent.innerHTML = html;
    dlg.showModal();
    showToast(fmt(t("toasts.reportOf", "Reporte de {date}"), { date: new Date(report.startedAt).toLocaleDateString(document.documentElement.lang || undefined) }));
  };

  document.getElementById("btn-start-audit")?.addEventListener("click", startAudit);

  // Cooldown: module-eval + after-swap + page-load = 3 fires/entrada.
  let initLastAt = 0;
  const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
  function init() {
    if (!isFirewallPage()) return;
    const liveRoot = document.getElementById("fw-rules-tbody") ?? document.getElementById("fw-rule-search");
    if (liveRoot) watchModuleData(["firewall/rules"], () => loadRules(), liveRoot);
    if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
    initLastAt = Date.now();
    loadI18n();
    const filter = document.getElementById("fw-filter-action") as HTMLSelectElement | null;
    if (filter) {
      filter.value = readScopedPreference("firewall", "action-filter", "");
      filter.addEventListener("change", () => { writeScopedPreference("firewall", "action-filter", filter.value); renderRules(); });
    }
    document.getElementById("fw-rule-search")?.addEventListener("input", renderRules);
    document.getElementById("fw-save-logging")?.addEventListener("click", async () => {
      const level = (document.getElementById("fw-log-level") as HTMLSelectElement | null)?.value;
      const button = document.getElementById("fw-save-logging") as HTMLButtonElement | null;
      if (!level || !button) return;
      button.disabled = true;
      const res = await api.put("/api/firewall/logging", { level });
      button.disabled = false;
      showToast(res.ok ? t("runtime.loggingSaved", "Nivel de registro guardado.") : (res.error || t("runtime.loggingSaveError", "No se pudo guardar el nivel de registro.")), res.ok);
      if (res.ok) void loadStatus();
    });
    if (!isSecurityAuditEnabled()) {
      auditSupported = false;
      hideSecurityAuditSection();
    }
    firewallRunId += 1;
    const drawerView = new URLSearchParams(location.search).get("workspaceView");
    loadStatus();
    if (!drawerView || drawerView === "rules") loadRules();
    if (!drawerView || drawerView === "fail2ban") loadJails();
    if (!drawerView || drawerView === "audit") loadAuditReports();
  }

  document.addEventListener("astro:before-swap", () => {
    firewallRunId += 1;
    // Cancel the in-flight Lynis/security-audit start so it can't resolve onto
    // the next page's target after the SPA swap.
    auditAbort?.abort();
    auditAbort = null;
    if (auditCheckInterval) {
      clearInterval(auditCheckInterval);
      auditCheckInterval = null;
    }
  });
  document.addEventListener("astro:page-load", init);
  document.addEventListener("astro:after-swap", init);
  init();
