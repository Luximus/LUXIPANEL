import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Cloudflare page — DNS records (list / render / dialog / save / delete).
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { confirmMutateReload } from "/scripts/extracted/lib/crud.js";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { state, CF_DNS_TABLE_ID } from "./state";
import type { DnsRecord, DnsListResult } from "./state";
import { t, fmt, esc, showToast, $ } from "./dom";
import { publishRows } from "./table-bridge";
import { pendingDeepLink, clearDeepLink, maybeOpenDnsDeepLinkDialog } from "./deep-links";
const dnsPages = createTablePages({ tableId: CF_DNS_TABLE_ID, events: window, scope: resolveTargetScope, reload: () => loadDns(), field: "auto", aliases: {proxy:"proxied", ttlNum:"ttl", server:"pointsToServer"}, values: () => ({proxy: {[t("dns.proxyOn", "Proxy")]:"true",[t("dns.proxyOff", "Directo")]:"false"},server:{[t("dns.pointsToServer", "Apunta a este servidor")]:"true"}}) });

/** DNS record types whose dialog shows the priority field. */
export const PRIORITY_TYPES = new Set(["MX"]);

// ── DNS records ──────────────────────────────────────────────────────────────
export async function loadDns() {
  if (!state.zoneId) return;
  const zid = state.zoneId;
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_LOADING, { detail: { tableId: CF_DNS_TABLE_ID, loading: true } }));
  const res = await dnsPages.read<DnsListResult>(params => api.get<DnsListResult>(`/api/cloudflare/zones/${encodeURIComponent(zid)}/dns`, {params}), zid);
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (state.zoneId !== zid) return; // la zona cambió mientras respondía: descartar
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    state.records = [];
    renderDns();
    if (pendingDeepLink?.domain) clearDeepLink(); // no abrir un dialog tardío tras error
    return;
  }
  state.records = res.data?.records ?? [];
  if (res.data?.serverIp) {
    state.serverIp = res.data.serverIp;
    const ipEl = $("cf-server-ip-val");
    if (ipEl) ipEl.textContent = state.serverIp;
  }
  renderDns();
  if (pendingDeepLink?.domain && pendingDeepLink.zoneMatched) {
    pendingDeepLink.recordsReady = true;
    if (state.serverIp != null) pendingDeepLink.ipReady = true; // /dns ya trajo la IP
    maybeOpenDnsDeepLinkDialog();
  }
}

// Mapea los registros DNS a filas del DataTable. El texto de la celda Proxy /
// "Apunta a este servidor" se localiza aquí con las MISMAS claves que el
// table-config para que los valueBadges casen. `_id` viaja para las acciones.
export function renderDns() {
  const proxyOn = t("dns.proxyOn", "Proxy");
  const proxyOff = t("dns.proxyOff", "Directo");
  const serverYes = t("dns.pointsToServer", "Apunta a este servidor");
  const rows = state.records.map((r) => ({
    id: r.id || r.name,
    type: r.type,
    name: r.name,
    content: r.content,
    proxy: r.proxied ? proxyOn : proxyOff,
    ttl: r.ttl === 1 ? "Auto" : String(r.ttl),
    ttlNum: r.ttl,
    server: r.pointsToServer ? serverYes : "",
    _id: r.id,
  }));
  publishRows(CF_DNS_TABLE_ID, rows);
}

export function updateDnsPriorityVisibility() {
  const type = ($("cf-dns-type") as HTMLSelectElement | null)?.value ?? "A";
  $("cf-dns-priority-wrap")?.classList.toggle("hidden", !PRIORITY_TYPES.has(type));
}

