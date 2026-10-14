/**
 * UsersModule (desktop) — pantalla NATIVA del módulo Usuarios de un servidor
 * standalone (conexión DIRECTA por `serverApi`). Port React DOM COMPLETO de
 * `app/src/screens/server/users/UsersScreen.tsx` (+ `UserDialog`/`RoleDialog`/
 * `UserActionDialogs`), conservando estilos (Tailwind + daisyUI + lucide-react),
 * i18n (`getMessages(...).serverUsers`) y contrato (`serverUsersApi`/`callServerApi`
 * con token `""` en modo directo; MISMOS endpoints que la pantalla de app).
 *
 * Paridad con app: tabs Usuarios/Grupos, cada uno con su DataTable (columnas,
 * filtros, acciones de fila y rápidas idénticas), botón de acción, guard/error,
 * modales crear/editar usuario y grupo, diálogos de contraseña/llaves/generar-llave,
 * confirmaciones y toasts. Las mutaciones pasan por la cola write-behind (`withJob`).
 */
import { useLiveModuleData } from "../../../lib/use-live-module-data";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, UserPlus, Users, UsersRound } from "lucide-react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableQuickActionConfig,
  type DataTableRowActionConfig,
} from "../../../components/DataTable";
import { useConfirm } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ToastProvider";
import {
  callServerApi,
  serverUsersApi,
  unwrap,
  withJob,
  type GatewayGuardCode,
  type GatewayResponse,
} from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";
import type { RoleFormPayload, ServerRole, ServerUser, UserFormPayload } from "./types";
import { UserDialog } from "./UserDialog";
import { RoleDialog } from "./RoleDialog";
import { ChangePwDialog, SshKeysDialog, GenKeyDialog } from "./UserActionDialogs";

const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE"];

/** Espejo del `runServerMutation` de app (`app/src/hooks/useServerApi.ts`). */
async function runServerMutation(
  serverId: string,
  op: () => Promise<GatewayResponse>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await op();
    if (res.code && GUARDS.includes(res.code)) return { ok: false, error: res.code };
    if (!res.ok) {
      const panel = res.data as { error?: string; message?: string } | undefined;
      return { ok: false, error: panel?.error ?? panel?.message ?? res.error };
    }
    await withJob(res, serverId, "");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

function parseSessions(data: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!data) return out;
  if (Array.isArray(data)) {
    for (const it of data as Array<Record<string, unknown>>) {
      const u = (it.username ?? it.user) as string | undefined;
      if (typeof u === "string") out[u] = Number(it.connections ?? it.count ?? 1) || 1;
    }
  } else if (typeof data === "object") {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v === "number") out[k] = v;
      else if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        out[k] = Number(o.connections ?? o.count ?? (o.online ? 1 : 0)) || 0;
      }
    }
  }
  return out;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" } as Intl.DateTimeFormatOptions);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** Fila plana para el DataTable de desktop (accessorKeys ordenables/filtrables). */
type UserTableRow = {
  id: string;
  username: string;
  displayName: string;
  connections: number;
  uidGid: string;
  homeDir: string;
  groupsText: string;
  modulesText: string;
  /** Valor de filtro/estado de contraseña Linux: "available" | "locked". */
  state: string;
  online: boolean;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
  raw: ServerUser;
};

type RoleTableRow = {
  id: string;
  name: string;
  /** Valor de filtro: "system" | "user". */
  kind: string;
  members: number;
  modulesText: string;
  description: string;
  raw: ServerRole;
};

