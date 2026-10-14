import {readTablePageSize} from "/scripts/extracted/lib/table-pages.js";
// Mail page — mail accounts: list loader (+sudo prompt), usage summary, render,
// bulk actions, default-inbox storage, and the create/edit/password dialogs.
// Registers the account window.* globals on import.
import { api, resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { awaitJob, pollJob } from "/scripts/extracted/lib/mail-job-poll.js?v=20260930a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { promptSudoPassword } from "/scripts/extracted/lib/mail-sudo.js?v=20260930a";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import type { MailAccount, MailForward } from "./state";
import { LOCAL_PART_RE, MAIL_DEFAULT_ACCOUNT_KEY_PREFIX, SIMPLE_EMAIL_RE, S } from "./state";
import { fmt, fnv1aId, formatPercent, formatStorage, getCheckedRadioValue, openInputModal, parseLocalAndDomain, setCheckedRadioValue, setToggleLoadingDialog, showToast, t, usageBarClass } from "./dom";
import { publishMailTable } from "./table-bridge";
import { addForwardRow, collectForwards } from "./forwards";
import { loadDomains } from "./domains";
import { updateMailTabCounts } from "./settings";
import { openDialog } from "/scripts/extracted/lib/dom.js";

export const awaitMailJob = (res: any): Promise<void> => awaitJob(res);

export async function handleMailAccountsBulkAction(
  actionId: string,
  targets: Array<{ id: number; address: string }>,
): Promise<void> {
  const count = targets.length;

  if (actionId === "bulkDelete") {
    const confirmed = await openConfirm(
      fmt(t("confirm.bulkDeleteAccounts", "¿Eliminar {count} cuenta(s) de correo? Esta acción no se puede deshacer."), { count }),
      { title: t("titles.deleteAccounts", "Eliminar cuentas"), variant: "danger", confirmText: t("confirm.yesDelete", "Sí, eliminar") },
    );
    if (!confirmed) return;
    let ok = 0;
    let lastJob: any;
    for (const tgt of targets) {
      const res = await api.delete(`/api/accounts/${tgt.id}`);
      if (res.ok) { ok += 1; lastJob = (res.data as any)?.job ?? lastJob; }
    }
    showToast(fmt(t("toasts.bulkDeletedCount", "{ok}/{count} cuenta(s) eliminada(s)"), { ok, count }), ok === count);
    await pollJob(lastJob);
    await loadAccounts();
    return;
  }

  if (actionId === "bulkQuota") {
    const raw = await openInputModal({
      title: t("titles.changeQuota", "Cambiar quota"),
      label: fmt(t("labels.newQuotaFor", "Nueva quota en MB para {count} cuenta(s). Usa 0 para ilimitado."), { count }),
      value: "1024",
      type: "number",
    });
    if (raw === null) return;
    const quotaMb = Number(raw.trim());
    if (!Number.isFinite(quotaMb) || quotaMb < 0) {
      showToast(t("errors.quotaInvalid", "Quota inválida"), false);
      return;
    }
    let ok = 0;
    let lastJob: any;
    for (const tgt of targets) {
      const res = await api.put(`/api/accounts/${tgt.id}`, { quotaMb });
      if (res.ok) { ok += 1; lastJob = (res.data as any)?.job ?? lastJob; }
    }
    showToast(fmt(t("toasts.bulkUpdatedCount", "{ok}/{count} cuenta(s) actualizada(s)"), { ok, count }), ok === count);
    await pollJob(lastJob);
    await loadAccounts();
    return;
  }

  if (actionId === "bulkForward") {
    const dest = await openInputModal({
      title: t("titles.addForward", "Añadir reenvío"),
      label: fmt(t("labels.destEmailForCount", "Correo destino del reenvío a añadir en {count} cuenta(s):"), { count }),
      placeholder: "destino@dominio.com",
      type: "email",
    });
    if (dest === null) return;
    const destination = dest.trim().toLowerCase();
    if (!SIMPLE_EMAIL_RE.test(destination)) {
      showToast(t("errors.destEmailInvalid", "Correo destino inválido"), false);
      return;
    }
    let ok = 0;
    for (const tgt of targets) {
      const cur = await api.get<MailForward[]>(`/api/accounts/${tgt.id}/forwards`);
      if (!cur.ok) continue;
      const existing = Array.isArray(cur.data) ? cur.data : [];
      if (existing.some((f) => (f.destination ?? "").trim().toLowerCase() === destination)) {
        ok += 1; // already present — treat as success, skip duplicate
        continue;
      }
      const forwards = [
        ...existing.map((f) => ({ destination: f.destination, keepCopy: f.keepCopy !== false })),
        { destination, keepCopy: true },
      ];
      const res = await api.put(`/api/accounts/${tgt.id}/forwards`, { forwards });
      if (res.ok) ok += 1;
    }
    showToast(fmt(t("toasts.forwardAddedCount", "Reenvío añadido en {ok}/{count} cuenta(s)"), { ok, count }), ok === count);
    await loadAccounts();
    return;
  }
}

function getTargetScopeForMailDefault(): string {
  return resolveTargetScope();
}

function getMailDefaultStorageKey(): string {
  return `${MAIL_DEFAULT_ACCOUNT_KEY_PREFIX}:${getTargetScopeForMailDefault()}`;
}

function getStoredDefaultAccountId(): number | null {
  try {
    const raw = localStorage.getItem(getMailDefaultStorageKey());
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setStoredDefaultAccountId(accountId: number) {
  try {
    localStorage.setItem(getMailDefaultStorageKey(), String(accountId));
  } catch {
    // Ignore storage errors.
  }
}

function clearStoredDefaultAccountId() {
  try {
    localStorage.removeItem(getMailDefaultStorageKey());
  } catch {
    // Ignore storage errors.
  }
}

function resolveDefaultAccountIdFromAccounts(list: MailAccount[]): number | null {
  if (!list.length) return null;
  const storedId = getStoredDefaultAccountId();
  if (storedId !== null) {
    const exists = list.some((account) => account.id === storedId);
    if (exists) return storedId;
    clearStoredDefaultAccountId();
  }
  const fallbackId = list[0]?.id ?? null;
  if (fallbackId !== null) {
    setStoredDefaultAccountId(fallbackId);
  }
  return fallbackId;
}

export function autoOpenDefaultInboxIfNeeded(list: MailAccount[]) {
  if (S.didAutoOpenDefaultInbox) return;
  S.didAutoOpenDefaultInbox = true;

  // Sólo en la vista de cuentas de correo (la ruta real puede ser `/mail` o
  // `/panel/mail` según el ruteo del panel). No en la vista de un buzón.
  const pathname = window.location.pathname.replace(/\/+$/, "");
  const onAccountsPage = pathname === "/panel/mail" || pathname === "/mail" || pathname.endsWith("/panel/mail");
  if (!onAccountsPage) return;

  // Sólo auto-abrimos cuando hay un predeterminado EXPLÍCITO guardado (no el
  // fallback a la primera cuenta), para no abrir el buzón en cada visita.
  const accountId = getStoredDefaultAccountId();
  if (!accountId) return;
  const account = list.find((a) => a.id === accountId);
  if (!account) return;

  // Abrir el buzón predeterminado en el drawer derecho (ya no navegamos a otra
  // página). Se emite tras un tick para asegurar que la isla del drawer montó.
  const scope = resolveTargetScope();
  const root = document.querySelector('[data-mail-main-panel="emails"]');
  window.setTimeout(() => {
    if (scope !== resolveTargetScope() || root !== document.querySelector('[data-mail-main-panel="emails"]')) return;
    window.dispatchEvent(new CustomEvent("lxp:mail:open-inbox", {
      detail: {
        id: accountId,
        address: account?.address ?? "",
        accounts: list.map((a) => ({ id: a.id, address: a.address })),
      },
    }));
  }, 300);
}

function renderUsageSummary(list: MailAccount[]) {
  const box = document.getElementById("mail-usage-summary");
  const text = document.getElementById("mail-usage-summary-text");
  const percentLabel = document.getElementById("mail-usage-summary-percent");
  const bar = document.getElementById("mail-usage-summary-bar");
  if (!box || !text || !percentLabel || !bar) return;

  if (list.length === 0 || accountUsagePending) {
    box.classList.add("hidden");
    return;
  }

  const totalUsedMb = mailSummary?.usedMb ?? list.reduce((acc, item) => acc + Math.max(0, item.usedMb ?? 0), 0);

  // Card limit = real server disk size (filesystem holding the maildirs),
  // NOT the sum of per-account quotas.
  if (S.serverDiskTotalMb > 0) {
    const percent = (totalUsedMb / S.serverDiskTotalMb) * 100;
    text.textContent = `${formatStorage(totalUsedMb)} / ${formatStorage(S.serverDiskTotalMb)}`;
    percentLabel.textContent = formatPercent(percent);
    bar.className = `h-full rounded-full transition-all ${usageBarClass(percent, true)}`;
    bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    box.classList.remove("hidden");
    return;
  }

  const hasUnlimited = mailSummary?.hasUnlimited ?? list.some((item) => Math.max(0, item.quotaMb ?? 0) <= 0);
  const totalQuotaMb = mailSummary?.quotaMb ?? list.reduce((acc, item) => acc + Math.max(0, item.quotaMb ?? 0), 0);

  if (hasUnlimited || totalQuotaMb <= 0) {
    text.textContent = `${formatStorage(totalUsedMb)} / ${t("labels.unlimited", "Ilimitado")}`;
    percentLabel.textContent = t("labels.noGlobalLimit", "Sin límite global");
    bar.className = "h-full rounded-full bg-primary/70";
    bar.style.width = "100%";
    box.classList.remove("hidden");
    return;
  }

  const percent = (totalUsedMb / totalQuotaMb) * 100;
  const width = Math.max(0, Math.min(100, percent));

  text.textContent = `${formatStorage(totalUsedMb)} / ${formatStorage(totalQuotaMb)}`;
  percentLabel.textContent = formatPercent(percent);
  bar.className = `h-full rounded-full transition-all ${usageBarClass(percent, true)}`;
  bar.style.width = `${width}%`;
  box.classList.remove("hidden");
}

function renderAccounts(list: MailAccount[]) {
  const rows = list.map((a) => {
    const quotaMb = Math.max(0, a.quotaMb ?? 0); // 0 ⇒ sin límite (Ilimitado)
    const usageKnown = typeof a.usedMb === "number";
    const usedMb = Math.max(0, a.usedMb ?? 0);
    const limitedQuota = quotaMb > 0;
    const percentRaw = limitedQuota
      ? (typeof a.usedPercent === "number" ? a.usedPercent : (usedMb / quotaMb) * 100)
      : 100;
    const percent = Number.isFinite(percentRaw) ? Math.max(0, percentRaw) : 0;
    const quotaLabel = limitedQuota ? formatStorage(quotaMb) : t("labels.unlimited", "Ilimitado");
    const usoLabel = usageKnown
      ? `${formatStorage(usedMb)} / ${quotaLabel}${limitedQuota ? ` · ${formatPercent(percent)}` : " · ∞"}`
      : `n/d / ${quotaLabel}`;
    const forwardDests = (a.forwards ?? [])
      .map((f) => (f?.destination ?? "").trim())
      .filter(Boolean);
    const isDefault = a.id === getStoredDefaultAccountId();
    return {
      id: a.id,
      address: isDefault ? `★ ${a.address}` : a.address,
      _address: a.address,
      _isDefault: isDefault,
      domain: a.domain ?? a.address.split("@")[1] ?? "",
      uso: {
        __cell: "usagebar" as const,
        percent: usageKnown ? (limitedQuota ? percent : 100) : -1,
        label: usoLabel,
        barClass: usageKnown ? usageBarClass(percent, limitedQuota) : "bg-muted-foreground/40",
      },
      // Numeric sort key for the "uso" column (unknown sorts lowest).
      usoPct: usageKnown ? (limitedQuota ? percent : Number.MAX_SAFE_INTEGER) : -1,
      reenvios: forwardDests.length ? forwardDests : "",
      estado: a.enabled ? t("status.active", "Activo") : t("status.deactivated", "Desactivado"),
      _enabled: !!a.enabled,
    };
  });
  publishMailTable("mail-accounts-table", rows);

  // Populate the "Dominio" filter from the domains actually present in the
  // loaded accounts. Deriving the options from the rows (instead of the
  // nginx/DNS picker endpoint) guarantees every option matches a row value,
  // so the select-filter (exact match) always returns results — a mailbox
  // can live on a domain that has no nginx site, which made the old
  // /api/nginx/domains source come back empty ("no trae nada").
  const domainOptions = [...new Set(mailSummary?.domains ?? rows.map((r) => r.domain).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((d) => ({ label: d, value: d }));
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_FILTER_OPTIONS, {
    detail: { tableId: "mail-accounts-table", filterId: "filterMailAccountDomain", options: domainOptions },
  }));
}

let accountsLoadGeneration = 0;
let accountUsagePending = false;
let mailPage = 1, mailPageSize = readTablePageSize(window,"mail-accounts-table");
let mailWindowLoading = false, mailWindowVersion=0;
let mailFilters: Record<string, string> = {};
let mailSorting: Array<{ id: string; desc: boolean }> = [];
let mailScope = "";
let mailSummary: { total: number; domains: string[]; usedMb: number; quotaMb: number; hasUnlimited: boolean } | undefined;
let mailPagination = { window: true, version:0, total: 0, hasMore: true, loading: false, error: null as string | null, canPrev: false, canNext: false, info: "" };
window.addEventListener(DATATABLE_EVENTS.LOAD_MORE, (event: Event) => {
  const detail = (event as CustomEvent).detail;
  if (detail?.tableId !== "mail-accounts-table" || mailWindowLoading) return;
  void loadAccounts(false, true);
});
window.addEventListener(DATATABLE_EVENTS.QUERY, (event: Event) => {
  const detail = (event as CustomEvent).detail;
  if (detail?.tableId !== "mail-accounts-table") return;
  mailPage = 1; mailFilters = detail.filters ?? {}; mailSorting = detail.sorting ?? [];
  if ([10, 20, 50, 100].includes(Number(detail.pageSize))) mailPageSize = Number(detail.pageSize);
  void loadAccounts();
});
window.addEventListener(DATATABLE_EVENTS.READY, (event: Event) => {
  if ((event as CustomEvent).detail?.tableId === "mail-accounts-table") {
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_PAGINATION, { detail: { tableId: "mail-accounts-table", ...mailPagination } }));
  }
});

let usageReadAt = 0;
export async function loadAccounts(background = false, append = false): Promise<boolean> {
  if (append && mailWindowLoading) return false;
  const generation = ++accountsLoadGeneration;
  const scope = resolveTargetScope();
  const root = document.querySelector('[data-mail-main-panel="emails"]');
  const isCurrent = () => generation === accountsLoadGeneration && scope === resolveTargetScope()
    && root === document.querySelector('[data-mail-main-panel="emails"]');
  if (mailScope !== scope) { append = false; mailScope = scope; mailPage = 1; mailFilters = {}; mailSorting = []; usageReadAt = 0; }
  const preserveUsage = background && Date.now() - usageReadAt < 60_000;
  const previousUsage = preserveUsage ? new Map(S.accounts.map(account => [account.id, account.usedMb])) : new Map<number, number | null | undefined>();
  const previousTotalUsedMb = preserveUsage ? mailSummary?.usedMb : undefined;
  accountUsagePending = !preserveUsage;
  if (!preserveUsage) S.serverDiskTotalMb = 0;
  mailWindowLoading = true;
  mailPagination = { ...mailPagination, version:append ? mailWindowVersion : ++mailWindowVersion, loading: true, error: null };
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_PAGINATION, { detail: { tableId: "mail-accounts-table", ...mailPagination } }));
  const PAGE_SIZE = mailPageSize;
  const firstPage = append ? Math.ceil(S.accounts.length / PAGE_SIZE) + 1 : 1;
  const lastPage = background && !append ? Math.max(2, mailPage) : firstPage + 1;
  const requestParams: Record<string, string | number | boolean> = { page: mailPage, limit: PAGE_SIZE };
  if (mailFilters.searchMailAccount) requestParams.search = mailFilters.searchMailAccount;
  if (mailFilters.filterMailAccountDomain) requestParams.domain = mailFilters.filterMailAccountDomain;
  if (mailFilters.filterMailAccountEstado) requestParams.enabled = mailFilters.filterMailAccountEstado === t("status.active", "Activo");
  if (mailSorting[0]) {
    requestParams.sortBy = ({ estado: "enabled", uso: "usedPercent" } as Record<string, string>)[mailSorting[0].id] ?? mailSorting[0].id;
    requestParams.sortDir = mailSorting[0].desc ? "desc" : "asc";
  }
  const collected: MailAccount[] = append ? [...S.accounts] : [];

  let reported = 0;

  for (let requestedPage = firstPage; requestedPage <= lastPage; requestedPage++) {
    requestParams.page = requestedPage;
    let res = await api.get<any>("/api/accounts", {
      params: {
        ...requestParams,
        includeUsage: false,
      },
    });

    // Startup can invalidate the shared read queue before the first request
    // reaches the server. Retry reads only while this mailbox view still owns
    // the same target; the mail adapter also pins its original selection.
    for (let attempt = 0; attempt < 2 && res.code === "TARGET_SCOPE_CHANGED" && isCurrent(); attempt++) {
      await new Promise(resolve => globalThis.setTimeout(resolve, 100));
      if (!isCurrent()) return false;
      res = await api.get<any>("/api/accounts", { params: { ...requestParams, includeUsage: false }, fresh: true });
    }

    if (!isCurrent()) return false;
    if (!res.ok) {
      window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_LOADING, { detail: { tableId: "mail-accounts-table", loading: false } }));
      const error = res.error ?? t("errors.accountsLoadFailed", "Error al cargar cuentas");
      mailWindowLoading = false;
      mailPagination = { ...mailPagination, loading: false, error };
      window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_PAGINATION, { detail: { tableId: "mail-accounts-table", ...mailPagination } }));
      showToast(error, false);
      return false;
    }

    const data = res.data as any;
    const items = (data.items ?? data ?? []) as MailAccount[];
    const seen = new Set(collected.map(item => item.id));
    collected.push(...items.filter(item => !seen.has(item.id)));
    reported = data.total ?? collected.length;
    S.accountsTotal = data.summary?.total ?? reported;
    // Publish each page as it arrives, rather than holding the first rows
    // behind the rest of the mailbox list or its live disk/usage probe.
    mailSummary = data.summary;
    if (mailSummary && previousTotalUsedMb !== undefined) mailSummary = {...mailSummary, usedMb:previousTotalUsedMb};
    S.accounts = collected.map(account => {
      const usedMb = previousUsage.get(account.id);
      const quotaMb = account.quotaMb ?? 0;
      return typeof usedMb === "number" ? {...account, usedMb, usedPercent:quotaMb > 0 ? usedMb/quotaMb*100 : 0} : account;
    });
    renderUsageSummary(S.accounts);
    renderAccounts(S.accounts);
    updateMailTabCounts();

    const badge = document.getElementById("tab-emails-count");
    if (badge) badge.textContent = String(mailSummary?.total ?? reported);
    mailPage = requestedPage;
    if (items.length === 0 || collected.length >= reported) break;
  }
  mailWindowLoading = false;
  mailPagination = { window: true, version:mailWindowVersion, total: reported, hasMore: collected.length < reported, loading: false, error: null,
    canPrev: false, canNext: collected.length < reported, info: "" };
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_PAGINATION, { detail: { tableId: "mail-accounts-table", ...mailPagination } }));

  if (collected.length === 0) {
    accountUsagePending = false;
    return true;
  }
  if (preserveUsage) return true;
  usageReadAt = Date.now();
  void (async () => {
    const usageRows = new Map<number, MailAccount>();
    let sudoNeeded = false;

    for (let usagePage = firstPage; usagePage <= mailPage; usagePage++) {
      const usageRes = await api.get<any>("/api/accounts", { params: { ...requestParams, page: usagePage, includeUsage: true } });
      if (!isCurrent()) return;
      if (!usageRes.ok) { accountUsagePending = false; return; }
      const data = usageRes.data as any;
      const items = (data.items ?? data ?? []) as MailAccount[];
      for (const item of items) usageRows.set(item.id, item);
      if (usagePage === 1) {
        sudoNeeded = Boolean(data?.sudoRequired);
        if (typeof data?.diskTotalMb === "number") S.serverDiskTotalMb = data.diskTotalMb;
      }
      if (data.summary) mailSummary = data.summary;
    }
    if (!isCurrent()) return;
    accountUsagePending = false;
    S.accounts = S.accounts.map((account) => {
      const usage = usageRows.get(account.id);
      return usage ? { ...account, usedMb: usage.usedMb, usedPercent: usage.usedPercent, quotaMb: usage.quotaMb } : account;
    });
    renderUsageSummary(S.accounts);
    renderAccounts(S.accounts);
    if (sudoNeeded && !S.sudoPromptShown) {
      S.sudoPromptShown = true;
      const password = await promptSudoPassword({
        message: t("labels.sudoPromptMessage", "No se puede leer el uso de las casillas sin privilegios en el servidor. Introduce la contraseña sudo del usuario SSH (se guarda cifrada en el servidor)."),
      });
      if (password && isCurrent()) {
        S.sudoPromptShown = false;
        await loadAccounts();
      }
    }
  })().catch(() => { if (isCurrent()) accountUsagePending = false; });
  return true;
}

