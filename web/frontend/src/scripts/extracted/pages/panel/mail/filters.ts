import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Mail page — per-account Sieve filters + global mail filters (rules/actions
// builders, dialogs, loaders). Registers the filter window.* globals on import.
import { api, resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import type { GlobalMailFilter, MailFilter, MailFilterAction, MailFilterActionType, MailFilterRule, MailFilterRuleMatch, MailFilterRulePart } from "./state";
import { S } from "./state";
import { escapeAttr, fmt, showToast, t } from "./dom";
import { publishMailTable } from "./table-bridge";
import { updateMailTabCounts } from "./settings";
import { openDialog } from "/scripts/extracted/lib/dom.js";
const globalFilterPages = createTablePages({ tableId: "mail-global-filters-table", events: window, scope: resolveTargetScope, reload: () => loadGlobalFilters(), field: "auto", aliases: {estado:"enabled",rules:"length:rules",actionsCount:"length:actions"}, values: () => ({estado:{[t("status.active","Activo")]:"true",[t("status.inactive","Inactivo")]:"false"}}) });
const filterPages = createTablePages({ tableId: "mail-filters-table", events: window, scope: resolveTargetScope, reload: () => loadFilters(S.filtersAccountId!), field: "auto", aliases: {estado:"enabled",rules:"length:rules",actionsCount:"length:actions"}, values: () => ({estado:{[t("status.active","Activo")]:"true",[t("status.inactive","Inactivo")]:"false"}}) });

const FILTER_RULE_PART_OPTIONS: Array<{ value: MailFilterRulePart; label: string }> = [
  { value: "from", label: t("filters.ruleParts.from", "From") },
  { value: "subject", label: t("filters.ruleParts.subject", "Subject") },
  { value: "to", label: t("filters.ruleParts.to", "To") },
  { value: "any_recipient", label: t("filters.ruleParts.anyRecipient", "Any Recipient") },
  { value: "reply", label: t("filters.ruleParts.reply", "Reply") },
  { value: "body", label: t("filters.ruleParts.body", "Body") },
  { value: "any_header", label: t("filters.ruleParts.anyHeader", "Any Header") },
  { value: "not_delivered", label: t("filters.ruleParts.notDelivered", "Has Not Been Previously Delivered") },
  { value: "error_message", label: t("filters.ruleParts.errorMessage", "Is an Error Message") },
  { value: "list_id", label: t("filters.ruleParts.listId", "List ID") },
  { value: "spam_status", label: t("filters.ruleParts.spamStatus", "Spam Status") },
  { value: "spam_bar", label: t("filters.ruleParts.spamBar", "Spam Bar") },
  { value: "spam_score", label: t("filters.ruleParts.spamScore", "Spam Score") },
];

const FILTER_MATCH_OPTIONS: Array<{ value: MailFilterRuleMatch; label: string; disabled?: boolean }> = [
  { value: "contains", label: t("filters.matches.contains", "contains") },
  { value: "matches", label: t("filters.matches.matchesRegex", "matches regex") },
  { value: "does_not_contain", label: t("filters.matches.doesNotContain", "does not contain") },
  { value: "is", label: t("filters.matches.equals", "equals") },
  { value: "begins", label: t("filters.matches.beginsWith", "begins with") },
  { value: "ends", label: t("filters.matches.endsWith", "ends with") },
  { value: "does_not_begin", label: t("filters.matches.doesNotBegin", "does not begin") },
  { value: "does_not_end", label: t("filters.matches.doesNotEnd", "does not end with") },
  { value: "does_not_match", label: t("filters.matches.doesNotMatch", "does not match") },
  { value: "is_above", label: t("filters.matches.isAbove", "is above (numbers only)"), disabled: true },
  { value: "is_not_above", label: t("filters.matches.isNotAbove", "is not above (numbers only)"), disabled: true },
  { value: "is_below", label: t("filters.matches.isBelow", "is below (numbers only)"), disabled: true },
  { value: "is_not_below", label: t("filters.matches.isNotBelow", "is not below (numbers only)"), disabled: true },
];

const FILTER_ACTION_OPTIONS: Array<{ value: MailFilterActionType; label: string }> = [
  { value: "discard", label: t("filters.actions.discard", "Discard Message") },
  { value: "redirect", label: t("filters.actions.redirect", "Redirect to Email") },
  { value: "fail", label: t("filters.actions.fail", "Fail With Message") },
  { value: "stop", label: t("filters.actions.stop", "Stop Processing Rules") },
  { value: "deliver_to_folder", label: t("filters.actions.deliverToFolder", "Deliver to Folder") },
  { value: "pipe", label: t("filters.actions.pipe", "Pipe to a Program") },
];

function toOptionsHtml<T extends string>(
  options: Array<{ value: T; label: string; disabled?: boolean }>,
  selectedValue: T,
): string {
  return options.map((option) => {
    const selected = option.value === selectedValue ? "selected" : "";
    const disabled = option.disabled ? "disabled" : "";
    return `<option value="${option.value}" ${selected} ${disabled}>${option.label}</option>`;
  }).join("");
}

function createFilterRuleRowHtml(index: number, rule?: MailFilterRule): string {
  const rowId = `filter-rule-${index}-${Date.now()}`;
  const selectedPart = rule?.part ?? "from";
  const selectedMatch = rule?.match ?? "contains";
  const selectedJoin = rule?.joinWithPrevious ?? "and";
  return `
    <div class="filter-rule-row grid grid-cols-1 gap-2 rounded-lg border border-border p-2 md:grid-cols-[90px_1fr_1fr_1fr_auto] md:items-center" data-rule-id="${rowId}">
      <select class="filter-rule-join h-9 rounded-md border border-input bg-background px-2 text-xs ${index === 0 ? "hidden" : ""}">
        <option value="and" ${selectedJoin === "and" ? "selected" : ""}>${t("filters.joinOp.and", "and")}</option>
        <option value="or" ${selectedJoin === "or" ? "selected" : ""}>${t("filters.joinOp.or", "or")}</option>
      </select>
      <select class="filter-rule-part h-9 rounded-md border border-input bg-background px-2 text-xs">
        ${toOptionsHtml(FILTER_RULE_PART_OPTIONS, selectedPart)}
      </select>
      <select class="filter-rule-match h-9 rounded-md border border-input bg-background px-2 text-xs">
        ${toOptionsHtml(FILTER_MATCH_OPTIONS, selectedMatch)}
      </select>
      <input class="filter-rule-value h-9 rounded-md border border-input bg-background px-2 text-xs" value="${escapeAttr(rule?.value ?? "")}" placeholder="${escapeAttr(t("placeholders.value", "Valor"))}" />
      <button type="button" class="filter-rule-remove rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">${t("filters.removeBtn", "-")}</button>
    </div>
  `;
}

function createFilterActionRowHtml(action?: MailFilterAction): string {
  const selectedAction = action?.type ?? "discard";
  const value = action?.value ?? "";
  return `
    <div class="filter-action-row grid grid-cols-1 gap-2 rounded-lg border border-border p-2 md:grid-cols-[1fr_1fr_auto] md:items-center">
      <select class="filter-action-type h-9 rounded-md border border-input bg-background px-2 text-xs">
        ${toOptionsHtml(FILTER_ACTION_OPTIONS, selectedAction)}
      </select>
      <input class="filter-action-value h-9 rounded-md border border-input bg-background px-2 text-xs" value="${escapeAttr(value)}" placeholder="${escapeAttr(t("placeholders.valueIfApplicable", "Valor (si aplica)"))}" />
      <button type="button" class="filter-action-remove rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">${t("filters.removeBtn", "-")}</button>
    </div>
  `;
}

function bindFilterRows() {
  document.querySelectorAll(".filter-rule-remove").forEach((button) => {
    button.addEventListener("click", () => {
      (button as HTMLElement).closest(".filter-rule-row")?.remove();
      refreshRuleJoinVisibility();
    });
  });

  document.querySelectorAll(".filter-action-remove").forEach((button) => {
    button.addEventListener("click", () => {
      (button as HTMLElement).closest(".filter-action-row")?.remove();
    });
  });
}

function refreshRuleJoinVisibility() {
  const rows = Array.from(document.querySelectorAll("#filters-rules-list .filter-rule-row"));
  rows.forEach((row, index) => {
    const join = row.querySelector(".filter-rule-join");
    if (!join) return;
    if (index === 0) join.classList.add("hidden");
    else join.classList.remove("hidden");
  });
}

function collectFilterRules(): MailFilterRule[] {
  const rows = Array.from(document.querySelectorAll("#filters-rules-list .filter-rule-row"));
  return rows.map((row, index) => {
    const part = (row.querySelector(".filter-rule-part") as HTMLSelectElement).value as MailFilterRulePart;
    const match = (row.querySelector(".filter-rule-match") as HTMLSelectElement).value as MailFilterRuleMatch;
    const value = ((row.querySelector(".filter-rule-value") as HTMLInputElement).value ?? "").trim();
    const joinWithPrevious = (row.querySelector(".filter-rule-join") as HTMLSelectElement | null)?.value as "and" | "or" | undefined;
    return {
      part,
      match,
      value,
      joinWithPrevious: index === 0 ? undefined : (joinWithPrevious ?? "and"),
    };
  });
}

function collectFilterActions(): MailFilterAction[] {
  const rows = Array.from(document.querySelectorAll("#filters-actions-list .filter-action-row"));
  return rows.map((row) => {
    const type = (row.querySelector(".filter-action-type") as HTMLSelectElement).value as MailFilterActionType;
    const value = ((row.querySelector(".filter-action-value") as HTMLInputElement).value ?? "").trim();
    return { type, value: value || undefined };
  });
}

export function resetFilterForm() {
  (document.getElementById("filters-edit-id") as HTMLInputElement).value = "";
  (document.getElementById("filters-name") as HTMLInputElement).value = "";
  (document.getElementById("filters-enabled") as HTMLInputElement).checked = true;
  const rulesList = document.getElementById("filters-rules-list") as HTMLElement;
  const actionsList = document.getElementById("filters-actions-list") as HTMLElement;
  rulesList.innerHTML = createFilterRuleRowHtml(0);
  actionsList.innerHTML = createFilterActionRowHtml();
  document.getElementById("filters-error")?.classList.add("hidden");
  bindFilterRows();
  refreshRuleJoinVisibility();
}

function fillFilterForm(filter: MailFilter) {
  (document.getElementById("filters-edit-id") as HTMLInputElement).value = String(filter.id);
  (document.getElementById("filters-name") as HTMLInputElement).value = filter.name;
  (document.getElementById("filters-enabled") as HTMLInputElement).checked = filter.enabled;
  const rulesList = document.getElementById("filters-rules-list") as HTMLElement;
  const actionsList = document.getElementById("filters-actions-list") as HTMLElement;
  rulesList.innerHTML = filter.rules.map((rule, index) => createFilterRuleRowHtml(index, rule)).join("");
  actionsList.innerHTML = filter.actions.map((action) => createFilterActionRowHtml(action)).join("");
  if (filter.rules.length === 0) {
    rulesList.innerHTML = createFilterRuleRowHtml(0);
  }
  if (filter.actions.length === 0) {
    actionsList.innerHTML = createFilterActionRowHtml();
  }
  bindFilterRows();
  refreshRuleJoinVisibility();
}

function renderFiltersList() {
  publishMailTable("mail-filters-table", S.loadedFilters.map((filter) => ({
    id: filter.id,
    name: filter.name,
    estado: filter.enabled ? t("status.active", "Activo") : t("status.inactive", "Inactivo"),
  })));
}

async function loadFilters(accountId: number) {
  const res = await filterPages.read<MailFilter[]>(params => api.get<MailFilter[]>(`/api/accounts/${accountId}/filters`, {params}), String(accountId));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  S.loadedFilters = res.ok && Array.isArray(res.data) ? res.data : [];
  renderFiltersList();
}

function setGlobalFiltersError(message: string | null) {
  const el = document.getElementById("mail-global-filters-error");
  if (!el) return;
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

function setGlobalFilterFormError(message: string | null) {
  const el = document.getElementById("mail-global-filter-form-error");
  if (!el) return;
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

function refreshGlobalRuleJoinVisibility() {
  const rows = Array.from(document.querySelectorAll("#mail-global-filter-rules-list .global-filter-rule-row"));
  rows.forEach((row, index) => {
    const join = row.querySelector(".global-filter-rule-join");
    if (!join) return;
    if (index === 0) join.classList.add("hidden");
    else join.classList.remove("hidden");
  });
}

function createGlobalFilterRuleRowHtml(index: number, rule?: MailFilterRule): string {
  const selectedPart = rule?.part ?? "from";
  const selectedMatch = rule?.match ?? "contains";
  const selectedJoin = rule?.joinWithPrevious ?? "and";
  return `
    <div class="global-filter-rule-row grid grid-cols-1 gap-2 rounded-lg border border-border p-2 md:grid-cols-[90px_1fr_1fr_1fr_auto] md:items-center">
      <select class="global-filter-rule-join h-9 rounded-md border border-input bg-background px-2 text-xs ${index === 0 ? "hidden" : ""}">
        <option value="and" ${selectedJoin === "and" ? "selected" : ""}>${t("filters.joinOp.and", "and")}</option>
        <option value="or" ${selectedJoin === "or" ? "selected" : ""}>${t("filters.joinOp.or", "or")}</option>
      </select>
      <select class="global-filter-rule-part h-9 rounded-md border border-input bg-background px-2 text-xs">
        ${toOptionsHtml(FILTER_RULE_PART_OPTIONS, selectedPart)}
      </select>
      <select class="global-filter-rule-match h-9 rounded-md border border-input bg-background px-2 text-xs">
        ${toOptionsHtml(FILTER_MATCH_OPTIONS, selectedMatch)}
      </select>
      <input class="global-filter-rule-value h-9 rounded-md border border-input bg-background px-2 text-xs" value="${escapeAttr(rule?.value ?? "")}" placeholder="${escapeAttr(t("placeholders.value", "Valor"))}" />
      <button type="button" class="global-filter-rule-remove rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">${t("filters.removeBtn", "-")}</button>
    </div>
  `;
}

function createGlobalFilterActionRowHtml(action?: MailFilterAction): string {
  const selectedAction = action?.type ?? "discard";
  const value = action?.value ?? "";
  return `
    <div class="global-filter-action-row grid grid-cols-1 gap-2 rounded-lg border border-border p-2 md:grid-cols-[1fr_1fr_auto] md:items-center">
      <select class="global-filter-action-type h-9 rounded-md border border-input bg-background px-2 text-xs">
        ${toOptionsHtml(FILTER_ACTION_OPTIONS, selectedAction)}
      </select>
      <input class="global-filter-action-value h-9 rounded-md border border-input bg-background px-2 text-xs" value="${escapeAttr(value)}" placeholder="${escapeAttr(t("placeholders.valueIfApplicable", "Valor (si aplica)"))}" />
      <button type="button" class="global-filter-action-remove rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">${t("filters.removeBtn", "-")}</button>
    </div>
  `;
}

function bindGlobalFilterRows() {
  document.querySelectorAll(".global-filter-rule-remove").forEach((button) => {
    button.addEventListener("click", () => {
      (button as HTMLElement).closest(".global-filter-rule-row")?.remove();
      refreshGlobalRuleJoinVisibility();
    });
  });
  document.querySelectorAll(".global-filter-action-remove").forEach((button) => {
    button.addEventListener("click", () => {
      (button as HTMLElement).closest(".global-filter-action-row")?.remove();
    });
  });
}

function collectGlobalFilterRules(): MailFilterRule[] {
  const rows = Array.from(document.querySelectorAll("#mail-global-filter-rules-list .global-filter-rule-row"));
  return rows.map((row, index) => {
    const part = (row.querySelector(".global-filter-rule-part") as HTMLSelectElement).value as MailFilterRulePart;
    const match = (row.querySelector(".global-filter-rule-match") as HTMLSelectElement).value as MailFilterRuleMatch;
    const value = ((row.querySelector(".global-filter-rule-value") as HTMLInputElement).value ?? "").trim();
    const joinWithPrevious = (row.querySelector(".global-filter-rule-join") as HTMLSelectElement | null)?.value as "and" | "or" | undefined;
    return {
      part,
      match,
      value,
      joinWithPrevious: index === 0 ? undefined : (joinWithPrevious ?? "and"),
    };
  });
}

function collectGlobalFilterActions(): MailFilterAction[] {
  const rows = Array.from(document.querySelectorAll("#mail-global-filter-actions-list .global-filter-action-row"));
  return rows.map((row) => {
    const type = (row.querySelector(".global-filter-action-type") as HTMLSelectElement).value as MailFilterActionType;
    const value = ((row.querySelector(".global-filter-action-value") as HTMLInputElement).value ?? "").trim();
    return { type, value: value || undefined };
  });
}

export function resetGlobalFilterForm() {
  (document.getElementById("mail-global-filter-id") as HTMLInputElement).value = "";
  (document.getElementById("mail-global-filter-name") as HTMLInputElement).value = "";
  (document.getElementById("mail-global-filter-enabled") as HTMLInputElement).checked = true;
  const rulesList = document.getElementById("mail-global-filter-rules-list") as HTMLElement;
  const actionsList = document.getElementById("mail-global-filter-actions-list") as HTMLElement;
  rulesList.innerHTML = createGlobalFilterRuleRowHtml(0);
  actionsList.innerHTML = createGlobalFilterActionRowHtml();
  (document.getElementById("mail-global-filter-dialog-title") as HTMLElement).textContent = t("globalFilters.createTitle", "Create Global Email Filter");
  setGlobalFilterFormError(null);
  bindGlobalFilterRows();
  refreshGlobalRuleJoinVisibility();
}

function fillGlobalFilterForm(filter: GlobalMailFilter) {
  (document.getElementById("mail-global-filter-id") as HTMLInputElement).value = filter.id;
  (document.getElementById("mail-global-filter-name") as HTMLInputElement).value = filter.name;
  (document.getElementById("mail-global-filter-enabled") as HTMLInputElement).checked = filter.enabled;
  const rulesList = document.getElementById("mail-global-filter-rules-list") as HTMLElement;
  const actionsList = document.getElementById("mail-global-filter-actions-list") as HTMLElement;
  rulesList.innerHTML = filter.rules.map((rule, index) => createGlobalFilterRuleRowHtml(index, rule)).join("");
  actionsList.innerHTML = filter.actions.map((action) => createGlobalFilterActionRowHtml(action)).join("");
  if (filter.rules.length === 0) rulesList.innerHTML = createGlobalFilterRuleRowHtml(0);
  if (filter.actions.length === 0) actionsList.innerHTML = createGlobalFilterActionRowHtml();
  (document.getElementById("mail-global-filter-dialog-title") as HTMLElement).textContent = fmt(t("globalFilters.editTitle", "Edit Global Filter: {name}"), { name: filter.name });
  setGlobalFilterFormError(null);
  bindGlobalFilterRows();
  refreshGlobalRuleJoinVisibility();
}

export function closeGlobalFilterDialog() {
  (document.getElementById("mail-global-filter-dialog") as HTMLDialogElement | null)?.close();
}

function openGlobalFilterDialogCreate() {
  resetGlobalFilterForm();
  openDialog("mail-global-filter-dialog");
}

function openGlobalFilterDialogEdit(filterId: string) {
  const target = S.loadedGlobalMailFilters.find((item) => item.id === filterId);
  if (!target) return;
  fillGlobalFilterForm(target);
  openDialog("mail-global-filter-dialog");
}

function renderGlobalFiltersList() {
  publishMailTable("mail-global-filters-table", S.loadedGlobalMailFilters.map((filter) => ({
    id: filter.id,
    name: filter.name,
    estado: filter.enabled ? t("status.active", "Activo") : t("status.inactive", "Inactivo"),
    rules: filter.rules.length,
    actionsCount: filter.actions.length,
    _id: filter.id,
  })));
}

export async function loadGlobalFilters() {
  const res = await globalFilterPages.read<GlobalMailFilter[]>(params => api.get<GlobalMailFilter[]>("/api/mail/global-filters", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!res.ok) {
    setGlobalFiltersError(res.error ?? t("errors.globalFiltersLoadFailed", "No se pudieron cargar los filtros globales."));
    return;
  }
  setGlobalFiltersError(null);
  S.loadedGlobalMailFilters = Array.isArray(res.data) ? res.data : [];
  renderGlobalFiltersList();
  updateMailTabCounts();
}

async function runGlobalFilterTest() {
  const message = ((document.getElementById("mail-global-filters-test-message") as HTMLTextAreaElement | null)?.value ?? "").trim();
  const summary = document.getElementById("mail-global-filters-test-summary");
  const list = document.getElementById("mail-global-filters-test-results");
  if (!message) {
    setGlobalFiltersError(t("errors.mustEnterTestMessage", "Debes ingresar un mensaje de prueba."));
    return;
  }
  const res = await api.post<{ total: number; matched: number; items: Array<{ id: string; name: string; enabled: boolean; matched: boolean; actions: string[] }> }>(
    "/api/mail/global-filters/test",
    { message },
  );
  if (!res.ok) {
    setGlobalFiltersError(res.error ?? t("errors.globalFilterTestFailed", "No se pudo ejecutar el test."));
    return;
  }
  setGlobalFiltersError(null);
  const data = res.data as any;
  if (summary) summary.textContent = fmt(t("globalFilters.testSummary", "Matched {matched} of {total} filters"), { matched: data?.matched ?? 0, total: data?.total ?? 0 });
  if (!list) return;
  const items = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) {
    list.innerHTML = `<div class=\"rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground\">${t("globalFilters.noFiltersConfigured", "No filters configured.")}</div>`;
    return;
  }
  list.innerHTML = items.map((item: any) => `
    <div class="rounded-lg border ${item.matched ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"} px-3 py-2 text-xs">
      <p class="font-medium">${escapeAttr(item.name)} ${item.matched ? `(${t("globalFilters.matched", "matched")})` : `(${t("globalFilters.noMatch", "no match")})`}</p>
      ${item.matched && Array.isArray(item.actions) && item.actions.length
        ? `<ul class="mt-1 space-y-1 text-muted-foreground">${item.actions.map((action: string) => `<li>- ${escapeAttr(action)}</li>`).join("")}</ul>`
        : ""}
    </div>
  `).join("");
}

(window as any).openFiltersDialog = async (id: number) => {
  const account = S.accounts.find((a) => a.id === id);
  if (!account) {
    showToast(t("errors.accountNotFound", "No se encontró la cuenta"), false);
    return;
  }
  S.filtersAccountId = id;
  (document.getElementById("filters-account-label") as HTMLElement).textContent = account.address;
  await loadFilters(id);
  resetFilterForm();
  openDialog("dialog-filters");
};

(window as any).editMailFilter = (filterId: number) => {
  const filter = S.loadedFilters.find((item) => item.id === filterId);
  if (!filter) {
    showToast(t("errors.filterNotFound", "No se encontró el filtro"), false);
    return;
  }
  fillFilterForm(filter);
};

(window as any).deleteMailFilter = async (filterId: number) => {
  if (!S.filtersAccountId) return;
  const filter = S.loadedFilters.find((item) => item.id === filterId);
  const filterName = filter?.name ?? `#${filterId}`;
  const confirmed = await openConfirm(fmt(t("confirm.deleteFilter", "¿Eliminar el filtro \"{name}\"?"), { name: filterName }), { title: t("confirm.deleteFilterTitle", "Eliminar filtro"), variant: "danger" });
  if (!confirmed) return;

  const res = await api.delete(`/api/accounts/${S.filtersAccountId}/filters/${filterId}`);
  if (!res.ok) {
    showToast(res.error ?? t("errors.filterDeleteFailed", "No se pudo eliminar el filtro"), false);
    return;
  }
  showToast(t("toasts.filterDeleted", "Filtro eliminado"));
  await loadFilters(S.filtersAccountId);
  resetFilterForm();
};

(window as any).editGlobalMailFilter = (filterId: string) => {
  openGlobalFilterDialogEdit(filterId);
};

(window as any).deleteGlobalMailFilter = async (filterId: string) => {
  const target = S.loadedGlobalMailFilters.find((item) => item.id === filterId);
  const label = target?.name ?? filterId;
  const confirmed = await openConfirm(fmt(t("confirm.deleteGlobalFilter", "¿Eliminar filtro global \"{label}\"?"), { label }), { title: t("confirm.deleteGlobalFilterTitle", "Eliminar filtro global"), variant: "danger" });
  if (!confirmed) return;

  const res = await api.delete(`/api/mail/global-filters/${encodeURIComponent(filterId)}`);
  if (!res.ok) {
    setGlobalFiltersError(res.error ?? t("errors.globalFilterDeleteFailed", "No se pudo eliminar el filtro global."));
    return;
  }
  await loadGlobalFilters();
  showToast(t("toasts.globalFilterDeleted", "Filtro global eliminado"));
};

const closeFiltersDialog = () => (document.getElementById("dialog-filters") as HTMLDialogElement).close();

document.getElementById("filters-dialog-close")?.addEventListener("click", closeFiltersDialog);

document.getElementById("filters-cancel")?.addEventListener("click", closeFiltersDialog);

document.getElementById("filters-new")?.addEventListener("click", () => resetFilterForm());

document.getElementById("filters-add-rule")?.addEventListener("click", () => {
  const list = document.getElementById("filters-rules-list") as HTMLElement | null;
  if (!list) return;
  const index = list.querySelectorAll(".filter-rule-row").length;
  list.insertAdjacentHTML("beforeend", createFilterRuleRowHtml(index));
  bindFilterRows();
  refreshRuleJoinVisibility();
});

document.getElementById("filters-add-action")?.addEventListener("click", () => {
  const list = document.getElementById("filters-actions-list") as HTMLElement | null;
  if (!list) return;
  list.insertAdjacentHTML("beforeend", createFilterActionRowHtml());
  bindFilterRows();
});

(document.getElementById("dialog-filters") as HTMLDialogElement | null)?.addEventListener("close", () => {
  S.filtersAccountId = null;
  S.loadedFilters = [];
});

document.getElementById("filters-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!S.filtersAccountId) return;

  const errEl = document.getElementById("filters-error") as HTMLElement;
  errEl.classList.add("hidden");
  const idRaw = (document.getElementById("filters-edit-id") as HTMLInputElement).value.trim();
  const name = (document.getElementById("filters-name") as HTMLInputElement).value.trim();
  const enabled = (document.getElementById("filters-enabled") as HTMLInputElement).checked;
  const rules = collectFilterRules();
  const actions = collectFilterActions();

  if (!name) {
    errEl.textContent = t("errors.mustIndicateFilterName", "Debes indicar un nombre de filtro.");
    errEl.classList.remove("hidden");
    return;
  }
  if (!rules.length) {
    errEl.textContent = t("errors.mustAddAtLeastOneRule", "Debes agregar al menos una regla.");
    errEl.classList.remove("hidden");
    return;
  }
  if (!actions.length) {
    errEl.textContent = t("errors.mustAddAtLeastOneAction", "Debes agregar al menos una acción.");
    errEl.classList.remove("hidden");
    return;
  }

  const payload = { name, enabled, rules, actions };
  const res = idRaw
    ? await api.put(`/api/accounts/${S.filtersAccountId}/filters/${idRaw}`, payload)
    : await api.post(`/api/accounts/${S.filtersAccountId}/filters`, payload);

  if (!res.ok) {
    errEl.textContent = res.error ?? t("errors.filterSaveFailed", "No se pudo guardar el filtro.");
    errEl.classList.remove("hidden");
    return;
  }

  showToast(idRaw ? t("toasts.filterUpdated", "Filtro actualizado") : t("toasts.filterCreated", "Filtro creado"));
  await loadFilters(S.filtersAccountId);
  resetFilterForm();
});

document.getElementById("mail-global-filters-new")?.addEventListener("click", () => {
  S.mailGlobalFiltersLoaded = true;
  openGlobalFilterDialogCreate();
});

document.getElementById("mail-global-filters-test-run")?.addEventListener("click", () => {
  S.mailGlobalFiltersLoaded = true;
  void runGlobalFilterTest();
});

document.getElementById("mail-global-filter-dialog-close")?.addEventListener("click", closeGlobalFilterDialog);

document.getElementById("mail-global-filter-cancel")?.addEventListener("click", closeGlobalFilterDialog);

document.getElementById("mail-global-filter-add-rule")?.addEventListener("click", () => {
  const list = document.getElementById("mail-global-filter-rules-list");
  if (!list) return;
  const index = list.querySelectorAll(".global-filter-rule-row").length;
  list.insertAdjacentHTML("beforeend", createGlobalFilterRuleRowHtml(index));
  bindGlobalFilterRows();
  refreshGlobalRuleJoinVisibility();
});

document.getElementById("mail-global-filter-add-action")?.addEventListener("click", () => {
  const list = document.getElementById("mail-global-filter-actions-list");
  if (!list) return;
  list.insertAdjacentHTML("beforeend", createGlobalFilterActionRowHtml());
  bindGlobalFilterRows();
});

document.getElementById("mail-global-filter-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setGlobalFilterFormError(null);
  const id = ((document.getElementById("mail-global-filter-id") as HTMLInputElement | null)?.value ?? "").trim();
  const name = ((document.getElementById("mail-global-filter-name") as HTMLInputElement | null)?.value ?? "").trim();
  const enabled = (document.getElementById("mail-global-filter-enabled") as HTMLInputElement | null)?.checked ?? true;
  const rules = collectGlobalFilterRules();
  const actions = collectGlobalFilterActions();

  if (!name) {
    setGlobalFilterFormError(t("errors.mustIndicateName", "Debes indicar un nombre."));
    return;
  }
  if (!rules.length) {
    setGlobalFilterFormError(t("errors.mustAddAtLeastOneRule", "Debes agregar al menos una regla."));
    return;
  }
  if (!actions.length) {
    setGlobalFilterFormError(t("errors.mustAddAtLeastOneAction", "Debes agregar al menos una acción."));
    return;
  }

  const payload = { name, enabled, rules, actions };
  const res = id
    ? await api.put("/api/mail/global-filters/" + encodeURIComponent(id), payload)
    : await api.post("/api/mail/global-filters", payload);
  if (!res.ok) {
    setGlobalFilterFormError(res.error ?? t("errors.globalFilterSaveFailed", "No se pudo guardar el filtro global."));
    return;
  }

  closeGlobalFilterDialog();
  await loadGlobalFilters();
  showToast(id ? t("toasts.globalFilterUpdated", "Filtro global actualizado") : t("toasts.globalFilterCreated", "Filtro global creado"));
});
