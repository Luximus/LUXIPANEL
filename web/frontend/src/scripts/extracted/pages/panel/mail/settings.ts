import { loadAccountCatalog } from "./account-catalog";
// Mail page — settings modal views (routing/redirect/default-address/archive/
// encryption/outbound), main tab switching + counts, and their bindings.
import { api, resolvePanelApiPath, scopeHeaders, resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { api as panelApi } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { setCollapsed } from "/scripts/extracted/lib/dom.js";
import { setUnderlineTabState, tabDirectionOf } from "/scripts/extracted/lib/tabs.js";
import { switchView } from "/scripts/extracted/lib/dom.js";
import type { ArchiveSettings, EncryptionSettings, MailMainTab, MailSettingsView } from "./state";
import { S } from "./state";
import { escapeAttr, escapeHtml, fmt, showToast, t } from "./dom";
import { publishMailTable } from "./table-bridge";
import { loadGlobalFilters, resetGlobalFilterForm } from "./filters";
import { loadDefaultAddressRules, loadDomainForwardRules, loadDomains, loadMailDomainRouting, refreshDefaultAddressFormFromSelectedDomain, refreshMailRoutingFormFromSelectedDomain, resetDomainForwardForm, setDefaultAddressError, setDomainRedirectError, setMailRoutingError } from "./domains";
import { loadSpamFilters } from "./spam";
import { loadTrackDeliveryReport } from "./tracking";

const ui = (key: string, fallback: string) => t(`settingsRuntime.${key}`, fallback);
const pageLocale = () => document.documentElement.lang || undefined;

function archiveRetentionOptionsHtml(selected: number | "custom", customDays: number | null): string {
  const options = [
    [32, t("archive.retentionOptions.oneMonth", "1 Month")],
    [93, t("archive.retentionOptions.threeMonths", "3 Months")],
    [181, t("archive.retentionOptions.sixMonths", "6 Months")],
    [366, t("archive.retentionOptions.oneYear", "1 Year")],
    [731, t("archive.retentionOptions.twoYears", "2 Years")],
    [1826, t("archive.retentionOptions.fiveYears", "5 Years")],
    [3651, t("archive.retentionOptions.tenYears", "10 Years")],
    [0, t("archive.retentionOptions.forever", "Forever")],
    ["custom", t("archive.retentionOptions.custom", "Custom")],
  ] as const;
  return options.map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("")
    + '';
}

function renderArchiveRows() {
  const container = document.getElementById("mail-archive-domain-rows");
  if (!container) return;
  const ds = S.mailArchiveSettings?.domains ?? {};
  container.innerHTML = (S.domains || []).map((domain) => {
    const row = ds[domain] ?? { ...(S.mailArchiveSettings?.defaults ?? { incoming: false, outgoingMailingList: false, outgoing: false }), retentionDays: 0, customRetentionDays: null };
    const showCustom = row.retentionDays === "custom";
    return `<div class="rounded-lg border border-border p-3">
      <div class="mb-2 text-sm font-medium">${escapeHtml(domain)}</div>
      <div class="space-y-2 text-sm">
        <label class="flex items-center gap-2"><input type="checkbox" data-arch-domain="${escapeAttr(domain)}" data-arch-field="incoming" ${row.incoming ? "checked" : ""}/> ${t("archive.fields.incomingEmail", "Incoming Email Messages")}</label>
        <label class="flex items-center gap-2"><input type="checkbox" data-arch-domain="${escapeAttr(domain)}" data-arch-field="outgoingMailingList" ${row.outgoingMailingList ? "checked" : ""}/> ${t("archive.fields.outgoingMailingList", "Outgoing Mailing List Email Messages")}</label>
        <label class="flex items-center gap-2"><input type="checkbox" data-arch-domain="${escapeAttr(domain)}" data-arch-field="outgoing" ${row.outgoing ? "checked" : ""}/> ${t("archive.fields.outgoingEmail", "Outgoing Email Messages")}</label>
        <div class="flex items-center gap-2">
          <select data-arch-domain="${escapeAttr(domain)}" data-arch-field="retentionDays" class="h-9 rounded-md border border-input bg-background px-2 text-xs">${archiveRetentionOptionsHtml(row.retentionDays, row.customRetentionDays)}</select>
          <input data-arch-domain="${escapeAttr(domain)}" data-arch-field="customRetentionDays" type="number" min="1" max="36500" value="${row.customRetentionDays ?? 1}" class="h-9 w-24 rounded-md border border-input bg-background px-2 text-xs ${showCustom ? "" : "hidden"}" />
          <button type="button" data-arch-domain-save="${escapeAttr(domain)}" class="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent">${t("actions.save", "Guardar")}</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

function renderEncryptionRows() {
  const rows = (S.mailEncryptionSettings?.keys ?? []).filter((k) => k.status !== "legacy_invalid").map((k) => ({
    id: k.keyId,
    keyId: k.keyId,
    label: `${k.name} ${k.comment ? `(${k.comment})` : ""} <${k.email}>`,
    keySize: k.keySize,
    created: new Date(k.createdAt).toLocaleString(pageLocale()),
    expires: k.expiresAt ? new Date(k.expiresAt).toLocaleString(pageLocale()) : t("encryption.neverExpires", "Never"),
  }));
  publishMailTable("mail-encryption-public-table", rows);
  publishMailTable("mail-encryption-private-table", rows.filter((row) => S.mailEncryptionSettings?.keys.some((key) => key.keyId === row.keyId && key.privateKeyMasked === "Protegida")));
  const legacyCount = (S.mailEncryptionSettings?.keys ?? []).filter((key) => key.status === "legacy_invalid").length;
  const warning = document.getElementById("mail-encryption-warning");
  if (warning) { warning.textContent = legacyCount ? fmt(ui("legacyKeysWarning", "{count} claves antiguas no son OpenPGP válido y no se utilizarán. Genera o importa claves reales."), { count: legacyCount }) : ""; warning.classList.toggle("hidden", !legacyCount); }
}

function encryptionError(message: string | null) {
  const el = document.getElementById("mail-encryption-error");
  if (!el) return;
  el.textContent = message ?? "";
  el.classList.toggle("hidden", !message);
}

export async function loadEncryptionSettings() {
  const res = await api.get<EncryptionSettings>("/api/mail/encryption");
  if (!res.ok || !res.data) { encryptionError(res.error ?? ui("keysLoadError", "No se pudieron cargar las claves")); return; }
  encryptionError(null);
  S.mailEncryptionSettings = res.data;
  renderEncryptionRows();
}

async function loadArchiveSettings() {
  const res = await api.get<ArchiveSettings>("/api/mail/archive");
  if (!res.ok || !res.data) { showToast(res.error ?? ui("archiveLoadError", "No se pudo consultar el archivo de correo"), false); return; }
  S.mailArchiveSettings = res.data;
  const status = document.getElementById("mail-archive-status");
  if (status) {
    const data = res.data as ArchiveSettings & { active?: boolean; legacyConfigured?: boolean };
    status.textContent = data.legacyConfigured
      ? ui("legacyArchiveNotice", "La configuración anterior solo se guardó en el panel y está inactiva. Activa de nuevo las reglas que necesites.")
      : data.active ? ui("activeArchiveNotice", "Reglas aplicadas a Postfix. El archivo guarda copias nuevas; no recupera mensajes anteriores.")
        : data.integration?.available ? ui("inactiveArchiveNotice", "Archivo inactivo. Guarda una regla para aplicarla al servidor.") : data.integration?.reason ?? ui("archiveUnavailable", "Archivo no disponible.");
  }
  const d = res.data.defaults;
  const di = document.getElementById("mail-archive-default-incoming") as HTMLInputElement | null;
  const dol = document.getElementById("mail-archive-default-outgoing-list") as HTMLInputElement | null;
  const doo = document.getElementById("mail-archive-default-outgoing") as HTMLInputElement | null;
  if (di) di.checked = !!d.incoming;
  if (dol) dol.checked = !!d.outgoingMailingList;
  if (doo) doo.checked = !!d.outgoing;
  renderArchiveRows();
  const browser = document.getElementById("mail-archive-browse-domain") as HTMLSelectElement | null;
  if (browser) {
    const previous = browser.value;
    browser.innerHTML = S.domains.map((domain) => `<option value="${escapeAttr(domain)}">${escapeHtml(domain)}</option>`).join("");
    if (S.domains.includes(previous)) browser.value = previous;
  }
  void loadArchivedMessages();
}

type ArchivedMessage = { name: string; folder: "new" | "cur"; size: number; receivedAt: number; subject: string; sender: string; recipient: string };
async function loadArchivedMessages() {
  const domain = (document.getElementById("mail-archive-browse-domain") as HTMLSelectElement | null)?.value;
  const direction = (document.getElementById("mail-archive-browse-direction") as HTMLSelectElement | null)?.value ?? "incoming";
  const root = document.getElementById("mail-archive-message-rows");
  const error = document.getElementById("mail-archive-browse-error");
  if (!root || !domain) return;
  root.textContent = ui("loadingMessages", "Cargando mensajes…");
  const response = await api.get<ArchivedMessage[]>(`/api/mail/archive/${encodeURIComponent(domain)}/messages?direction=${direction}&limit=100`);
  if (!response.ok || !response.data) {
    root.textContent = "";
    if (error) { error.textContent = response.error ?? ui("archiveBrowseError", "No se pudo consultar el archivo"); error.classList.remove("hidden"); }
    return;
  }
  if (error) { error.textContent = ""; error.classList.add("hidden"); }
  const accounts = (await loadAccountCatalog()).filter((account) => account.address.toLowerCase().endsWith(`@${domain.toLowerCase()}`));
  root.innerHTML = response.data.length ? response.data.map((item) => {
    const key = `${encodeURIComponent(domain)}/messages/${direction}/${item.folder}/${encodeURIComponent(item.name)}`;
    return `<div class="rounded-md border border-border p-2 text-xs" data-archive-key="${escapeAttr(key)}">
      <div class="font-medium">${escapeHtml(item.subject || ui("noSubject", "(sin asunto)"))}</div>
      <div class="text-muted-foreground">${escapeHtml(item.sender)} → ${escapeHtml(item.recipient)}</div>
      <div class="text-muted-foreground">${new Date(item.receivedAt * 1000).toLocaleString(pageLocale())} · ${(item.size / 1024).toLocaleString(pageLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KiB</div>
      <div class="mt-2 flex flex-wrap gap-2"><button type="button" data-archive-download class="rounded border border-border px-2 py-1">${escapeHtml(ui("downloadEml", "Descargar .eml"))}</button>
      <select data-archive-account class="rounded border border-border bg-background px-1" aria-label="${escapeAttr(ui("restoreMailbox", "Buzón de restauración"))}">${accounts.map((account) => `<option value="${account.id}">${escapeHtml(account.address)}</option>`).join("")}</select>
      <button type="button" data-archive-restore class="rounded border border-border px-2 py-1" ${accounts.length ? "" : "disabled"}>${escapeHtml(ui("restore", "Restaurar"))}</button></div>
    </div>`;
  }).join("") : `<p class="text-xs text-muted-foreground">${escapeHtml(ui("noArchivedMessages", "No hay mensajes archivados en esta vista."))}</p>`;
}

function outboundMsg(text: string, error = false) {
  const el = document.getElementById("mail-outbound-msg");
  if (!el) return;
  el.textContent = text;
  el.className = `text-xs ${error ? "text-destructive" : "text-muted-foreground"}`;
}

function syncOutboundModeBoxes() {
  const mode = (document.getElementById("mail-outbound-mode") as HTMLSelectElement | null)?.value ?? "disabled";
  document.getElementById("mail-outbound-account-box")?.classList.toggle("hidden", mode !== "account");
  document.getElementById("mail-outbound-external-box")?.classList.toggle("hidden", mode !== "external");
}

let outboundGeneration = 0;
async function loadOutboundSettings() {
  const generation = ++outboundGeneration;
  const root = document.getElementById("mail-outbound-mode");
  const scope = resolveTargetScope();
  const isCurrent = () => generation === outboundGeneration && root === document.getElementById("mail-outbound-mode")
    && scope === resolveTargetScope();
  outboundMsg("");
  // Both reads are independent; fill connection fields before mailbox options
  // finish, without ever refilling fields the user has already edited.
  const accountsRequest = panelApi.get<any>("/api/accounts")
    .then((r) => (r.ok ? ((r.data as any[]) ?? []) : [])).catch(() => []);
  const res = await api.get<any>("/api/mail/outbound");
  if (!isCurrent()) return;
  if (!res.ok || !res.data) {
    outboundMsg(res.error ?? t("errors.saveFailed", "Error al guardar"), true);
    return;
  }
  const cfg = res.data;
  const modeSel = document.getElementById("mail-outbound-mode") as HTMLSelectElement | null;
  if (modeSel) modeSel.value = cfg.mode ?? "disabled";
  // Account options from the server's mailbox list.
  const accSel = document.getElementById("mail-outbound-account") as HTMLSelectElement | null;
  const set = (id: string, v: string) => { const el = document.getElementById(id) as HTMLInputElement | null; if (el) el.value = v; };
  set("mail-outbound-host", cfg.external?.host ?? "");
  set("mail-outbound-port", String(cfg.external?.port ?? 587));
  set("mail-outbound-user", cfg.external?.user ?? "");
  set("mail-outbound-pass", "");
  set("mail-outbound-from", cfg.external?.fromAddress ?? "");
  set("mail-outbound-fromname", cfg.external?.fromName ?? "");
  const sec = document.getElementById("mail-outbound-secure") as HTMLInputElement | null;
  if (sec) sec.checked = Boolean(cfg.external?.secure);
  const pass = document.getElementById("mail-outbound-pass") as HTMLInputElement | null;
  if (pass) pass.placeholder = cfg.external?.hasPassword ? t("placeholders.passwordNoChanges", "•••••••• (sin cambios)") : "";
  syncOutboundModeBoxes();
  if (accSel) {
    const accounts = await accountsRequest;
    if (!isCurrent() || accSel !== document.getElementById("mail-outbound-account")) return;
    const selection = accSel.value || cfg.accountAddress;
    accSel.innerHTML = accounts.map((a: any) => `<option value="${escapeAttr(a.address)}">${escapeHtml(a.address)}</option>`).join("");
    if (selection && !accounts.some((a: any) => a.address === selection)) {
      const o = document.createElement("option"); o.value = selection; o.textContent = selection; accSel.appendChild(o);
    }
    if (selection) accSel.value = selection;
  }
}

async function saveOutboundSettings() {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() ?? "";
  const mode = (document.getElementById("mail-outbound-mode") as HTMLSelectElement | null)?.value ?? "disabled";
  const body: Record<string, unknown> = { mode };
  if (mode === "account") body.accountAddress = (document.getElementById("mail-outbound-account") as HTMLSelectElement | null)?.value ?? "";
  if (mode === "external") {
    body.external = {
      host: val("mail-outbound-host"),
      port: Number(val("mail-outbound-port") || 587),
      secure: (document.getElementById("mail-outbound-secure") as HTMLInputElement | null)?.checked ?? false,
      user: val("mail-outbound-user"),
      password: (document.getElementById("mail-outbound-pass") as HTMLInputElement | null)?.value || undefined,
      fromAddress: val("mail-outbound-from"),
      fromName: val("mail-outbound-fromname") || undefined,
    };
  }
  const button = document.getElementById("mail-outbound-save") as HTMLButtonElement | null;
  if (button?.disabled) return;
  const scope = resolveTargetScope();
  if (button) button.disabled = true;
  let res;
  try { res = await api.put<any>("/api/mail/outbound", body); }
  finally { if (button) button.disabled = false; }
  if (scope !== resolveTargetScope() || button !== document.getElementById("mail-outbound-save")) return;
  if (res.ok) {
    const pass = document.getElementById("mail-outbound-pass") as HTMLInputElement | null;
    if (pass) {
      pass.value = "";
      pass.placeholder = res.data?.external?.hasPassword ? t("placeholders.passwordNoChanges", "•••••••• (sin cambios)") : "";
    }
    outboundMsg(t("toasts.settingsSaved", "Configuración guardada ✓"));
  }
  else outboundMsg(res.error ?? t("errors.saveFailed", "Error al guardar"), true);
}

async function testOutboundSettings() {
  const to = (document.getElementById("mail-outbound-test-to") as HTMLInputElement | null)?.value?.trim();
  if (!to) { outboundMsg(t("errors.indicateTestDestEmail", "Indica el email de destino de la prueba."), true); return; }
  outboundMsg(t("labels.sendingTest", "Enviando prueba…"));
  const res = await api.post<any>("/api/mail/outbound/test", { to });
  if (res.ok) outboundMsg(t("toasts.testEmailSent", "Correo de prueba enviado ✓"));
  else outboundMsg(res.error ?? t("errors.testEmailFailed", "Fallo el envío de prueba"), true);
}

function setMailSettingsView(view: MailSettingsView) {
  // Menú → vista: entra desde la derecha; volver al menú: desde la izquierda.
  const direction = view === "menu" ? "left" : "right";
  S.mailSettingsView = view;
  const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-mail-settings-view]"));
  switchView(panels, panels.find((panel) => panel.dataset.mailSettingsView === view), { direction });

  // Left-nav active state (drawer estilo Agentes IA).
  document.querySelectorAll<HTMLElement>("[data-mail-settings-nav]").forEach((btn) => {
    const active = btn.dataset.mailSettingsNav === view;
    btn.classList.toggle("bg-primary/10", active);
    btn.classList.toggle("text-primary", active);
    btn.classList.toggle("text-muted-foreground", !active);
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });

  if (view === "table") {
    reflectMailTableConfig();
    return;
  }

  if (view === "routing") {
    setMailRoutingError(null);
    refreshMailRoutingFormFromSelectedDomain();
    return;
  }
  if (view === "default-address") {
    setDefaultAddressError(null);
    refreshDefaultAddressFormFromSelectedDomain();
    return;
  }
  if (view === "encryption") {
    void loadEncryptionSettings();
  }

  if (view === "archive") {
    void loadArchiveSettings();
  }

  if (view === "outbound") {
    void loadOutboundSettings();
  }

  if (view === "domain-redirect") {
    setDomainRedirectError(null);
    resetDomainForwardForm((document.getElementById("mail-domain-redirect-domain") as HTMLSelectElement | null)?.value);
  }
}

// E-03: cuerpo compartido en /scripts/extracted/lib/tabs.js.
function setMailMainTabState(buttons: HTMLButtonElement[], activeButton: HTMLButtonElement) {
  buttons.forEach((btn) => setUnderlineTabState(btn, btn === activeButton));
}

export function updateMailTabCounts() {
  const emailsBadge = document.getElementById("tab-emails-count");
  const spamBadge = document.getElementById("tab-spam-filters-count");
  const trackBadge = document.getElementById("tab-track-delivery-count");
  const globalBadge = document.getElementById("tab-global-filters-count");
  if (emailsBadge) emailsBadge.textContent = String(S.accountsTotal || S.accounts.length);
  if (spamBadge) {
    const s = S.mailSpamSettings;
    const wbCount = (s?.whitelistFrom?.length ?? 0) + (s?.blacklistFrom?.length ?? 0);
    spamBadge.textContent = String(wbCount);
  }
  if (trackBadge) trackBadge.textContent = String(S.mailTrackDeliveryItems.length);
  if (globalBadge) globalBadge.textContent = String(S.loadedGlobalMailFilters.length);
}

export function setMailMainTab(tab: MailMainTab) {
  const prevTab = S.mailMainTab;
  S.mailMainTab = tab;
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-mail-main-tab]"));
  const direction = tabDirectionOf(buttons, (b) => b.dataset.mailMainTab === prevTab, (b) => b.dataset.mailMainTab === tab);
  const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-mail-main-panel]"));
  switchView(panels, panels.find((panel) => panel.dataset.mailMainPanel === tab), { direction });
  const activeButton = buttons.find((b) => b.dataset.mailMainTab === tab);
  if (activeButton) setMailMainTabState(buttons, activeButton);
}

export async function ensureMailMainTabLoaded(tab: MailMainTab) {
  if (tab === "spam-filters" && !S.mailSpamFiltersLoaded) {
    await loadSpamFilters();
    S.mailSpamFiltersLoaded = true;
    return;
  }
  if (tab === "track-delivery" && !S.mailTrackDeliveryLoaded) {
    await loadTrackDeliveryReport();
    S.mailTrackDeliveryLoaded = true;
    return;
  }
  if (tab === "global-filters" && !S.mailGlobalFiltersLoaded) {
    await loadGlobalFilters();
    S.mailGlobalFiltersLoaded = true;
  }
}


// ── Configuración de tabla (paginación + acciones a mostrar) ────────────────
const MAIL_TABLE_CFG_KEY = "lxp:mail:table-config:v1";
interface MailTableCfg { pageSize: number; hiddenActions: string[]; }
function readMailTableCfg(): MailTableCfg {
  try {
    const raw = localStorage.getItem(MAIL_TABLE_CFG_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      return { pageSize: Number(c.pageSize) || 25, hiddenActions: Array.isArray(c.hiddenActions) ? c.hiddenActions.map(String) : [] };
    }
  } catch { /* storage unavailable */ }
  return { pageSize: 25, hiddenActions: [] };
}
function writeMailTableCfg(cfg: MailTableCfg) {
  try { localStorage.setItem(MAIL_TABLE_CFG_KEY, JSON.stringify(cfg)); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent("lxp:mail:table-config", { detail: cfg }));
}
function reflectMailTableConfig() {
  const cfg = readMailTableCfg();
  document.querySelectorAll<HTMLButtonElement>("[data-mail-pagesize]").forEach((btn) => {
    const active = Number(btn.dataset.mailPagesize) === cfg.pageSize;
    btn.classList.toggle("bg-primary", active);
    btn.classList.toggle("text-primary-foreground", active);
    btn.classList.toggle("text-muted-foreground", !active);
  });
  document.querySelectorAll<HTMLInputElement>("[data-mail-action-toggle]").forEach((cb) => {
    cb.checked = !cfg.hiddenActions.includes(cb.dataset.mailActionToggle || "");
  });
}
let settingsBoundRoot: Element | null = null;
let settingsDocumentController: AbortController | null = null;
export function bindMailSettingsDomEvents(): void {
  const root = document.querySelector('[data-mail-main-panel="emails"]');
  if (!root || root === settingsBoundRoot) return;
  settingsBoundRoot = root;
  settingsDocumentController?.abort();
  settingsDocumentController = new AbortController();
  const signal = settingsDocumentController.signal;
document.querySelectorAll<HTMLButtonElement>("[data-mail-pagesize]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const cfg = readMailTableCfg();
    cfg.pageSize = Number(btn.dataset.mailPagesize) || 25;
    writeMailTableCfg(cfg);
    reflectMailTableConfig();
  });
});
document.querySelectorAll<HTMLInputElement>("[data-mail-action-toggle]").forEach((cb) => {
  cb.addEventListener("change", () => {
    const id = cb.dataset.mailActionToggle || "";
    const cfg = readMailTableCfg();
    const set = new Set(cfg.hiddenActions);
    if (cb.checked) set.delete(id); else set.add(id);
    cfg.hiddenActions = [...set];
    writeMailTableCfg(cfg);
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-mail-actions-all]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const showAll = btn.dataset.mailActionsAll === "show";
    const cfg = readMailTableCfg();
    if (showAll) cfg.hiddenActions = [];
    else cfg.hiddenActions = Array.from(document.querySelectorAll<HTMLInputElement>("[data-mail-action-toggle]")).map((c) => c.dataset.mailActionToggle || "").filter(Boolean);
    writeMailTableCfg(cfg);
    reflectMailTableConfig();
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-mail-settings-open]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.mailSettingsOpen as MailSettingsView | undefined;
    if (!target) return;
    setMailSettingsView(target);
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-mail-settings-back]").forEach((button) => {
  button.addEventListener("click", () => {
    setMailSettingsView("table");
  });
});

setMailSettingsView("table");

document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-mail-settings-view="outbound"] input, [data-mail-settings-view="outbound"] select').forEach((field) => {
  const invalidateLoad = () => { outboundGeneration++; };
  field.addEventListener("input", invalidateLoad);
  field.addEventListener("change", invalidateLoad);
});
document.getElementById("mail-outbound-mode")?.addEventListener("change", syncOutboundModeBoxes);

document.getElementById("mail-outbound-save")?.addEventListener("click", () => void saveOutboundSettings());

document.getElementById("mail-outbound-test")?.addEventListener("click", () => void testOutboundSettings());

setMailMainTab("emails");

document.getElementById("mail-settings-modal-trigger")?.addEventListener("click", async () => {
  setMailSettingsView("table");
  await loadDomains();
  await loadMailDomainRouting();
  await loadDefaultAddressRules();
  await loadDomainForwardRules();
  resetGlobalFilterForm();
  refreshMailRoutingFormFromSelectedDomain();
  refreshDefaultAddressFormFromSelectedDomain();
  resetDomainForwardForm((document.getElementById("mail-domain-redirect-domain") as HTMLSelectElement | null)?.value);
});

document.getElementById("mail-archive-default-save")?.addEventListener("click", async () => {
  const incoming = !!(document.getElementById("mail-archive-default-incoming") as HTMLInputElement | null)?.checked;
  const outgoingMailingList = !!(document.getElementById("mail-archive-default-outgoing-list") as HTMLInputElement | null)?.checked;
  const outgoing = !!(document.getElementById("mail-archive-default-outgoing") as HTMLInputElement | null)?.checked;
  const res = await api.put("/api/mail/archive/defaults", { incoming, outgoingMailingList, outgoing });
  if (!res.ok) { showToast(res.error ?? ui("archiveApplyError", "No se pudo aplicar el archivo en Postfix"), false); return; }
  showToast(t("toasts.archiveDefaultUpdated", "Configuración default de archivo actualizada."));
  await loadArchiveSettings();
});

document.getElementById("mail-archive-browse-refresh")?.addEventListener("click", () => { void loadArchivedMessages(); });
document.getElementById("mail-archive-browse-domain")?.addEventListener("change", () => { void loadArchivedMessages(); });
document.getElementById("mail-archive-browse-direction")?.addEventListener("change", () => { void loadArchivedMessages(); });
document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement | null;
  const action = target?.closest("[data-archive-download], [data-archive-restore]") as HTMLButtonElement | null;
  const row = action?.closest<HTMLElement>("[data-archive-key]");
  if (!action || !row) return;
  const path = `/api/mail/archive/${row.dataset.archiveKey ?? ""}`;
  action.disabled = true;
  try {
    if (action.hasAttribute("data-archive-download")) {
      const response = await fetch(resolvePanelApiPath(`${path}/raw`), { credentials: "include", headers: scopeHeaders() });
      if (!response.ok) throw new Error(ui("downloadMessageError", "No se pudo descargar el mensaje"));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "archived-message.eml";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      const accountId = Number(row.querySelector<HTMLSelectElement>("[data-archive-account]")?.value);
      if (!Number.isSafeInteger(accountId) || accountId <= 0) throw new Error(ui("selectMailbox", "Selecciona un buzón del dominio"));
      const response = await api.post(`${path}/restore`, { accountId });
      if (!response.ok) throw new Error(response.error ?? ui("restoreMessageError", "No se pudo restaurar el mensaje"));
      showToast(ui("messageRestored", "Mensaje restaurado en la carpeta Archive Restored"));
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : ui("archiveBrowseError", "No se pudo consultar el archivo"), false);
  } finally { action.disabled = false; }
}, { signal });

document.addEventListener("change", (event) => {
  const target = event.target as HTMLElement | null;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.dataset.archField !== "retentionDays") return;
  const domain = target.dataset.archDomain ?? "";
  const customInput = document.querySelector<HTMLInputElement>(`input[data-arch-domain="${domain}"][data-arch-field="customRetentionDays"]`);
  if (customInput) customInput.classList.toggle("hidden", target.value !== "custom");
}, { signal });

document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement | null;
  const btn = target?.closest("[data-arch-domain-save]") as HTMLElement | null;
  if (!btn) return;
  const domain = btn.getAttribute("data-arch-domain-save") ?? "";
  if (!domain) return;
  const getCheckbox = (field: string) => !!document.querySelector<HTMLInputElement>(`input[data-arch-domain="${domain}"][data-arch-field="${field}"]`)?.checked;
  const retentionSelect = document.querySelector<HTMLSelectElement>(`select[data-arch-domain="${domain}"][data-arch-field="retentionDays"]`);
  const customInput = document.querySelector<HTMLInputElement>(`input[data-arch-domain="${domain}"][data-arch-field="customRetentionDays"]`);
  const retentionDays = retentionSelect?.value === "custom" ? "custom" : Number(retentionSelect?.value ?? 0);
  const customRetentionDays = retentionDays === "custom" ? Number(customInput?.value ?? 1) : null;
  const res = await api.put("/api/mail/archive/domain", {
    domain,
    incoming: getCheckbox("incoming"),
    outgoingMailingList: getCheckbox("outgoingMailingList"),
    outgoing: getCheckbox("outgoing"),
    retentionDays,
    customRetentionDays,
  });
  if (!res.ok) { showToast(res.error ?? ui("archiveApplyError", "No se pudo aplicar el archivo en Postfix"), false); return; }
  showToast(fmt(t("toasts.archiveDomainUpdated", "Archivo actualizado para {domain}."), { domain }));
  await loadArchiveSettings();
}, { signal });

document.getElementById("mail-encryption-import-open")?.addEventListener("click", () => {
  setCollapsed(document.getElementById("mail-encryption-import-wrap"));
});

document.getElementById("mail-encryption-generate")?.addEventListener("click", async () => {
  const name = ((document.getElementById("mail-encryption-name") as HTMLInputElement | null)?.value ?? "").trim();
  const email = ((document.getElementById("mail-encryption-email") as HTMLInputElement | null)?.value ?? "").trim();
  const comment = ((document.getElementById("mail-encryption-comment") as HTMLInputElement | null)?.value ?? "").trim();
  const passphrase = ((document.getElementById("mail-encryption-pass") as HTMLInputElement | null)?.value ?? "");
  const confirmPassphrase = ((document.getElementById("mail-encryption-pass-confirm") as HTMLInputElement | null)?.value ?? "");
  const expirationValue = Number((document.getElementById("mail-encryption-expire-value") as HTMLInputElement | null)?.value ?? 1);
  const expirationUnit = (((document.getElementById("mail-encryption-expire-unit") as HTMLSelectElement | null)?.value ?? "y") as "d" | "w" | "m" | "y");
  const noExpire = !!(document.getElementById("mail-encryption-no-expire") as HTMLInputElement | null)?.checked;
  const keySize = Number((document.getElementById("mail-encryption-keysize") as HTMLSelectElement | null)?.value ?? 3072) as 3072 | 4096;
  const button = document.getElementById("mail-encryption-generate") as HTMLButtonElement;
  button.disabled = true;
  encryptionError(null);
  const res = await api.post<EncryptionSettings & { backup?: { privateKey: string; revocationCertificate: string } }>("/api/mail/encryption/keys", { name, email, comment, passphrase, confirmPassphrase, expirationValue, expirationUnit, noExpire, keySize });
  button.disabled = false;
  if (!res.ok || !res.data) { encryptionError(res.error ?? ui("generateKeyError", "No se pudo generar la clave")); return; }
  if (res.data.backup) {
    const blob = new Blob([res.data.backup.privateKey, "\n", res.data.backup.revocationCertificate], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `${email.replace(/[^a-z0-9@._-]/gi, "_")}-pgp-backup.asc`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  (document.getElementById("mail-encryption-pass") as HTMLInputElement).value = "";
  (document.getElementById("mail-encryption-pass-confirm") as HTMLInputElement).value = "";
  showToast(t("toasts.keyGenerated", "Llave generada."));
  await loadEncryptionSettings();
});

document.getElementById("mail-encryption-import-save")?.addEventListener("click", async () => {
  const armoredPublicKey = ((document.getElementById("mail-encryption-import-text") as HTMLTextAreaElement | null)?.value ?? "").trim();
  const res = await api.post("/api/mail/encryption/import", { armoredPublicKey });
  if (!res.ok) { encryptionError(res.error ?? ui("importPublicKeyError", "No se pudo importar la clave pública")); return; }
  showToast(t("toasts.publicKeyImported", "Llave pública importada."));
  await loadEncryptionSettings();
});

document.getElementById("mail-encryption-private-import-save")?.addEventListener("click", async () => {
  const armoredPrivateKey = (document.getElementById("mail-encryption-private-import-text") as HTMLTextAreaElement).value.trim();
  const passphraseInput = document.getElementById("mail-encryption-private-import-pass") as HTMLInputElement;
  const res = await api.post("/api/mail/encryption/import-private", { armoredPrivateKey, passphrase: passphraseInput.value });
  passphraseInput.value = "";
  if (!res.ok) { encryptionError(res.error ?? ui("importPrivateKeyError", "No se pudo importar la clave privada")); return; }
  (document.getElementById("mail-encryption-private-import-text") as HTMLTextAreaElement).value = "";
  encryptionError(null);
  showToast(ui("privateKeyImported", "Clave privada importada"));
  await loadEncryptionSettings();
});

document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement | null;
  const del = target?.closest("[data-encryption-delete]") as HTMLElement | null;
  const view = target?.closest("[data-encryption-view]") as HTMLElement | null;
  if (del) {
    const keyId = del.getAttribute("data-encryption-delete") ?? "";
    if (!keyId) return;
    const key = (S.mailEncryptionSettings?.keys ?? []).find((item) => item.keyId === keyId);
    if (!await openConfirm(key?.privateKeyMasked === "Protegida" ? ui("deleteProtectedKeyConfirm", "Eliminar esta clave impedirá abrir correos antiguos. Guarda antes su respaldo. ¿Eliminar?") : ui("deleteKeyConfirm", "¿Eliminar esta clave?"), { title: ui("deleteKeyTitle", "Eliminar clave"), variant: "danger" })) return;
    const res = await api.delete(`/api/mail/encryption/keys/${encodeURIComponent(keyId)}`, { params: key?.privateKeyMasked === "Protegida" ? { confirm: "true" } : undefined });
    if (!res.ok) { encryptionError(res.error ?? ui("deleteKeyError", "No se pudo eliminar la clave")); return; }
    showToast(t("toasts.keyDeleted", "Llave eliminada."));
    await loadEncryptionSettings();
    return;
  }
  if (view) {
    const keyId = view.getAttribute("data-encryption-view") ?? "";
    const key = (S.mailEncryptionSettings?.keys ?? []).find((k) => k.keyId === keyId);
    const wrap = document.getElementById("mail-encryption-view-wrap");
    const text = document.getElementById("mail-encryption-view-text") as HTMLTextAreaElement | null;
    if (!wrap || !text || !key) return;
    text.value = key.publicKey;
    wrap.classList.remove("hidden");
  }
}, { signal });
}
