import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Settings → Servidores tab. The single SSH target vault CRUD + TOFU flow,
// ported from the retired /panel/servers page. Lazy-loads when the tab becomes
// visible (like modules-cache.ts) so entering /panel/settings on another tab
// doesn't fetch. All mutations hit /api/servers (per-user authorization is
// enforced server-side).
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { DATATABLE_EVENTS, createTableFeed } from "/scripts/extracted/lib/datatable-events.js";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { showToast as showSharedToast } from "/scripts/extracted/lib/toast.js";
// `ServerTarget` lives in the SSOT `lib/server-target.types` (union/superset
// shared with layouts/server-switcher). Type-only import → erased at build.
import type { ServerTarget } from "@/scripts/extracted/lib/server-target.types";
const serverPages = createTablePages({ tableId: "servers-table", events: window, scope: resolveTargetScope, reload: () => loadServers(), field: "auto",aliases:{host:"serverHost",authType:"serverAuth",status:"serverStatus"},values:()=>({authType:{[t("authTypes.password","Contraseña")]:"password",[t("authTypes.key","Clave SSH")]:"key"},status:{[t("status.approved","Aprobado")]:"approved",[t("status.pending","Pendiente")]:"pending",[t("status.untested","Sin probar")]:"untested"}}) });
// All /api/servers calls in this file MUST match lib/api-routes.ts SERVERS_PATH
// (this entry is bundle:false and only resolves runtime-URL shared libs, so it
// keeps the literal; api-routes.ts is not emitted as a runtime lib entry).

// ── i18n ─────────────────────────────────────────────────────────────────────
const { loadI18n, t, fmt } = createPageI18n("servers-i18n");

// ── Types (mirror TargetView, no secrets) ────────────────────────────────────
type AuthType = "key" | "password";

const state = {
  servers: [] as ServerTarget[],
  editingId: null as string | null,
  fingerprintServerId: null as string | null,
};

// ── DataTable feed (cache + ready handshake) ─────────────────────────────────
const TABLE_ID = "servers-table";
const feed = createTableFeed([TABLE_ID]);

function publishRows(rows: Record<string, unknown>[]) {
  feed.publish(TABLE_ID, rows);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function $(id: string) {
  return document.getElementById(id);
}
function showToast(msg: string, ok = true) {
  showSharedToast(msg, ok, { ids: { toast: "servers-toast", msg: "servers-toast-msg" } });
}
function authTypeOf(srv: ServerTarget): AuthType {
  return srv.authType === "password" ? "password" : "key";
}
function authTypeLabel(srv: ServerTarget): string {
  return authTypeOf(srv) === "password" ? t("authTypes.password", "Contraseña") : t("authTypes.key", "Clave SSH");
}
function statusLabel(srv: ServerTarget): string {
  if (srv.hostFingerprint) return t("status.approved", "Aprobado");
  if (srv.hostFingerprintPending) return t("status.pending", "Pendiente");
  return t("status.untested", "Sin probar");
}
function hostCell(srv: ServerTarget): string {
  const host = (srv.host ?? "").toString().trim();
  if (!host) return "—";
  return srv.port ? `${host}:${srv.port}` : host;
}

function renderRows() {
  const rows = state.servers.map((srv) => ({
    id: srv.id,
    name: srv.name ?? srv.id,
    host: hostCell(srv),
    username: srv.username ?? "—",
    authType: authTypeLabel(srv),
    status: statusLabel(srv),
    _id: srv.id,
  }));
  publishRows(rows);
}

async function loadServers() {
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_LOADING, { detail: { tableId: TABLE_ID, loading: true } }));
  const res = await serverPages.read<ServerTarget[]>(params => api.get<ServerTarget[]>("/api/servers", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    publishRows([]);
    return;
  }
  const data = res.data as unknown;
  state.servers = Array.isArray(data) ? (data as ServerTarget[]) : [];
  renderRows();
}

// ── New / edit dialog ────────────────────────────────────────────────────────
function applyAuthTypeUI(authType: AuthType) {
  $("srv-key-wrap")?.classList.toggle("hidden", authType !== "key");
  $("srv-password-wrap")?.classList.toggle("hidden", authType !== "password");
}

