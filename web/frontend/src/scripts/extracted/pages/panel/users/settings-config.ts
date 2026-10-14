// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Users module — configuration drawer wiring.
 *
 * Usuarios / Roles control each DataTable's user prefs: page size + which row
 * actions are visible. Resumen / Accesos read the current server's permitted
 * users, groups and live login presence without changing server policy.
 * Table preferences are persisted per table via the shared
 * DataTable prefs contract (localStorage `lxp:data-table:prefs:<tableId>` +
 * window event `lxp:data-table:apply-prefs`), which the generic DataTable reads
 * and applies. Self-registers on `astro:page-load` (SPA-safe) and immediately.
 */

import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { csvDocument, summarizeVisibleUsers, type UserSession, type VisibleUser } from "./settings-insights";
import { loadI18n, t, fmt } from "./dom";

const m = (key: string, fallback: string) => t(`settingsUi.dynamic.${key}`, fallback);
const localDate = (value: string | number) => new Date(value).toLocaleString(document.documentElement.lang || undefined);

interface VisibleRole {
  name: string;
  kind?: string;
  description?: string | null;
  members?: string[];
  modules?: string[];
}

let visibleUsers: VisibleUser[] | null = null;
let visibleRoles: VisibleRole[] | null = null;
let sessions: Record<string, UserSession> = {};
let sessionsAvailable = false;
let insightsLoaded = false;
let insightsFetchedAt = 0;
let insightsInFlight: Promise<void> | null = null;
let insightsGeneration = 0;

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setExportEnabled(id: string, enabled: boolean): void {
  const button = document.getElementById(id) as HTMLButtonElement | null;
  if (button) button.disabled = !enabled;
}

function listFromResponse<T>(value: unknown): T[] | null {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "items" in value && Array.isArray(value.items)) return value.items as T[];
  return null;
}

function renderInsights(): void {
  setText("users-summary-roles", visibleRoles ? String(visibleRoles.length) : "—");
  setExportEnabled("users-settings-export-roles", visibleRoles !== null);
  if (!visibleUsers) {
    for (const id of ["users-summary-total", "users-summary-locked", "users-summary-connections"]) setText(id, "—");
    setExportEnabled("users-settings-export-users", false);
    document.getElementById("users-access-list")?.replaceChildren();
    return;
  }
  const summary = summarizeVisibleUsers(visibleUsers, sessions);
  setText("users-summary-total", String(summary.users));
  setText("users-summary-locked", String(summary.locked));
  setText("users-summary-connections", sessionsAvailable ? String(summary.connections) : "—");
  setExportEnabled("users-settings-export-users", true);

  const list = document.getElementById("users-access-list");
  if (!list) return;
  list.replaceChildren();
  if (!sessionsAvailable) return;
  if (summary.recent.length === 0) {
    const empty = document.createElement("p");
    empty.className = "rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground";
    empty.textContent = m("noSessions", "No hay sesiones interactivas ni accesos SSH recientes disponibles para estas cuentas.");
    list.append(empty);
    return;
  }
  for (const row of summary.recent.slice(0, 25)) {
    const card = document.createElement("div");
    card.className = "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5";
    const name = document.createElement("strong");
    name.className = "text-sm font-medium";
    name.textContent = row.username;
    const details = document.createElement("span");
    details.className = "text-xs text-muted-foreground";
    details.textContent = row.online
      ? fmt(m("onlineDetails", "{count} {connections} · Último acceso: {time}"), { count: row.connections, connections: row.connections === 1 ? m("oneConnection", "conexión interactiva") : m("manyConnections", "conexiones interactivas"), time: row.lastLogin ? localDate(row.lastLogin) : m("noRecord", "sin registro") })
      : fmt(m("lastSshLogin", "Último acceso SSH: {time}"), { time: row.lastLogin ? localDate(row.lastLogin) : m("noRecord", "sin registro") });
    card.append(name, details);
    list.append(card);
  }
  if (summary.recent.length > 25) {
    const note = document.createElement("p");
    note.className = "text-xs text-muted-foreground";
    note.textContent = fmt(m("recentShown", "Se muestran los 25 accesos más recientes de {total}."), { total: summary.recent.length });
    list.append(note);
  }
}

