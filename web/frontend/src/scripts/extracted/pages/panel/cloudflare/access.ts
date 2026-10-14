import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Cloudflare page — IP access rules (list / render / dialog / save / delete).
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { confirmMutateReload } from "/scripts/extracted/lib/crud.js";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { state, CF_ACCESS_TABLE_ID } from "./state";
import type { AccessRule } from "./state";
import { t, fmt, esc, showToast, $ } from "./dom";
import { publishRows } from "./table-bridge";
const accessPages = createTablePages({ tableId: CF_ACCESS_TABLE_ID, events: window, scope: resolveTargetScope, reload: () => loadAccessRules(), field: "auto", aliases: {ip:"value"}, values: () => ({mode:Object.fromEntries(["block","whitelist","challenge"].map(mode => [accessModeLabel(mode),mode]))}) });

export function accessModeLabel(mode: string): string {
  if (mode === "block") return t("access.block", "Bloquear");
  if (mode === "whitelist") return t("access.allow", "Permitir");
  if (mode === "challenge") return t("access.challenge", "Challenge");
  return mode;
}

// ── Access rules ─────────────────────────────────────────────────────────────
export async function loadAccessRules() {
  if (!state.zoneId) return;
  const zid = state.zoneId;
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_LOADING, { detail: { tableId: CF_ACCESS_TABLE_ID, loading: true } }));
  const res = await accessPages.read<AccessRule[]>(params => api.get<AccessRule[]>(`/api/cloudflare/zones/${encodeURIComponent(zid)}/access-rules`, {params}), zid);
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (state.zoneId !== zid) return; // la zona cambió mientras respondía: descartar
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    state.rules = [];
    renderAccessRules();
    return;
  }
  state.rules = res.data ?? [];
  renderAccessRules();
}

// Mapea las reglas de acceso a filas del DataTable. La celda `mode` lleva el
// texto localizado (whitelist/block/challenge) para que case con los
// valueBadges; `_id` viaja para la acción eliminar.
export function renderAccessRules() {
  const rows = state.rules.map((r) => ({
    id: r.id,
    mode: accessModeLabel(r.mode),
    ip: r.value,
    notes: r.notes || "",
    _id: r.id,
  }));
  publishRows(CF_ACCESS_TABLE_ID, rows);
}

export function openAccessDialog() {
  const dlg = $("dlg-cf-access") as HTMLDialogElement | null;
  if (!dlg) return;
  const modeSel = $("cf-access-mode") as HTMLSelectElement | null;
  const ipInput = $("cf-access-ip") as HTMLInputElement | null;
  const notesInput = $("cf-access-notes") as HTMLInputElement | null;
  if (modeSel) modeSel.value = "block";
  if (ipInput) ipInput.value = "";
  if (notesInput) notesInput.value = "";
  if (!dlg.open) dlg.showModal();
}

export async function saveAccessRule() {
  if (!state.zoneId) return;
  const mode = ($("cf-access-mode") as HTMLSelectElement | null)?.value ?? "block";
  const ip = ($("cf-access-ip") as HTMLInputElement | null)?.value.trim() ?? "";
  const notes = ($("cf-access-notes") as HTMLInputElement | null)?.value.trim() ?? "";
  if (!ip) return;
  const saveBtn = $("cf-access-save") as HTMLButtonElement | null;
  if (saveBtn) saveBtn.disabled = true;
  const res = await api.post(`/api/cloudflare/zones/${encodeURIComponent(state.zoneId)}/access-rules`, {
    mode,
    ip,
    ...(notes ? { notes } : {}),
  });
  if (saveBtn) saveBtn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  ($("dlg-cf-access") as HTMLDialogElement | null)?.close();
  showToast(t("access.created", "Regla creada"));
  void loadAccessRules();
}

// E-04: "confirmar → mutar → toast → awaitJob → recargar" vía el helper compartido.
export async function deleteAccessRule(rule: AccessRule) {
  if (!state.zoneId) return;
  const zoneId = state.zoneId;
  await confirmMutateReload({
    confirm: {
      message: fmt(t("access.confirmDelete", "¿Eliminar la regla para {ip}?"), { ip: rule.value }),
      options: { title: t("access.confirmDeleteTitle", "Eliminar regla"), confirmText: t("common.delete", "Eliminar"), variant: "danger" },
    },
    request: () => api.delete(`/api/cloudflare/zones/${encodeURIComponent(zoneId)}/access-rules/${encodeURIComponent(rule.id)}`),
    toast: showToast,
    success: t("access.deleted", "Regla eliminada"),
    error: (res) => res.error ?? t("common.error", "Error"),
    reload: () => { void loadAccessRules(); },
  });
}