export function openDnsDialog(mode: "create" | "edit", record?: DnsRecord) {
  const dlg = $("dlg-cf-dns") as HTMLDialogElement | null;
  if (!dlg) return;
  state.dnsMode = mode;
  state.dnsEditId = mode === "edit" ? record?.id ?? null : null;

  const title = $("cf-dns-title");
  if (title) title.textContent = mode === "edit" ? t("dns.edit", "Editar") : t("dns.add", "Añadir registro");

  const typeSel = $("cf-dns-type") as HTMLSelectElement | null;
  const nameInput = $("cf-dns-name") as HTMLInputElement | null;
  const contentInput = $("cf-dns-content") as HTMLInputElement | null;
  const ttlSel = $("cf-dns-ttl") as HTMLSelectElement | null;
  const proxiedCb = $("cf-dns-proxied") as HTMLInputElement | null;
  const priorityInput = $("cf-dns-priority") as HTMLInputElement | null;

  if (typeSel) typeSel.value = record?.type ?? "A";
  if (nameInput) nameInput.value = record?.name ?? "";
  if (contentInput) contentInput.value = record?.content ?? "";
  if (ttlSel) {
    const ttl = String(record?.ttl ?? 1);
    ttlSel.value = Array.from(ttlSel.options).some((o) => o.value === ttl) ? ttl : "1";
  }
  if (proxiedCb) proxiedCb.checked = record?.proxied ?? false;
  if (priorityInput) priorityInput.value = String(record?.priority ?? 10);
  updateDnsPriorityVisibility();

  const ipEl = $("cf-server-ip-val");
  if (ipEl) ipEl.textContent = state.serverIp ?? "—";

  if (!dlg.open) dlg.showModal();
}

export async function saveDnsRecord() {
  if (!state.zoneId) return;
  const type = ($("cf-dns-type") as HTMLSelectElement | null)?.value ?? "A";
  const name = ($("cf-dns-name") as HTMLInputElement | null)?.value.trim() ?? "";
  const content = ($("cf-dns-content") as HTMLInputElement | null)?.value.trim() ?? "";
  const ttl = Number(($("cf-dns-ttl") as HTMLSelectElement | null)?.value ?? "1");
  const proxied = ($("cf-dns-proxied") as HTMLInputElement | null)?.checked ?? false;
  if (!name || !content) return;
  const body: Record<string, unknown> = { type, name, content, ttl, proxied };
  if (PRIORITY_TYPES.has(type)) {
    const priority = Number(($("cf-dns-priority") as HTMLInputElement | null)?.value ?? "10");
    if (Number.isFinite(priority)) body.priority = priority;
  }
  const saveBtn = $("cf-dns-save") as HTMLButtonElement | null;
  if (saveBtn) saveBtn.disabled = true;
  const zone = encodeURIComponent(state.zoneId);
  const res =
    state.dnsMode === "edit" && state.dnsEditId
      ? await api.patch(`/api/cloudflare/zones/${zone}/dns/${encodeURIComponent(state.dnsEditId)}`, body)
      : await api.post(`/api/cloudflare/zones/${zone}/dns`, body);
  if (saveBtn) saveBtn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  ($("dlg-cf-dns") as HTMLDialogElement | null)?.close();
  showToast(t("dns.saved", "Registro guardado"));
  void loadDns();
}

// E-04: "confirmar → mutar → toast → awaitJob → recargar" vía el helper compartido.
export async function deleteDnsRecord(record: DnsRecord) {
  if (!state.zoneId) return;
  const zoneId = state.zoneId;
  await confirmMutateReload({
    confirm: {
      message: fmt(t("dns.confirmDelete", "¿Eliminar el registro {name}?"), { name: record.name }),
      options: { title: t("dns.confirmDeleteTitle", "Eliminar registro"), confirmText: t("common.delete", "Eliminar"), variant: "danger" },
    },
    request: () => api.delete(`/api/cloudflare/zones/${encodeURIComponent(zoneId)}/dns/${encodeURIComponent(record.id)}`),
    toast: showToast,
    success: t("dns.deleted", "Registro eliminado"),
    error: (res) => res.error ?? t("common.error", "Error"),
    reload: () => { void loadDns(); },
  });
}
