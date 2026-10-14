import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Users page — users list loader + the window.* user row actions
// (deleteUser / toggleBlockUser). Importing this module registers those globals.
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { confirmMutateReload } from "/scripts/extracted/lib/crud.js";
import { capabilities, currentUsername } from "./state";
import { t, fmt, showToast, formatDateTime, tsOf } from "./dom";
import { publishUsersRows } from "./table-bridge";
const userPages = createTablePages({ tableId: "users-main-table", events: window, scope: resolveTargetScope, reload: () => loadUsers(), field: "auto", rowKey: row => row.username, aliases: {groupsLabel:"groups", modulesLabel:"modules", createdAtTs:"createdAt", updatedAtTs:"updatedAt", linuxPasswordState:"enabled"}, values: () => ({linuxPasswordState:{[t("labels.statusAvailable", "Disponible")]:"true",[t("labels.statusLocked", "Bloqueado")]:"false"}}) });

type SessionMap = Record<string, { online?: boolean; connections?: number; lastLogin?: string | null }>;
let usersLoadGeneration = 0;
let previousPresence: SessionMap | null = null;
let presenceScope = "", presenceAt = 0;

export async function loadUsers(background = false) {
  const generation = ++usersLoadGeneration;
  if (!capabilities.usersView) return;
  const root = document.getElementById("panel-users");
  const scope = resolveTargetScope();
  const isCurrent = () => generation === usersLoadGeneration && capabilities.usersView
    && root === document.getElementById("panel-users") && scope === resolveTargetScope();
  // Presence reads live SSH/journal data. Start it alongside the list, but
  // publish the list immediately and enrich it when the slower read finishes.
  const usersRequest = userPages.read<any>(params => api.get<any>("/api/users", {params}));
  if (scope !== presenceScope) {previousPresence = null; presenceScope = scope; presenceAt = 0;}
  const fetchPresence = !background || Date.now() - presenceAt > 30_000;
  const presence = fetchPresence ? api.get<any>("/api/users/sessions").catch(() => null) : Promise.resolve({ok: true, data: previousPresence});
  const res = await usersRequest;
  if (!isCurrent()) return;
  if (!res.ok) return;
  const list = (res.data as any)?.items ?? res.data ?? [];
  const normalize = (sessions: SessionMap | null, pending: boolean) => list.map((u: any) => {
    const groupList = Array.isArray(u.groups) ? u.groups : [];
    const moduleList = Array.isArray(u.modules) ? u.modules : [];
    const sess = sessions?.[u.username] ?? null;
    const online = Boolean(sess?.online);
    const connections = Number(sess?.connections ?? 0) || 0;
    const lastLoginIso = sess?.lastLogin ?? null;
    return {
      ...u,
      groupsLabel: groupList.length > 0 ? groupList.join(", ") : "—",
      modulesLabel: moduleList.length > 0 ? moduleList.join(", ") : "—",
      uidGid: `${u.systemUid ?? "-"} / ${u.systemGid ?? "-"}`,
      linuxPasswordState: u.enabled ? t("labels.statusAvailable", "Disponible") : t("labels.statusLocked", "Bloqueado"),
      statusCell: {
        __cell: "statusdot",
        dotClass: online ? "bg-emerald-500" : "bg-gray-400",
        label: sessions === null ? (pending ? "…" : "—")
          : online ? t("labels.statusOnline", "En línea") : t("labels.statusOffline", "Desconectado"),
      },
      connections: sessions === null ? null : connections,
      lastLoginLabel: formatDateTime(lastLoginIso),
      lastLoginTs: tsOf(lastLoginIso),
      createdAtLabel: formatDateTime(u.createdAt),
      createdAtTs: tsOf(u.createdAt),
      updatedAtLabel: formatDateTime(u.updatedAt),
      updatedAtTs: tsOf(u.updatedAt),
    };
  });

  const normalized = normalize(previousPresence, fetchPresence);

  // Only sudo/wheel members may change other users' passwords. Derive it from
  // the caller's OWN row groups (captured from `id -nG` on the server). The
  // backend enforces this authoritatively; this just hides the action.
  const me = res.meta?.tableWindow?.actor ?? normalized.find((r: any) => r.username === currentUsername);
  const myGroups: string[] = Array.isArray(me?.groups) ? me.groups : [];
  capabilities.canChangePw = myGroups.some((g) => {
    const n = String(g).trim().toLowerCase();
    return n === "sudo" || n === "wheel";
  });

  publishUsersRows(normalized);
  void presence.then((sessRes) => {
    // A refresh, SPA swap or server switch supersedes this enrichment. Never
    // repaint a newer list with old sessions, or reopen its edit dialog.
    if (!isCurrent()) return;
    const sessions: SessionMap | null = sessRes?.ok
      ? ((sessRes.data as any)?.data ?? sessRes.data ?? {}) : null;
    if (fetchPresence && sessRes?.ok) {previousPresence = sessions; presenceAt = Date.now();}
    publishUsersRows(normalize(sessions, false));
  });
  const focusUser = new URL(window.location.href).searchParams.get("user");
  if (focusUser && capabilities.usersEdit) {
    const row = normalized.find((entry: any) => entry.username === focusUser);
    if (row) {
      const url = new URL(window.location.href);
      url.searchParams.delete("user");
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
      (window as any).openUserEdit(row);
    }
  }
}

// E-04: "confirmar → mutar → toast → awaitJob → recargar" vía el helper compartido.
(window as any).deleteUser = async (id: number, username: string) => {
  if (!capabilities.usersDelete) return;
  await confirmMutateReload({
    confirm: {
      message: fmt(t("confirm.deleteUser", "¿Eliminar el usuario \"{username}\"?"), { username }),
      options: { title: t("titles.deleteUser", "Eliminar usuario"), variant: "danger" },
    },
    request: () => api.delete(`/api/users/${id}?username=${encodeURIComponent(username)}`),
    toast: showToast,
    success: t("toasts.userDeleted", "Usuario eliminado"),
    error: t("toasts.errorDeleting", "Error al eliminar"),
    reload: () => { void loadUsers(); },
  });
};

// ── Block / unblock user (toggles the Linux account lock) ─────────────────
(window as any).toggleBlockUser = async (u: any) => {
  if (!capabilities.usersEdit) return;
  const willEnable = !u.enabled; // currently locked → enable; else lock it
  const confirmMsg = willEnable
    ? fmt(t("confirm.unblockUser", "¿Desbloquear el usuario \"{username}\"?"), { username: u.username })
    : fmt(t("confirm.blockUser", "¿Bloquear el usuario \"{username}\"? No podrá iniciar sesión."), { username: u.username });
  const title = willEnable ? t("titles.unblockUser", "Desbloquear usuario") : t("titles.blockUser", "Bloquear usuario");
  await confirmMutateReload({
    confirm: { message: confirmMsg, options: { title, variant: willEnable ? "default" : "danger" } },
    request: () => api.put(`/api/users/${u.id}`, { enabled: willEnable, _lookupUsername: u.username }),
    toast: showToast,
    success: willEnable ? t("toasts.userUnblocked", "Usuario desbloqueado") : t("toasts.userBlocked", "Usuario bloqueado"),
    error: (res) => res.error ?? t("toasts.errorBlocking", "No se pudo cambiar el estado del usuario"),
    reload: () => { void loadUsers(); },
  });
};
