import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Mail page — domain-level settings: email routing, default address, global
// domain redirects (+ their loaders/forms). Registers the domain-forward globals.
import { api, resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import type { DefaultAddressMode, DefaultAddressRule, DomainForwardRule, MailRoutingMode } from "./state";
import { DOMAIN_RE, S, SIMPLE_EMAIL_RE } from "./state";
import { escapeAttr, fmt, showToast, t } from "./dom";
import { publishMailTable } from "./table-bridge";
const redirectPages = createTablePages({ tableId: "mail-redirect-table", events: window, scope: resolveTargetScope, reload: () => loadDomainForwardRules(), field: "auto", rowKey: row => row.domain, aliases: {domain:"at:domain",destinos:"destinations"} });

const ROUTING_MODE_LABEL: Record<MailRoutingMode, () => string> = {
  auto_remote: () => t("routing.labels.autoRemote", "Automatically Detect Configuration: Remote"),
  local: () => t("routing.labels.local", "Local Mail Exchanger"),
  backup: () => t("routing.labels.backup", "Backup Mail Exchanger"),
  remote: () => t("routing.labels.remote", "Remote Mail Exchanger"),
};

export function setDomainRedirectError(message: string | null) {
  const el = document.getElementById("mail-domain-redirect-error");
  if (!el) return;
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

export function setMailRoutingError(message: string | null) {
  const el = document.getElementById("mail-routing-error");
  if (!el) return;
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

export function setDefaultAddressError(message: string | null) {
  const el = document.getElementById("mail-default-address-error");
  if (!el) return;
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

function getDefaultAddressModeFromInputs(): DefaultAddressMode {
  const checked = document.querySelector<HTMLInputElement>('input[name="mail-default-address-mode"]:checked');
  return checked?.value === "forward" ? "forward" : "fail";
}

function setDefaultAddressModeInputs(mode: DefaultAddressMode) {
  const input = document.querySelector<HTMLInputElement>(`input[name="mail-default-address-mode"][value="${mode}"]`);
  if (input) input.checked = true;
}

function refreshDefaultAddressCurrentLabel(domainRaw?: string) {
  const label = document.getElementById("mail-default-address-current");
  if (!label) return;
  const domain = (domainRaw ?? (document.getElementById("mail-default-address-domain") as HTMLSelectElement | null)?.value ?? "")
    .trim()
    .toLowerCase();
  if (!domain) {
    label.textContent = "";
    return;
  }
  const rule = S.mailDefaultAddressByDomain[domain];
  if (!rule) {
    label.textContent = t("defaultAddress.currentSetting.none", "Current Setting: (none)");
    return;
  }
  if (rule.mode === "forward") {
    label.textContent = fmt(t("defaultAddress.currentSetting.forward", "Current Setting: {destination}"), { destination: rule.forwardTo ?? t("defaultAddress.currentSetting.forwardDefault", "(forward)") });
    return;
  }
  label.textContent = fmt(t("defaultAddress.currentSetting.fail", "Current Setting: :fail: {message}"), { message: rule.failureMessage || t("defaultAddress.defaultFailMessage", "No Such User Here") });
}

export function refreshDefaultAddressFormFromSelectedDomain() {
  const select = document.getElementById("mail-default-address-domain") as HTMLSelectElement | null;
  const domain = (select?.value ?? "").trim().toLowerCase();
  const rule = domain ? S.mailDefaultAddressByDomain[domain] : undefined;
  const mode: DefaultAddressMode = rule?.mode === "forward" ? "forward" : "fail";
  setDefaultAddressModeInputs(mode);
  const failInput = document.getElementById("mail-default-address-failure-message") as HTMLInputElement | null;
  const forwardInput = document.getElementById("mail-default-address-forward-to") as HTMLInputElement | null;
  if (failInput) failInput.value = rule?.failureMessage || t("defaultAddress.defaultFailMessage", "No Such User Here");
  if (forwardInput) forwardInput.value = rule?.forwardTo || "";
  refreshDefaultAddressCurrentLabel(domain);
}

export async function loadDefaultAddressRules() {
  const res = await api.get<Record<string, DefaultAddressRule>>("/api/mail/default-address");
  if (!res.ok) {
    setDefaultAddressError(res.error ?? t("errors.defaultAddressLoadFailed", "No se pudo cargar Default Address."));
    return;
  }
  setDefaultAddressError(null);
  const raw = res.data && typeof res.data === "object" ? res.data : {};
  const out: Record<string, DefaultAddressRule> = {};
  for (const [domainRaw, ruleRaw] of Object.entries(raw)) {
    const domain = domainRaw.trim().toLowerCase();
    if (!domain || !ruleRaw || typeof ruleRaw !== "object") continue;
    const mode = (ruleRaw as any).mode === "forward" ? "forward" : "fail";
    const failureMessage = typeof (ruleRaw as any).failureMessage === "string" ? (ruleRaw as any).failureMessage : undefined;
    const forwardTo = typeof (ruleRaw as any).forwardTo === "string" ? (ruleRaw as any).forwardTo : undefined;
    out[domain] = { mode, failureMessage, forwardTo };
  }
  S.mailDefaultAddressByDomain = out;
  refreshDefaultAddressFormFromSelectedDomain();
}

function setRoutingModeInputs(mode: MailRoutingMode) {
  const radio = document.querySelector<HTMLInputElement>(`input[name="mail-routing-mode"][value="${mode}"]`);
  if (radio) radio.checked = true;
}

function getRoutingModeFromInputs(): MailRoutingMode {
  const checked = document.querySelector<HTMLInputElement>('input[name="mail-routing-mode"]:checked');
  const value = checked?.value ?? "auto_remote";
  if (value === "local" || value === "backup" || value === "remote") return value;
  return "auto_remote";
}

function refreshMailRoutingCurrentLabel(domainRaw?: string) {
  const current = document.getElementById("mail-routing-current");
  if (!current) return;
  const domain = (domainRaw ?? (document.getElementById("mail-routing-domain") as HTMLSelectElement | null)?.value ?? "")
    .trim()
    .toLowerCase();
  if (!domain) {
    current.textContent = "";
    return;
  }
  const mode = S.mailDomainRoutingByDomain[domain] ?? "auto_remote";
  current.textContent = fmt(t("routing.currentMode", "Actual: {mode}"), { mode: ROUTING_MODE_LABEL[mode]() });
}

export function refreshMailRoutingFormFromSelectedDomain() {
  const select = document.getElementById("mail-routing-domain") as HTMLSelectElement | null;
  const domain = (select?.value ?? "").trim().toLowerCase();
  const mode = domain ? (S.mailDomainRoutingByDomain[domain] ?? "auto_remote") : "auto_remote";
  setRoutingModeInputs(mode);
  refreshMailRoutingCurrentLabel(domain);
}

export async function loadMailDomainRouting() {
  const res = await api.get<Record<string, MailRoutingMode>>("/api/mail/domain-routing");
  if (!res.ok) {
    setMailRoutingError(res.error ?? t("errors.routingLoadFailed", "No se pudo cargar la configuración de Email Routing."));
    return;
  }
  setMailRoutingError(null);
  const raw = res.data && typeof res.data === "object" ? res.data : {};
  const next: Record<string, MailRoutingMode> = {};
  for (const [domainRaw, modeRaw] of Object.entries(raw)) {
    const domain = domainRaw.trim().toLowerCase();
    if (!domain) continue;
    if (modeRaw === "local" || modeRaw === "backup" || modeRaw === "remote" || modeRaw === "auto_remote") {
      next[domain] = modeRaw;
    }
  }
  S.mailDomainRoutingByDomain = next;
  refreshMailRoutingFormFromSelectedDomain();
}

function createDomainDestinationRow(value = ""): string {
  return `
    <div class="mail-domain-destination-row grid grid-cols-1 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <input
        type="email"
        class="mail-domain-destination h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        placeholder="destino@dominio.com"
        value="${escapeAttr(value)}"
      />
      <button type="button" class="mail-domain-destination-remove rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
        ${t("actions.remove", "Quitar")}
      </button>
    </div>
  `;
}

function addDomainDestinationRow(value = "") {
  const list = document.getElementById("mail-domain-redirect-destinations");
  if (!list) return;
  list.insertAdjacentHTML("beforeend", createDomainDestinationRow(value));
}

document.addEventListener("click", (event) => {
  (event.target as Element | null)?.closest(".mail-domain-destination-remove")?.closest(".mail-domain-destination-row")?.remove();
});

function collectDomainDestinations(): string[] {
  const out = new Set<string>();
  const inputs = document.querySelectorAll<HTMLInputElement>("#mail-domain-redirect-destinations .mail-domain-destination");
  for (const input of inputs) {
    const value = input.value.trim().toLowerCase();
    if (!value) continue;
    out.add(value);
  }
  return Array.from(out);
}

function renderDomainForwardRules() {
  publishMailTable("mail-redirect-table", S.mailDomainForwardRules.map((rule) => ({
    id: rule.domain,
    domain: `@${rule.domain}`,
    destinos: Array.isArray(rule.destinations) ? rule.destinations : [],
    _domain: rule.domain,
  })));
}

export function resetDomainForwardForm(defaultDomain?: string) {
  setDomainRedirectError(null);
  const domainSelect = document.getElementById("mail-domain-redirect-domain") as HTMLSelectElement | null;
  if (domainSelect) {
    if (defaultDomain) {
      domainSelect.value = defaultDomain;
    } else if (domainSelect.options.length > 0) {
      domainSelect.selectedIndex = 0;
    }
  }
  const list = document.getElementById("mail-domain-redirect-destinations");
  if (list) list.innerHTML = "";
  addDomainDestinationRow("");
}

function fillDomainForwardForm(rule: DomainForwardRule) {
  setDomainRedirectError(null);
  const domainSelect = document.getElementById("mail-domain-redirect-domain") as HTMLSelectElement | null;
  if (domainSelect) domainSelect.value = rule.domain;
  const list = document.getElementById("mail-domain-redirect-destinations");
  if (list) {
    list.innerHTML = "";
    for (const destination of rule.destinations) {
      addDomainDestinationRow(destination);
    }
  }
}

export async function loadDomainForwardRules() {
  const res = await redirectPages.read<DomainForwardRule[]>(params => api.get<DomainForwardRule[]>("/api/mail/domain-forwards", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!res.ok) {
    setDomainRedirectError(res.error ?? t("errors.domainForwardsLoadFailed", "No se pudieron cargar las redirecciones globales."));
    return;
  }
  const payload = Array.isArray(res.data) ? res.data : [];
  S.mailDomainForwardRules = payload
    .map((entry) => ({
      domain: (entry.domain ?? "").trim().toLowerCase(),
      destinations: Array.isArray(entry.destinations)
        ? entry.destinations.map((value) => value.trim().toLowerCase()).filter(Boolean)
        : [],
    }))
    .filter((entry) => entry.domain && entry.destinations.length > 0);
  renderDomainForwardRules();
}

(window as any).editMailDomainForward = (domain: string) => {
  const normalizedDomain = domain.trim().toLowerCase();
  const rule = S.mailDomainForwardRules.find((item) => item.domain === normalizedDomain);
  if (!rule) return;
  fillDomainForwardForm(rule);
};

(window as any).deleteMailDomainForward = async (domain: string) => {
  const normalizedDomain = domain.trim().toLowerCase();
  const confirmed = await openConfirm(fmt(t("confirm.deleteDomainForward", "¿Eliminar la redirección global de @{domain}?"), { domain: normalizedDomain }), {
    title: t("confirm.deleteDomainForwardTitle", "Eliminar redirección global"),
    variant: "danger",
  });
  if (!confirmed) return;

  const nextRules = S.mailDomainForwardRules.filter((item) => item.domain !== normalizedDomain);
  const res = await api.delete<DomainForwardRule[]>(`/api/mail/domain-forwards/${encodeURIComponent(normalizedDomain)}`);
  if (!res.ok) {
    setDomainRedirectError(res.error ?? t("errors.domainForwardDeleteFailed", "No se pudo eliminar la redirección global."));
    return;
  }
  S.mailDomainForwardRules = Array.isArray(res.data) ? res.data : nextRules;
  renderDomainForwardRules();
  resetDomainForwardForm();
  showToast(fmt(t("toasts.domainForwardDeleted", "Redirección global de @{domain} eliminada"), { domain: normalizedDomain }));
};

export async function loadDomains() {
  const res = await api.get<string[]>("/api/accounts/domains");
  if (!res.ok) {
    showToast(t("errors.domainsLoadFailed", "No se pudieron cargar dominios DNS"), false);
    return;
  }

  const payload = res.data;
  const list = Array.isArray(payload) ? payload : [];
  S.domains = list;

  const domainSelect = document.getElementById("new-domain") as HTMLSelectElement;
  domainSelect.innerHTML = `<option value=''>${t("placeholders.selectDomain", "Selecciona dominio...")}</option>`;
  const settingsDomainSelect = document.getElementById("mail-domain-redirect-domain") as HTMLSelectElement | null;
  const currentSettingsDomain = settingsDomainSelect?.value ?? "";
  const routingDomainSelect = document.getElementById("mail-routing-domain") as HTMLSelectElement | null;
  const currentRoutingDomain = routingDomainSelect?.value ?? "";
  const defaultAddressDomainSelect = document.getElementById("mail-default-address-domain") as HTMLSelectElement | null;
  const currentDefaultAddressDomain = defaultAddressDomainSelect?.value ?? "";
  if (settingsDomainSelect) {
    settingsDomainSelect.innerHTML = `<option value=''>${t("placeholders.selectDomain", "Selecciona dominio...")}</option>`;
  }
  if (routingDomainSelect) {
    routingDomainSelect.innerHTML = `<option value=''>${t("placeholders.selectDomain", "Selecciona dominio...")}</option>`;
  }
  if (defaultAddressDomainSelect) {
    defaultAddressDomainSelect.innerHTML = `<option value=''>${t("placeholders.selectDomain", "Selecciona dominio...")}</option>`;
  }
  for (const domain of S.domains) {
    const option = document.createElement("option");
    option.value = domain;
    option.textContent = domain;
    domainSelect.append(option);
    if (settingsDomainSelect) {
      const settingsOption = document.createElement("option");
      settingsOption.value = domain;
      settingsOption.textContent = domain;
      settingsDomainSelect.append(settingsOption);
    }
    if (routingDomainSelect) {
      const routingOption = document.createElement("option");
      routingOption.value = domain;
      routingOption.textContent = domain;
      routingDomainSelect.append(routingOption);
    }
    if (defaultAddressDomainSelect) {
      const defaultAddressOption = document.createElement("option");
      defaultAddressOption.value = domain;
      defaultAddressOption.textContent = domain;
      defaultAddressDomainSelect.append(defaultAddressOption);
    }
  }
  if (settingsDomainSelect && currentSettingsDomain && S.domains.includes(currentSettingsDomain)) {
    settingsDomainSelect.value = currentSettingsDomain;
  }
  if (routingDomainSelect && currentRoutingDomain && S.domains.includes(currentRoutingDomain)) {
    routingDomainSelect.value = currentRoutingDomain;
  }
  if (defaultAddressDomainSelect && currentDefaultAddressDomain && S.domains.includes(currentDefaultAddressDomain)) {
    defaultAddressDomainSelect.value = currentDefaultAddressDomain;
  }
  refreshMailRoutingFormFromSelectedDomain();
  refreshDefaultAddressFormFromSelectedDomain();
}

document.getElementById("mail-domain-redirect-add-destination")?.addEventListener("click", () => {
  addDomainDestinationRow("");
});

document.getElementById("mail-domain-redirect-reset")?.addEventListener("click", () => {
  resetDomainForwardForm();
});

document.getElementById("mail-routing-domain")?.addEventListener("change", () => {
  setMailRoutingError(null);
  refreshMailRoutingFormFromSelectedDomain();
});

document.getElementById("mail-default-address-domain")?.addEventListener("change", () => {
  setDefaultAddressError(null);
  refreshDefaultAddressFormFromSelectedDomain();
});

document.getElementById("mail-routing-save")?.addEventListener("click", async () => {
  setMailRoutingError(null);
  const domainSelect = document.getElementById("mail-routing-domain") as HTMLSelectElement | null;
  const domain = (domainSelect?.value ?? "").trim().toLowerCase();
  if (!domain || !DOMAIN_RE.test(domain)) {
    setMailRoutingError(t("errors.selectValidDomain", "Selecciona un dominio válido."));
    return;
  }

  const mode = getRoutingModeFromInputs();
  const saveButton = document.getElementById("mail-routing-save") as HTMLButtonElement | null;
  if (saveButton) saveButton.disabled = true;

  try {
    const res = await api.put<Record<string, MailRoutingMode>>("/api/mail/domain-routing", { domain, mode });
    if (!res.ok) {
      setMailRoutingError(res.error ?? t("errors.routingSaveFailed", "No se pudo guardar la configuración de Email Routing."));
      return;
    }
    const raw = res.data && typeof res.data === "object" ? res.data : {};
    S.mailDomainRoutingByDomain = raw as Record<string, MailRoutingMode>;
    refreshMailRoutingCurrentLabel(domain);
    showToast(fmt(t("toasts.emailRoutingUpdated", "Email Routing actualizado para @{domain}"), { domain }));
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
});

document.getElementById("mail-default-address-save")?.addEventListener("click", async () => {
  setDefaultAddressError(null);
  const domainSelect = document.getElementById("mail-default-address-domain") as HTMLSelectElement | null;
  const domain = (domainSelect?.value ?? "").trim().toLowerCase();
  if (!domain || !DOMAIN_RE.test(domain)) {
    setDefaultAddressError(t("errors.selectValidDomain", "Selecciona un dominio válido."));
    return;
  }

  const mode = getDefaultAddressModeFromInputs();
  const failureMessage = ((document.getElementById("mail-default-address-failure-message") as HTMLInputElement | null)?.value ?? "").trim();
  const forwardTo = ((document.getElementById("mail-default-address-forward-to") as HTMLInputElement | null)?.value ?? "").trim().toLowerCase();

  if (mode === "forward" && !SIMPLE_EMAIL_RE.test(forwardTo)) {
    setDefaultAddressError(t("errors.mustEnterValidDestEmail", "Debes ingresar un correo destino válido."));
    return;
  }

  const saveButton = document.getElementById("mail-default-address-save") as HTMLButtonElement | null;
  if (saveButton) saveButton.disabled = true;

  try {
    const payload = mode === "forward"
      ? { domain, mode, forwardTo }
      : { domain, mode, failureMessage: failureMessage || "No Such User Here" };
    const res = await api.put<Record<string, DefaultAddressRule>>("/api/mail/default-address", payload);
    if (!res.ok) {
      setDefaultAddressError(res.error ?? t("errors.defaultAddressSaveFailed", "No se pudo guardar Default Address."));
      return;
    }
    const raw = res.data && typeof res.data === "object" ? res.data : {};
    S.mailDefaultAddressByDomain = raw as Record<string, DefaultAddressRule>;
    refreshDefaultAddressFormFromSelectedDomain();
    showToast(fmt(t("toasts.defaultAddressUpdated", "Default Address actualizado para @{domain}"), { domain }));
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
});

document.getElementById("mail-domain-redirect-save")?.addEventListener("click", async () => {
  setDomainRedirectError(null);
  const domainSelect = document.getElementById("mail-domain-redirect-domain") as HTMLSelectElement | null;
  const selectedDomain = (domainSelect?.value ?? "").trim().toLowerCase();
  if (!selectedDomain || !DOMAIN_RE.test(selectedDomain)) {
    setDomainRedirectError(t("errors.selectValidDomain", "Selecciona un dominio válido."));
    return;
  }

  const destinations = collectDomainDestinations();
  if (!destinations.length) {
    setDomainRedirectError(t("errors.mustAddAtLeastOneDestEmail", "Debes agregar al menos un correo destino."));
    return;
  }
  if (destinations.some((destination) => !SIMPLE_EMAIL_RE.test(destination))) {
    setDomainRedirectError(t("errors.destinationsInvalidFormat", "Uno o más destinos tienen formato inválido."));
    return;
  }

  const merged = S.mailDomainForwardRules.filter((rule) => rule.domain !== selectedDomain);
  merged.push({ domain: selectedDomain, destinations });
  merged.sort((a, b) => a.domain.localeCompare(b.domain));

  const saveButton = document.getElementById("mail-domain-redirect-save") as HTMLButtonElement | null;
  if (saveButton) saveButton.disabled = true;

  try {
    const res = await api.put<DomainForwardRule[]>(`/api/mail/domain-forwards/${encodeURIComponent(selectedDomain)}`, { destinations });
    if (!res.ok) {
      setDomainRedirectError(res.error ?? t("errors.domainRedirectSaveFailed", "No se pudo guardar la redirección global."));
      return;
    }
    S.mailDomainForwardRules = Array.isArray(res.data) ? res.data : merged;
    renderDomainForwardRules();
    showToast(fmt(t("toasts.globalRedirectSaved", "Redirección global guardada para @{domain}"), { domain: selectedDomain }));
    resetDomainForwardForm(selectedDomain);
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
});