async function loadInsights(force = false): Promise<void> {
  if (insightsInFlight) return insightsInFlight;
  if (!force && insightsFetchedAt && Date.now() - insightsFetchedAt < 30_000) {
    renderInsights();
    const updated = localDate(insightsFetchedAt);
    setText("users-summary-status", insightsLoaded ? fmt(m("updated", "Actualizado {time}."), { time: updated }) : m("summaryError", "No se pudieron consultar cuentas ni grupos de este servidor."));
    setText("users-access-status", visibleUsers === null
      ? m("accountsError", "No se pudieron consultar las cuentas permitidas.")
      : sessionsAvailable ? fmt(m("updatedVisible", "Actualizado {time}. Solo se muestran cuentas visibles para tu sesión."), { time: updated }) : m("liveError", "No se pudo consultar la presencia en vivo. Vuelve a intentarlo."));
    return;
  }
  const generation = ++insightsGeneration;
  setExportEnabled("users-settings-export-users", false);
  setExportEnabled("users-settings-export-roles", false);
  setText("users-summary-status", m("loadingAccounts", "Consultando cuentas y grupos…"));
  setText("users-access-status", m("loadingAccess", "Consultando accesos…"));
  const activePromise = (async () => {
    const [usersResult, rolesResult, sessionsResult] = await Promise.all([
      api.get<VisibleUser[]>("/api/users"),
      api.get<VisibleRole[]>("/api/roles"),
      api.get<Record<string, UserSession>>("/api/users/sessions"),
    ]);
    if (generation !== insightsGeneration || !document.getElementById("users-settings-modal")) return;
    visibleUsers = usersResult.ok ? listFromResponse<VisibleUser>(usersResult.data) : null;
    visibleRoles = rolesResult.ok ? listFromResponse<VisibleRole>(rolesResult.data) : null;
    sessionsAvailable = Boolean(visibleUsers && sessionsResult.ok && sessionsResult.data && typeof sessionsResult.data === "object" && !Array.isArray(sessionsResult.data));
    sessions = sessionsAvailable
      ? sessionsResult.data as Record<string, UserSession> : {};
    insightsLoaded = visibleUsers !== null || visibleRoles !== null;
    insightsFetchedAt = Date.now();
    renderInsights();
    const updated = localDate(Date.now());
    setText("users-summary-status", insightsLoaded
      ? `${fmt(m("updated", "Actualizado {time}."), { time: updated })}${visibleUsers === null ? m("accountsUnavailable", " Las cuentas no están disponibles para esta sesión.") : ""}${visibleRoles === null ? m("groupsUnavailable", " Los grupos no están disponibles para esta sesión.") : ""}`
      : usersResult.error || rolesResult.error || m("summaryError", "No se pudieron consultar cuentas ni grupos de este servidor."));
    setText("users-access-status", visibleUsers === null
      ? m("accountsError", "No se pudieron consultar las cuentas permitidas.")
      : sessionsAvailable
        ? fmt(m("updatedVisible", "Actualizado {time}. Solo se muestran cuentas visibles para tu sesión."), { time: updated })
        : m("liveError", "No se pudo consultar la presencia en vivo. Vuelve a intentarlo."));
  })().finally(() => { if (insightsInFlight === activePromise) insightsInFlight = null; });
  insightsInFlight = activePromise;
  return insightsInFlight;
}