export function closeAccountActionMenus() {
  document.querySelectorAll<HTMLElement>("[id^='account-actions-menu-']").forEach((menu) => {
    menu.classList.add("hidden");
  });
}

(window as any).closeAccountActionMenus = closeAccountActionMenus;

(window as any).toggleAccountActionsMenu = (event: Event, accountId: number) => {
  event.stopPropagation();
  const menu = document.getElementById(`account-actions-menu-${accountId}`) as HTMLElement | null;
  if (!menu) return;
  const willOpen = menu.classList.contains("hidden");
  closeAccountActionMenus();
  if (willOpen) {
    menu.classList.remove("hidden");
  }
};

(window as any).handleToggle = async (id: number, enabled: boolean) => {
  const account = S.accounts.find((item) => item.id === id);
  const actionText = enabled ? t("labels.deactivating", "Desactivando") : t("labels.activating", "Activando");
  const accountText = account?.address ? ` ${account.address}` : "";
  setToggleLoadingDialog(true, `${actionText}${accountText}...`);

  try {
    const res = await api.put(`/api/accounts/${id}`, { enabled: !enabled });
    if (res.ok) {
      showToast(enabled ? t("toasts.accountDeactivated", "Cuenta desactivada") : t("toasts.accountActivated", "Cuenta activada"));
      await awaitMailJob(res);
      await loadAccounts();
    } else {
      showToast(res.error ?? t("errors.toggleFailed", "Error al cambiar estado"), false);
    }
  } finally {
    setToggleLoadingDialog(false);
  }
};