function openServerDialog(srv?: ServerTarget) {
  const dlg = $("dlg-server") as HTMLDialogElement | null;
  if (!dlg) return;
  // `id` is `string | number` in the shared type; coerce (runtime ids are
  // strings) so it matches `editingId: string | null`.
  state.editingId = srv ? String(srv.id) : null;
  const isEdit = Boolean(srv);
  const titleEl = $("srv-dialog-title");
  if (titleEl) titleEl.textContent = isEdit ? t("dialog.titleEdit", "Editar servidor") : t("dialog.titleNew", "Añadir servidor");

  const nameEl = $("srv-name") as HTMLInputElement | null;
  const hostEl = $("srv-host") as HTMLInputElement | null;
  const portEl = $("srv-port") as HTMLInputElement | null;
  const userEl = $("srv-username") as HTMLInputElement | null;
  const authEl = $("srv-authtype") as HTMLSelectElement | null;
  const keyEl = $("srv-secret-key") as HTMLTextAreaElement | null;
  const passEl = $("srv-passphrase") as HTMLInputElement | null;
  const pwEl = $("srv-secret-password") as HTMLInputElement | null;

  if (nameEl) nameEl.value = srv?.name ?? "";
  if (hostEl) hostEl.value = srv?.host ?? "";
  if (portEl) portEl.value = srv?.port ? String(srv.port) : "22";
  if (userEl) userEl.value = srv?.username ?? "";
  const authType = srv ? authTypeOf(srv) : "key";
  if (authEl) authEl.value = authType;
  if (keyEl) keyEl.value = "";
  if (passEl) passEl.value = "";
  if (pwEl) pwEl.value = "";
  applyAuthTypeUI(authType);

  // Panel-to-panel MCP fields.
  const hasLux = ($("srv-has-luxipanel") as HTMLInputElement | null);
  const luxUrl = ($("srv-luxipanel-url") as HTMLInputElement | null);
  if (hasLux) hasLux.checked = srv?.hasLuxipanel === true;
  if (luxUrl) luxUrl.value = srv?.luxipanelBaseUrl ?? "";
  $("srv-luxipanel-url-wrap")?.classList.toggle("hidden", !(srv?.hasLuxipanel === true));

  // En edición el secreto es opcional (se conserva si va vacío).
  $("srv-keep-hint")?.classList.toggle("hidden", !isEdit);
  hideError();
  if (!dlg.open) dlg.showModal();
}