function downloadCsv(kind: "users" | "roles"): void {
  const rows: unknown[][] = kind === "users"
    ? [
      ["usuario", "nombre", "correo", "contraseña_linux_disponible", "uid", "gid", "directorio", "shell", "grupos", "modulos", "conexiones_interactivas", "ultimo_acceso_ssh_utc"],
      ...(visibleUsers ?? []).map((user) => [
        user.username, user.displayName, user.email, user.enabled === true ? "si" : user.enabled === false ? "no" : "desconocido",
        user.systemUid, user.systemGid, user.homeDir, user.shell, (user.groups ?? []).join("; "), (user.modules ?? []).join("; "),
        sessionsAvailable ? sessions[user.username]?.online ? sessions[user.username]?.connections ?? 0 : 0 : "",
        sessionsAvailable ? sessions[user.username]?.lastLogin ?? "" : "",
      ]),
    ]
    : [
      ["grupo", "tipo", "descripcion", "miembros", "modulos"],
      ...(visibleRoles ?? []).map((role) => [role.name, role.kind, role.description, (role.members ?? []).join("; "), (role.modules ?? []).join("; ")]),
    ];
  if (kind === "users" && !visibleUsers || kind === "roles" && !visibleRoles) return;
  const url = URL.createObjectURL(new Blob([csvDocument(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${kind === "users" ? "usuarios" : "grupos"}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface TablePrefs {
  pageSize: number;
  hiddenActions: string[];
}

function readPrefs(tableId: string): TablePrefs {
  try {
    const raw = window.localStorage.getItem(`lxp:data-table:prefs:${tableId}`);
    if (raw) {
      const cfg = JSON.parse(raw) as Partial<TablePrefs>;
      return {
        pageSize: Number(cfg.pageSize) > 0 ? Number(cfg.pageSize) : 25,
        hiddenActions: Array.isArray(cfg.hiddenActions) ? cfg.hiddenActions.map(String) : [],
      };
    }
  } catch {
    /* storage unavailable */
  }
  return { pageSize: 25, hiddenActions: [] };
}

function writePrefs(tableId: string, cfg: TablePrefs): void {
  try {
    window.localStorage.setItem(`lxp:data-table:prefs:${tableId}`, JSON.stringify(cfg));
  } catch {
    /* noop */
  }
  window.dispatchEvent(
    new CustomEvent("lxp:data-table:apply-prefs", { detail: { tableId, pageSize: cfg.pageSize, hiddenActions: cfg.hiddenActions } }),
  );
}

function reflect(): void {
  document.querySelectorAll<HTMLElement>("[data-users-settings-view]").forEach((view) => {
    const tableId = view.getAttribute("data-users-table");
    if (!tableId) return;
    const cfg = readPrefs(tableId);
    view.querySelectorAll<HTMLButtonElement>("[data-users-pagesize]").forEach((btn) => {
      const on = Number(btn.getAttribute("data-users-pagesize")) === cfg.pageSize;
      btn.classList.toggle("bg-primary", on);
      btn.classList.toggle("text-primary-foreground", on);
      btn.classList.toggle("border-primary", on);
    });
    view.querySelectorAll<HTMLInputElement>("[data-users-action-toggle]").forEach((cb) => {
      const id = cb.getAttribute("data-users-action-toggle") ?? "";
      cb.checked = !cfg.hiddenActions.includes(id);
    });
  });
}

function activateNav(viewId: string): void {
  document.querySelectorAll<HTMLElement>("[data-users-settings-nav]").forEach((btn) => {
    const on = btn.getAttribute("data-users-settings-nav") === viewId;
    btn.setAttribute("aria-selected", String(on));
    btn.classList.toggle("bg-primary/10", on);
    btn.classList.toggle("text-primary", on);
    btn.classList.toggle("text-muted-foreground", !on);
  });
  document.querySelectorAll<HTMLElement>("[data-users-settings-view]").forEach((section) => {
    section.classList.toggle("hidden", section.getAttribute("data-users-settings-view") !== viewId);
  });
  if (viewId === "summary" || viewId === "access") void loadInsights();
}

function wire(): void {
  loadI18n();
  document.querySelectorAll<HTMLButtonElement>("[data-users-settings-nav]").forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => activateNav(btn.getAttribute("data-users-settings-nav") ?? ""));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-users-pagesize]").forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      const view = btn.closest<HTMLElement>("[data-users-settings-view]");
      const tableId = view?.getAttribute("data-users-table");
      if (!tableId) return;
      const cfg = readPrefs(tableId);
      cfg.pageSize = Number(btn.getAttribute("data-users-pagesize")) || 25;
      writePrefs(tableId, cfg);
      reflect();
    });
  });
  document.querySelectorAll<HTMLInputElement>("[data-users-action-toggle]").forEach((cb) => {
    if (cb.dataset.wired) return;
    cb.dataset.wired = "1";
    cb.addEventListener("change", () => {
      const view = cb.closest<HTMLElement>("[data-users-settings-view]");
      const tableId = view?.getAttribute("data-users-table");
      if (!tableId) return;
      const id = cb.getAttribute("data-users-action-toggle") ?? "";
      const cfg = readPrefs(tableId);
      const set = new Set(cfg.hiddenActions);
      if (cb.checked) set.delete(id);
      else set.add(id);
      cfg.hiddenActions = [...set];
      writePrefs(tableId, cfg);
    });
  });
  const trigger = document.getElementById("users-settings-modal-trigger");
  if (trigger && !trigger.dataset.reflectWired) {
    trigger.dataset.reflectWired = "1";
    trigger.addEventListener("click", () => {
      window.setTimeout(reflect, 50);
      const active = document.querySelector<HTMLElement>('[data-users-settings-nav][aria-selected="true"]')?.dataset.usersSettingsNav;
      if (active === "summary" || active === "access") void loadInsights();
    });
  }
  for (const id of ["users-settings-refresh", "users-access-refresh"]) {
    const button = document.getElementById(id);
    if (button && !button.dataset.wired) {
      button.dataset.wired = "1";
      button.addEventListener("click", () => void loadInsights(true));
    }
  }
  for (const kind of ["users", "roles"] as const) {
    const button = document.getElementById(`users-settings-export-${kind}`);
    if (button && !button.dataset.wired) {
      button.dataset.wired = "1";
      button.addEventListener("click", () => downloadCsv(kind));
    }
  }
  reflect();
}

document.addEventListener("astro:page-load", wire);
window.addEventListener("luxipanel:target-changed", () => {
  insightsGeneration++;
  insightsInFlight = null;
  visibleUsers = null;
  visibleRoles = null;
  sessions = {};
  sessionsAvailable = false;
  insightsLoaded = false;
  insightsFetchedAt = 0;
  setExportEnabled("users-settings-export-users", false);
  setExportEnabled("users-settings-export-roles", false);
  for (const id of ["users-summary-total", "users-summary-locked", "users-summary-connections", "users-summary-roles"]) setText(id, "—");
  document.getElementById("users-access-list")?.replaceChildren();
  setText("users-summary-status", m("serverChangedSummary", "Servidor cambiado. Actualiza para consultar las cuentas."));
  setText("users-access-status", m("serverChangedAccess", "Servidor cambiado. Comprueba los accesos."));
  const active = document.querySelector<HTMLElement>('[data-users-settings-nav][aria-selected="true"]')?.dataset.usersSettingsNav;
  if (active === "summary" || active === "access") window.setTimeout(() => void loadInsights(), 0);
});
if (document.readyState !== "loading") wire();
else document.addEventListener("DOMContentLoaded", wire);