(window as any).openPasswordDialog = (id: number, address: string) => {
  S.editAccountId = id;
  document.getElementById("pass-dialog-account")!.textContent = fmt(t("labels.accountColon", "Cuenta: {address}"), { address });
  openDialog("dialog-password");
};

(window as any).setDefaultInboxAccount = (id: number, address: string) => {
  const accountExists = S.accounts.some((account) => account.id === id);
  if (!accountExists) {
    showToast(t("errors.accountNotFound", "No se encontró la cuenta"), false);
    return;
  }
  setStoredDefaultAccountId(id);
  renderAccounts(S.accounts);
  showToast(fmt(t("toasts.defaultInboxSet", "{address} ahora es el correo predeterminado"), { address }));
};

(window as any).deleteMailAccount = async (id: number, address: string) => {
  if (!await openConfirm(fmt(t("confirm.deleteAccount", "¿Eliminar la cuenta {address}? Esta acción no se puede deshacer."), { address }), { title: t("confirm.deleteAccountTitle", "Eliminar cuenta"), variant: "danger" })) return;
  const res = await api.delete(`/api/accounts/${id}`);
  if (res.ok) {
    if (getStoredDefaultAccountId() === id) {
      clearStoredDefaultAccountId();
    }
    showToast(t("toasts.accountDeleted", "Cuenta eliminada"));
    await awaitMailJob(res);
    await loadAccounts();
  } else {
    showToast(t("errors.deleteFailed", "Error al eliminar"), false);
  }
};