function hideError() {
  $("srv-error")?.classList.add("hidden");
}
function showError(msg: string) {
  const el = $("srv-error");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

async function saveServer() {
  const name = ($("srv-name") as HTMLInputElement | null)?.value.trim() ?? "";
  const host = ($("srv-host") as HTMLInputElement | null)?.value.trim() ?? "";
  const username = ($("srv-username") as HTMLInputElement | null)?.value.trim() ?? "";
  const portRaw = ($("srv-port") as HTMLInputElement | null)?.value.trim() ?? "";
  const authType = (($("srv-authtype") as HTMLSelectElement | null)?.value ?? "key") as AuthType;

  if (!name) return showError(t("validation.nameRequired", "Indica un nombre"));
  if (!host) return showError(t("validation.hostRequired", "Indica el host"));
  if (!username) return showError(t("validation.usernameRequired", "Indica el usuario"));

  const body: Record<string, unknown> = { name, host, username, authType };
  const port = Number(portRaw);
  if (Number.isFinite(port) && port > 0) body.port = Math.trunc(port);

  // Panel-to-panel MCP flags.
  const hasLux = ($("srv-has-luxipanel") as HTMLInputElement | null)?.checked ?? false;
  body.hasLuxipanel = hasLux;
  const luxUrl = ($("srv-luxipanel-url") as HTMLInputElement | null)?.value.trim() ?? "";
  body.luxipanelBaseUrl = hasLux && luxUrl ? luxUrl : null;

  const isEdit = Boolean(state.editingId);
  if (authType === "key") {
    const secret = ($("srv-secret-key") as HTMLTextAreaElement | null)?.value ?? "";
    const passphrase = ($("srv-passphrase") as HTMLInputElement | null)?.value ?? "";
    if (secret.trim()) body.secret = secret;
    if (passphrase) body.passphrase = passphrase;
  } else {
    const secret = ($("srv-secret-password") as HTMLInputElement | null)?.value ?? "";
    if (secret) body.secret = secret;
  }
  // En alta el secreto es obligatorio; en edición es opcional.
  if (!isEdit && !body.secret) return showError(t("validation.secretRequired", "Indica el secreto de autenticación"));

  const submitBtn = document.querySelector<HTMLButtonElement>('#form-server button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  const res = isEdit
    ? await api.put(`/api/servers/${encodeURIComponent(state.editingId as string)}`, body)
    : await api.post("/api/servers", body);
  if (submitBtn) submitBtn.disabled = false;

  if (!res.ok) {
    showError(res.error ?? t("common.error", "Error"));
    return;
  }
  ($("dlg-server") as HTMLDialogElement | null)?.close();
  showToast(isEdit ? t("toasts.updated", "Servidor actualizado") : t("toasts.created", "Servidor añadido"));
  void loadServers();
}

// ── Test connection + fingerprint approval ───────────────────────────────────
function readFingerprint(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  const direct = obj.fingerprint ?? obj.hostFingerprint;
  if (typeof direct === "string") return direct;
  const nested = obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>).fingerprint : undefined;
  return typeof nested === "string" ? nested : "";
}

async function testServer(id: string) {
  const srv = state.servers.find((x) => x.id === id);
  showToast(t("testing", "Probando conexión..."));
  const res = await api.post(`/api/servers/${encodeURIComponent(id)}/test`);
  if (res.ok) {
    showToast(t("toasts.testOk", "Conexión correcta"));
    void loadServers();
    return;
  }
  // Primer contacto: huella del host pendiente de aprobación.
  const isFingerprint = res.status === 409 || String(res.error ?? "").includes("HOST_FINGERPRINT_PENDING_APPROVAL");
  if (isFingerprint) {
    const fp = readFingerprint(res.data) || readFingerprint(srv);
    openFingerprintDialog(id, fp);
    return;
  }
  showToast(res.error ?? t("toasts.testFailed", "Falló la conexión"), false);
}

function openFingerprintDialog(id: string, fingerprint: string) {
  state.fingerprintServerId = id;
  const dlg = $("dlg-fingerprint") as HTMLDialogElement | null;
  if (!dlg) return;
  const val = $("fp-value");
  if (val) val.textContent = fingerprint || "—";
  $("fp-error")?.classList.add("hidden");
  if (!dlg.open) dlg.showModal();
}

async function approveFingerprint() {
  const id = state.fingerprintServerId;
  if (!id) return;
  const btn = $("fp-approve") as HTMLButtonElement | null;
  const prev = btn?.textContent ?? "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = t("fingerprint.approving", "Aprobando...");
  }
  const res = await api.post(`/api/servers/${encodeURIComponent(id)}/fingerprint/approve`);
  if (btn) {
    btn.disabled = false;
    btn.textContent = prev;
  }
  if (!res.ok) {
    const el = $("fp-error");
    if (el) {
      el.textContent = res.error ?? t("fingerprint.approveError", "No se pudo aprobar la huella");
      el.classList.remove("hidden");
    }
    return;
  }
  ($("dlg-fingerprint") as HTMLDialogElement | null)?.close();
  showToast(t("fingerprint.approved", "Huella aprobada"));
  void loadServers();
}

async function pairServer(id: string) {
  const srv = state.servers.find((x) => x.id === id);
  if (!srv) return;
  if (!srv.hasLuxipanel) {
    showToast(t("pairNotLuxipanel", "Marca el servidor como 'corre LUXIPANEL' (editar) antes de emparejar."), false);
    return;
  }
  showToast(t("pairing", "Emparejando por SSH…"));
  const res = await api.post<{ verified?: boolean }>(`/api/ai/servers/${encodeURIComponent(id)}/pair`);
  if (!res.ok) {
    showToast(res.error ?? t("pairFailed", "No se pudo emparejar"), false);
    return;
  }
  // `api.post` already unwraps the `{ ok, data }` envelope → res.data = { verified }.
  const verified = (res.data as { verified?: boolean })?.verified;
  showToast(
    verified
      ? t("pairOkVerified", "Emparejado y verificado (MCP activo en el destino)")
      : t("pairOk", "Credencial provisionada. Activa PANEL_PEER_MCP_ENABLED en el destino para usar MCP."),
  );
  void loadServers();
}