export function UsersModule({ serverId, language }: ModuleProps) {
  const t = getMessages(language).serverUsers;
  const c = getMessages(language).common;
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [tab, setTab] = useState<"users" | "groups">("users");
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [online, setOnline] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [userDialog, setUserDialog] = useState<{ mode: "create" | "edit"; initial?: ServerUser | null } | null>(null);
  const [roleDialog, setRoleDialog] = useState<{ mode: "create" | "edit"; initial?: ServerRole | null } | null>(null);
  const [changePwUser, setChangePwUser] = useState<ServerUser | null>(null);
  const [sshKeysUser, setSshKeysUser] = useState<ServerUser | null>(null);
  const [genKeyUser, setGenKeyUser] = useState<ServerUser | null>(null);

  const showToast = useCallback((message: string, err = false) => {
    if (err) toast.error(message);
    else toast.success(message);
  }, [toast]);

  const load = useCallback(async (background = false) => {
    const [uRes, sRes, rRes] = await Promise.all([
      serverUsersApi.list(serverId, ""),
      background ? Promise.resolve(null) : serverUsersApi.sessions(serverId, ""),
      serverUsersApi.listRoles(serverId, ""),
    ]);
    if (uRes.code && GUARDS.includes(uRes.code)) {
      setGuardCode(uRes.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    if (!uRes.ok) {
      setError(uRes.error ?? t.toasts.errorDeleting);
      return;
    }
    setError(null);
    setUsers(unwrap<ServerUser[]>(uRes) ?? []);
    setRoles(unwrap<ServerRole[]>(rRes) ?? []);
    if (sRes?.ok) setOnline(parseSessions(unwrap(sRes)));
  }, [serverId, t.toasts.errorDeleting]);

  useLiveModuleData(serverId, ["users/system", "users/roles"], () => load(true));

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Mutaciones ─────────────────────────────────────────────────────────────
  const saveUser = useCallback(
    async (payload: UserFormPayload): Promise<boolean> => {
      const editing = userDialog?.mode === "edit" ? userDialog.initial : null;
      const body = {
        username: payload.username,
        displayName: payload.displayName,
        email: payload.email,
        groups: payload.groups,
        enabled: payload.enabled,
        ...(payload.password ? { password: payload.password } : {}),
      };
      const out = editing
        ? await runServerMutation(serverId, () => serverUsersApi.update(serverId, "", String(editing.id), body))
        : await runServerMutation(serverId, () => serverUsersApi.create(serverId, "", body));
      if (out.ok) {
        showToast(editing ? t.toasts.userUpdated : t.toasts.userCreated);
        await load();
        return true;
      }
      showToast(out.error ?? t.toasts.saveFailed, true);
      return false;
    },
    [userDialog, serverId, showToast, load, t.toasts],
  );

  const saveRole = useCallback(
    async (payload: RoleFormPayload): Promise<boolean> => {
      const editing = roleDialog?.mode === "edit" ? roleDialog.initial : null;
      const out = editing
        ? await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", `/api/roles/${encodeURIComponent(editing.name)}`, payload))
        : await runServerMutation(serverId, () => callServerApi(serverId, "", "POST", "/api/roles", payload));
      if (out.ok) {
        showToast(editing ? t.toasts.groupUpdated : t.toasts.groupCreated);
        await load();
        return true;
      }
      showToast(out.error ?? t.toasts.saveFailed, true);
      return false;
    },
    [roleDialog, serverId, showToast, load, t.toasts],
  );

  // ── Acciones de fila (Usuarios) ─────────────────────────────────────────────
  const onUserAction = useCallback(
    async (actionId: string, row: ServerUser) => {
      switch (actionId) {
        case "edit":
          setUserDialog({ mode: "edit", initial: row });
          break;
        case "ssh-keys":
          setSshKeysUser(row);
          break;
        case "gen-key":
          setGenKeyUser(row);
          break;
        case "change-password":
          setChangePwUser(row);
          break;
        case "review-activity":
          toast.info(t.table.rowActions.reviewActivity);
          break;
        case "toggle-block": {
          const block = row.enabled !== false;
          const ok = await confirm({
            title: block ? t.confirm.blockUserTitle : t.confirm.unblockUserTitle,
            message: formatMessage(block ? t.confirm.blockUser : t.confirm.unblockUser, { username: row.username }),
            confirmLabel: t.confirm.btnConfirm,
            cancelLabel: t.confirm.btnCancel,
            danger: true,
          });
          if (!ok) return;
          const out = await runServerMutation(serverId, () => serverUsersApi.update(serverId, "", String(row.id), { enabled: !block }));
          if (out.ok) {
            showToast(block ? t.toasts.userBlocked : t.toasts.userUnblocked);
            await load();
          } else showToast(out.error ?? t.toasts.saveFailed, true);
          break;
        }
        case "delete": {
          const ok = await confirm({
            title: t.confirm.deleteUserTitle,
            message: formatMessage(t.confirm.deleteUser, { username: row.username }),
            confirmLabel: t.confirm.btnConfirm,
            cancelLabel: t.confirm.btnCancel,
            danger: true,
          });
          if (!ok) return;
          const out = await runServerMutation(serverId, () =>
            callServerApi(serverId, "", "DELETE", `/api/users/${encodeURIComponent(String(row.id))}?username=${encodeURIComponent(row.username)}`),
          );
          if (out.ok) {
            showToast(t.toasts.userDeleted);
            await load();
          } else showToast(out.error ?? t.toasts.errorDeleting, true);
          break;
        }
      }
    },
    [serverId, showToast, load, confirm, toast, t],
  );

  const onUsersDelete = useCallback(
    async (rows: ServerUser[]) => {
      if (rows.length === 0) return;
      const ok = await confirm({
        title: t.confirm.deleteUsersTitle,
        message: formatMessage(t.confirm.deleteUsers, { count: rows.length }),
        confirmLabel: t.confirm.btnConfirm,
        cancelLabel: t.confirm.btnCancel,
        danger: true,
      });
      if (!ok) return;
      for (const r of rows) {
        await runServerMutation(serverId, () =>
          callServerApi(serverId, "", "DELETE", `/api/users/${encodeURIComponent(String(r.id))}?username=${encodeURIComponent(r.username)}`),
        );
      }
      showToast(t.toasts.usersDeleted);
      await load();
    },
    [serverId, showToast, load, confirm, t],
  );

  const onUsersToggle = useCallback(
    async (rows: ServerUser[], enable: boolean) => {
      if (rows.length === 0) return;
      for (const r of rows) {
        await runServerMutation(serverId, () => serverUsersApi.update(serverId, "", String(r.id), { enabled: enable }));
      }
      showToast(enable ? t.toasts.usersEnabled : t.toasts.usersDisabled);
      await load();
    },
    [serverId, showToast, load, t.toasts],
  );

  // ── Acciones de fila (Grupos) ───────────────────────────────────────────────
  const onRoleAction = useCallback(
    async (actionId: string, row: ServerRole) => {
      if (actionId === "edit") setRoleDialog({ mode: "edit", initial: row });
      else if (actionId === "delete") {
        const ok = await confirm({
          title: t.confirm.deleteGroupTitle,
          message: formatMessage(t.confirm.deleteGroup, { name: row.name }),
          confirmLabel: t.confirm.btnConfirm,
          cancelLabel: t.confirm.btnCancel,
          danger: true,
        });
        if (!ok) return;
        const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "DELETE", `/api/roles/${encodeURIComponent(row.name)}`));
        if (out.ok) {
          showToast(t.toasts.groupDeleted);
          await load();
        } else showToast(out.error ?? t.toasts.errorDeleting, true);
      }
    },
    [serverId, showToast, load, confirm, t],
  );

  const onRolesDelete = useCallback(
    async (rows: ServerRole[]) => {
      if (rows.length === 0) return;
      const ok = await confirm({
        title: t.confirm.deleteGroupTitle,
        message: formatMessage(t.confirm.deleteUsers, { count: rows.length }),
        confirmLabel: t.confirm.btnConfirm,
        cancelLabel: t.confirm.btnCancel,
        danger: true,
      });
      if (!ok) return;
      for (const r of rows) await runServerMutation(serverId, () => callServerApi(serverId, "", "DELETE", `/api/roles/${encodeURIComponent(r.name)}`));
      showToast(t.toasts.groupDeleted);
      await load();
    },
    [serverId, showToast, load, confirm, t],
  );

  // ── Filas planas ────────────────────────────────────────────────────────────
  const userRows = useMemo<UserTableRow[]>(
    () =>
      users.map((u) => ({
        id: String(u.id),
        username: u.username,
        displayName: u.displayName ?? "—",
        connections: online[u.username] ?? 0,
        uidGid: `${u.uid ?? u.systemUid ?? "—"}/${u.gid ?? "—"}`,
        homeDir: u.homeDir ?? "—",
        groupsText: (u.groups ?? []).join(", ") || "—",
        modulesText: (u.modules ?? []).join(", ") || "—",
        state: u.enabled !== false ? "available" : "locked",
        online: (online[u.username] ?? 0) > 0,
        lastLogin: u.lastLogin ?? "",
        createdAt: u.createdAt ?? "",
        updatedAt: u.updatedAt ?? "",
        raw: u,
      })),
    [users, online],
  );

  const roleRows = useMemo<RoleTableRow[]>(
    () =>
      roles.map((r) => ({
        id: r.name,
        name: r.name,
        kind: r.kind === "system" ? "system" : "user",
        members: (r.members ?? []).length,
        modulesText: (r.modules ?? []).join(", ") || "—",
        description: r.description ?? "—",
        raw: r,
      })),
    [roles],
  );

  // ── Columnas / filtros / acciones ───────────────────────────────────────────
  const userColumns = useMemo<DataTableColumnConfig<UserTableRow>[]>(
    () => [
      { id: "username", header: t.table.columns.username, accessorKey: "username", cell: (u) => <span className="font-medium">{u.username}</span> },
      { id: "displayName", header: t.table.columns.displayName, accessorKey: "displayName" },
      {
        id: "status",
        header: t.table.columns.status,
        accessorKey: "online",
        cell: (u) => (
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${u.online ? "bg-success" : "bg-base-content/30"}`} />
            <span className="text-xs text-base-content/60">{u.online ? t.labels.statusOnline : t.labels.statusOffline}</span>
          </span>
        ),
      },
      { id: "connections", header: t.table.columns.connections, accessorKey: "connections" },
      { id: "uidGid", header: t.table.columns.uidGid, accessorKey: "uidGid", sortable: false },
      { id: "homeDir", header: t.table.columns.homeDir, accessorKey: "homeDir", cell: (u) => <span className="font-mono text-xs">{u.homeDir}</span> },
      { id: "groups", header: t.table.columns.groups, accessorKey: "groupsText", sortable: false },
      { id: "modules", header: t.table.columns.modules, accessorKey: "modulesText", sortable: false },
      {
        id: "linuxPasswordState",
        header: t.table.columns.linuxPasswordState,
        accessorKey: "state",
        cell: (u) =>
          u.state === "available" ? (
            <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">{t.labels.statusAvailable}</span>
          ) : (
            <span className="rounded-full border border-error/30 bg-error/10 px-2 py-0.5 text-[11px] font-medium text-error">{t.labels.statusLocked}</span>
          ),
      },
      { id: "lastLogin", header: t.table.columns.lastLogin, accessorKey: "lastLogin", cell: (u) => fmtDate(u.lastLogin) },
      { id: "createdAt", header: t.table.columns.createdAt, accessorKey: "createdAt", cell: (u) => fmtDate(u.createdAt) },
      { id: "updatedAt", header: t.table.columns.updatedAt, accessorKey: "updatedAt", cell: (u) => fmtDate(u.updatedAt) },
    ],
    [t],
  );

  const userFilters = useMemo<DataTableFilterConfig<UserTableRow>[]>(
    () => [
      { id: "search", label: t.table.filters.searchUser, accessorKey: "username", type: "text" },
      {
        id: "state",
        label: t.table.filters.linuxState,
        accessorKey: "state",
        type: "select",
        options: [
          { value: "available", label: t.filterValues.available },
          { value: "locked", label: t.filterValues.locked },
        ],
      },
    ],
    [t],
  );

  const userRowActions = useMemo<DataTableRowActionConfig<UserTableRow>[]>(
    () => [
      { id: "edit", label: t.table.rowActions.edit },
      { id: "ssh-keys", label: t.table.rowActions.sshKeys },
      { id: "gen-key", label: t.table.rowActions.genKey },
      { id: "change-password", label: t.table.rowActions.changePassword },
      { id: "review-activity", label: t.table.rowActions.reviewActivity },
      { id: "toggle-block", label: t.table.rowActions.toggleBlock },
      { id: "delete", label: t.table.rowActions.delete, variant: "danger" },
    ],
    [t],
  );

  const userQuickActions = useMemo<DataTableQuickActionConfig<UserTableRow>[]>(
    () => [
      { id: "delete", label: t.table.quickActions.deleteSelected, requiresSelection: true, variant: "danger", onClick: (rows) => void onUsersDelete(rows.map((r) => r.raw)) },
      { id: "disable", label: t.table.quickActions.disableKey, requiresSelection: true, onClick: (rows) => void onUsersToggle(rows.map((r) => r.raw), false) },
      { id: "enable", label: t.table.quickActions.enableKey, requiresSelection: true, variant: "primary", onClick: (rows) => void onUsersToggle(rows.map((r) => r.raw), true) },
    ],
    [t, onUsersDelete, onUsersToggle],
  );

  const roleColumns = useMemo<DataTableColumnConfig<RoleTableRow>[]>(
    () => [
      { id: "name", header: t.table.roleColumns.name, accessorKey: "name", cell: (r) => <span className="font-medium">{r.name}</span> },
      {
        id: "kind",
        header: t.table.roleColumns.kind,
        accessorKey: "kind",
        cell: (r) =>
          r.kind === "system" ? (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">{t.labels.kindSystem}</span>
          ) : (
            <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">{t.labels.kindUser}</span>
          ),
      },
      { id: "members", header: t.table.roleColumns.members, accessorKey: "members" },
      { id: "modules", header: t.table.roleColumns.modules, accessorKey: "modulesText", sortable: false },
      { id: "description", header: t.table.roleColumns.description, accessorKey: "description", sortable: false },
    ],
    [t],
  );

  const roleFilters = useMemo<DataTableFilterConfig<RoleTableRow>[]>(
    () => [
      { id: "search", label: t.table.filters.searchRole, accessorKey: "name", type: "text" },
      {
        id: "kind",
        label: t.table.filters.groupKind,
        accessorKey: "kind",
        type: "select",
        options: [
          { value: "user", label: t.filterValues.kindUser },
          { value: "system", label: t.filterValues.kindSystem },
        ],
      },
    ],
    [t],
  );

  const roleRowActions = useMemo<DataTableRowActionConfig<RoleTableRow>[]>(
    () => [
      { id: "edit", label: t.table.roleRowActions.editPermissions },
      { id: "delete", label: t.table.roleRowActions.delete, variant: "danger" },
    ],
    [t],
  );

  const roleQuickActions = useMemo<DataTableQuickActionConfig<RoleTableRow>[]>(
    () => [
      { id: "delete", label: t.table.roleQuickActions.deleteSelected, requiresSelection: true, variant: "danger", onClick: (rows) => void onRolesDelete(rows.map((r) => r.raw)) },
    ],
    [t, onRolesDelete],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  if (guardCode) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.pageTitle}</h2>
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm text-error">{error ?? t.toasts.errorDeleting}</p>
          <p className="font-mono text-xs text-base-content/50">{guardCode}</p>
          <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => void onRefresh()}>
            <RefreshCw size={14} /> {c.refresh}
          </button>
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera + tabs + acción + refrescar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-semibold">{t.pageTitle}</h2>
          <p className="text-xs text-base-content/60">{t.subtitle}</p>
        </div>
        {tab === "users" ? (
          <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setUserDialog({ mode: "create" })}>
            <UserPlus size={15} /> {t.buttons.newUser}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setRoleDialog({ mode: "create" })}>
            <Plus size={15} /> {t.buttons.newGroup}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {c.refresh}
        </button>
      </div>

      <div role="tablist" className="tabs tabs-boxed w-fit">
        <button type="button" role="tab" className={`tab gap-1.5 ${tab === "users" ? "tab-active" : ""}`} onClick={() => setTab("users")}>
          <Users size={15} /> {t.tabs.users}
        </button>
        <button type="button" role="tab" className={`tab gap-1.5 ${tab === "groups" ? "tab-active" : ""}`} onClick={() => setTab("groups")}>
          <UsersRound size={15} /> {t.tabs.groups}
        </button>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      {tab === "users" ? (
        <DataTable<UserTableRow>
          tableId="server-users"
          title={t.tabs.users}
          data={userRows}
          columns={userColumns}
          filters={userFilters}
          rowActions={userRowActions}
          quickActions={userQuickActions}
          pageSizeOptions={[10, 25, 50, 100]}
          language={language}
          loading={loading}
          onRowAction={(actionId, row) => void onUserAction(actionId, row.raw)}
        />
      ) : (
        <DataTable<RoleTableRow>
          tableId="server-roles"
          title={t.tabs.groups}
          data={roleRows}
          columns={roleColumns}
          filters={roleFilters}
          rowActions={roleRowActions}
          quickActions={roleQuickActions}
          pageSizeOptions={[10, 25, 50, 100]}
          language={language}
          loading={loading}
          onRowAction={(actionId, row) => void onRoleAction(actionId, row.raw)}
        />
      )}

      {/* Modales */}
      {userDialog ? (
        <UserDialog mode={userDialog.mode} initial={userDialog.initial} roles={roles} language={language} onClose={() => setUserDialog(null)} onSave={saveUser} />
      ) : null}
      {roleDialog ? (
        <RoleDialog mode={roleDialog.mode} initial={roleDialog.initial} serverId={serverId} language={language} onClose={() => setRoleDialog(null)} onSave={saveRole} />
      ) : null}
      {changePwUser ? <ChangePwDialog serverId={serverId} user={changePwUser} language={language} onClose={() => setChangePwUser(null)} onToast={showToast} /> : null}
      {sshKeysUser ? <SshKeysDialog serverId={serverId} user={sshKeysUser} language={language} onClose={() => setSshKeysUser(null)} onToast={showToast} /> : null}
      {genKeyUser ? <GenKeyDialog serverId={serverId} user={genKeyUser} language={language} onClose={() => setGenKeyUser(null)} onToast={showToast} /> : null}

      {dialog}
    </div>
  );
}