(window as any).openEditDialog = async (id: number) => {
  const account = S.accounts.find((a) => a.id === id);
  if (!account) {
    showToast(t("errors.accountNotFound", "No se encontró la cuenta"), false);
    return;
  }

  S.editAccountId = id;
  const { localPart, domain } = parseLocalAndDomain(account.address);
  S.editAccountDomain = domain;

  (document.getElementById("edit-local-part") as HTMLInputElement).value = localPart;
  (document.getElementById("edit-domain") as HTMLInputElement).value = domain;
  setCheckedRadioValue("edit-incoming-mode", account.incomingMode ?? "allow");
  setCheckedRadioValue("edit-outgoing-mode", account.outgoingMode ?? "allow");
  setCheckedRadioValue("edit-login-mode", account.loginMode ?? "allow");
  setCheckedRadioValue("edit-plus-autofolder", account.plusAddressingAutoFolder === false ? "no" : "yes");
  document.getElementById("edit-account-original")!.textContent = fmt(t("labels.currentAccountColon", "Cuenta actual: {address}"), { address: account.address });
  document.getElementById("edit-error")!.classList.add("hidden");
  document.getElementById("edit-forwards-list")!.innerHTML = "";

  const forwardsRes = await api.get<MailForward[]>(`/api/accounts/${id}/forwards`);
  if (forwardsRes.ok) {
    const fwds = Array.isArray(forwardsRes.data) ? forwardsRes.data : [];
    if (fwds.length === 0) {
      addForwardRow("edit");
    } else {
      fwds.forEach((f) => addForwardRow("edit", f));
    }
  } else {
    addForwardRow("edit");
  }

  openDialog("dialog-edit");
};