async function deleteServer(id: string) {
  const srv = state.servers.find((x) => x.id === id);
  if (!srv) return;
  const label = srv.name ?? srv.host ?? id;
  const confirmed = await openConfirm(fmt(t("confirmDelete", "¿Eliminar el servidor {name}?"), { name: label }), {
    title: t("confirmDeleteTitle", "Eliminar servidor"),
    confirmText: t("common.delete", "Eliminar"),
    variant: "danger",
  });
  if (!confirmed) return;
  const res = await api.delete(`/api/servers/${encodeURIComponent(id)}`);
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("toasts.deleted", "Servidor eliminado"));
  void loadServers();
}

// ── Bind static controls (delegated → survives SPA swaps) ────────────────────
function bindOnce() {
  if ((window as any).__lxpSettingsServersBound) return;
  (window as any).__lxpSettingsServersBound = true;

  document.addEventListener("click", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el) return;
    const btn = el.closest<HTMLButtonElement>("button[id]");
    if (!btn) return;
    switch (btn.id) {
      case "srv-new":
        openServerDialog();
        break;
      case "srv-cancel":
      case "srv-close":
        ($("dlg-server") as HTMLDialogElement | null)?.close();
        break;
      case "fp-cancel":
      case "fp-close":
        ($("dlg-fingerprint") as HTMLDialogElement | null)?.close();
        break;
      case "fp-approve":
        void approveFingerprint();
        break;
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target as HTMLElement | null;
    if (el?.id === "srv-authtype") {
      applyAuthTypeUI(((el as HTMLSelectElement).value as AuthType) === "password" ? "password" : "key");
    }
    if (el?.id === "srv-has-luxipanel") {
      $("srv-luxipanel-url-wrap")?.classList.toggle("hidden", !(el as HTMLInputElement).checked);
    }
  });

  document.addEventListener("submit", (e) => {
    const form = e.target as HTMLElement | null;
    if (form?.id === "form-server") {
      e.preventDefault();
      void saveServer();
    }
  });
}

// ── DataTable events (ready + row actions, gated by tableId) ─────────────────
let tableEventsBound = false;
function bindTableEvents() {
  if (tableEventsBound) return;
  tableEventsBound = true;

  feed.bindReady();

  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const detail = (event as CustomEvent<{ tableId?: string; actionId?: string; row?: Record<string, unknown> }>).detail;
    if (detail?.tableId !== TABLE_ID) return;
    const id = String(detail?.row?._id ?? "");
    if (!id) return;
    const srv = state.servers.find((x) => x.id === id);
    switch (detail?.actionId) {
      case "test":
        void testServer(id);
        break;
      case "pair":
        void pairServer(id);
        break;
      case "edit":
        if (srv) openServerDialog(srv);
        break;
      case "delete":
        void deleteServer(id);
        break;
    }
  });
}

// ── Lazy load gated on tab visibility (mirrors modules-cache.ts) ─────────────
let lastLoadedAt = 0;
let loadInFlight = false;

function isServersTabVisible(): boolean {
  const panel = $("panel-servers");
  return !!panel && !panel.classList.contains("hidden");
}

function maybeLoad(): void {
  if (!isServersTabVisible()) return;
  // Bind lazily on first activation so the delegated handlers + handshake exist.
  loadI18n();
  bindOnce();
  bindTableEvents();
  feed.requestReady();
  if (loadInFlight) return;
  if (state.servers.length && Date.now() - lastLoadedAt < SCRIPT_INIT_COOLDOWN_MS) return;
  lastLoadedAt = Date.now();
  loadInFlight = true;
  void loadServers().finally(() => {
    loadInFlight = false;
  });
}

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  const btn = target?.closest<HTMLButtonElement>('.tab-btn[data-tab="servers"]');
  if (btn) setTimeout(maybeLoad, 0);
});
// MUST match settings/tabs.ts SETTINGS_TAB_EVENT (bundle:false entry — keep the
// literal in lockstep; cannot import the sibling symbol).
window.addEventListener("lxp:settings-tab:activated", (event: Event) => {
  const ce = event as CustomEvent<{ tabId: string }>;
  if (ce.detail?.tabId === "servers") setTimeout(maybeLoad, 0);
});
document.addEventListener("astro:page-load", maybeLoad);
document.addEventListener("astro:after-swap", maybeLoad);