const closeCreateDialog = () => (document.getElementById("dialog-create") as HTMLDialogElement).close();

document.getElementById("btn-new-account")?.addEventListener("click", async () => {
  if (S.domains.length === 0) {
    await loadDomains();
  }
  (document.getElementById("new-forwards-list") as HTMLElement).innerHTML = "";
  addForwardRow("new");
  openDialog("dialog-create");
});

document.getElementById("dialog-close")?.addEventListener("click", closeCreateDialog);

document.getElementById("dialog-cancel")?.addEventListener("click", closeCreateDialog);

(document.getElementById("dialog-toggle-loading") as HTMLDialogElement | null)?.addEventListener("cancel", (event) => {
  event.preventDefault();
});

document.getElementById("toggle-new-pass")?.addEventListener("click", () => {
  const input = document.getElementById("new-password") as HTMLInputElement;
  const icon = document.getElementById("new-pass-icon")!;
  if (input.type === "password") {
    input.type = "text";
    icon.className = "ti ti-eye-off text-base";
  } else {
    input.type = "password";
    icon.className = "ti ti-eye text-base";
  }
});

document.getElementById("new-add-forward")?.addEventListener("click", () => addForwardRow("new"));

document.getElementById("edit-add-forward")?.addEventListener("click", () => addForwardRow("edit"));

document.getElementById("form-create")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById("btn-create-submit") as HTMLButtonElement;
  const btnText = document.getElementById("create-btn-text")!;
  const btnSpinner = document.getElementById("create-btn-spinner")!;
  const errEl = document.getElementById("create-error")!;

  submitBtn.disabled = true;
  btnText.classList.add("hidden");
  btnSpinner.classList.remove("hidden");
  errEl.classList.add("hidden");

  const localPart = (document.getElementById("new-local-part") as HTMLInputElement).value.trim().toLowerCase();
  const domain = (document.getElementById("new-domain") as HTMLSelectElement).value.trim().toLowerCase();
  const password = (document.getElementById("new-password") as HTMLInputElement).value;
  const quotaMb = Number((document.getElementById("new-quota") as HTMLInputElement).value);
  const enabled = (document.getElementById("new-enabled") as HTMLInputElement).checked;
  const forwards = collectForwards("new");

  if (!LOCAL_PART_RE.test(localPart)) {
    errEl.textContent = t("errors.localPartInvalidNoPoint", "El usuario antes de @ tiene un formato inválido");
    errEl.classList.remove("hidden");
    submitBtn.disabled = false;
    btnText.classList.remove("hidden");
    btnSpinner.classList.add("hidden");
    return;
  }

  if (!domain) {
    errEl.textContent = t("errors.mustSelectDomainNoPoint", "Debes seleccionar un dominio");
    errEl.classList.remove("hidden");
    submitBtn.disabled = false;
    btnText.classList.remove("hidden");
    btnSpinner.classList.add("hidden");
    return;
  }

  const res = await api.post("/api/accounts", { localPart, domain, password, quotaMb, enabled, forwards });

  if (res.ok) {
    closeCreateDialog();
    showToast(t("toasts.accountCreated", "Cuenta creada correctamente"));
    (document.getElementById("form-create") as HTMLFormElement).reset();
    (document.getElementById("new-forwards-list") as HTMLElement).innerHTML = "";
    await awaitMailJob(res);
    loadAccounts();
  } else {
    errEl.textContent = res.error ?? t("errors.accountCreateFailed", "Error al crear la cuenta");
    errEl.classList.remove("hidden");
  }

  submitBtn.disabled = false;
  btnText.classList.remove("hidden");
  btnSpinner.classList.add("hidden");
});

const closeEditDialog = () => (document.getElementById("dialog-edit") as HTMLDialogElement).close();

document.getElementById("edit-dialog-close")?.addEventListener("click", closeEditDialog);

document.getElementById("edit-cancel")?.addEventListener("click", closeEditDialog);

document.getElementById("form-edit")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!S.editAccountId) return;

  const errEl = document.getElementById("edit-error")!;
  errEl.classList.add("hidden");

  const localPart = (document.getElementById("edit-local-part") as HTMLInputElement).value.trim().toLowerCase();
  const incomingMode = getCheckedRadioValue("edit-incoming-mode") as "allow" | "suspend";
  const outgoingMode = getCheckedRadioValue("edit-outgoing-mode") as "allow" | "suspend" | "hold";
  const loginMode = getCheckedRadioValue("edit-login-mode") as "allow" | "suspend";
  const plusAddressingAutoFolder = getCheckedRadioValue("edit-plus-autofolder") !== "no";
  const forwards = collectForwards("edit");

  if (!LOCAL_PART_RE.test(localPart)) {
    errEl.textContent = t("errors.localPartInvalidNoPoint", "El usuario antes de @ tiene un formato inválido");
    errEl.classList.remove("hidden");
    return;
  }

  const updateRes = await api.put(`/api/accounts/${S.editAccountId}`, {
    localPart,
    incomingMode,
    outgoingMode,
    loginMode,
    plusAddressingAutoFolder,
  });
  if (!updateRes.ok) {
    errEl.textContent = updateRes.error ?? t("errors.accountUpdateFailed", "Error al actualizar la cuenta");
    errEl.classList.remove("hidden");
    return;
  }

  const nextAccountId = fnv1aId(`${localPart}@${S.editAccountDomain}`.toLowerCase());
  const forwardsRes = await api.put(`/api/accounts/${nextAccountId}/forwards`, { forwards });
  if (!forwardsRes.ok) {
    errEl.textContent = forwardsRes.error ?? t("errors.accountUpdatedForwardsFailed", "La cuenta se actualizó, pero falló la actualización de redirecciones");
    errEl.classList.remove("hidden");
    return;
  }

  showToast(fmt(t("toasts.accountUpdated", "Cuenta actualizada ({localPart}@{domain})"), { localPart, domain: S.editAccountDomain }));
  closeEditDialog();
  await awaitMailJob(updateRes);
  loadAccounts();
});

document.getElementById("pass-dialog-close")?.addEventListener("click", () => {
  (document.getElementById("dialog-password") as HTMLDialogElement).close();
});

document.getElementById("pass-cancel")?.addEventListener("click", () => {
  (document.getElementById("dialog-password") as HTMLDialogElement).close();
});

document.getElementById("form-password")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = (document.getElementById("change-password") as HTMLInputElement).value;
  const errEl = document.getElementById("pass-error")!;
  errEl.classList.add("hidden");

  const res = await api.put(`/api/accounts/${S.editAccountId}`, { password });
  if (res.ok) {
    (document.getElementById("dialog-password") as HTMLDialogElement).close();
    showToast(t("toasts.passwordUpdated", "Contraseña actualizada"));
  } else {
    errEl.textContent = res.error ?? t("errors.passwordChangeFailed", "Error al cambiar la contraseña");
    errEl.classList.remove("hidden");
  }
});
