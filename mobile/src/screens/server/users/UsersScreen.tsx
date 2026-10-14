import { nativeText } from '../../../i18n/native-text';
import { createMutationBatch } from "../../../lib/mutation-batch";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Button } from "../../../components/ui/Button";
import { ModuleTabPanel, ModuleGrid } from "../../../components/server/ModuleLayouts";
import { useWorkspaceModuleTab } from "../../main/use-workspace-module-tab";
import { useLiveModuleData } from "../../../lib/use-live-module-data";
import { NativeModuleContext, useNativeModuleVisible } from "../../main/native-module-visibility";
/**
 * UsersScreen — réplica nativa del módulo Usuarios de LUXIPANEL
 * (`frontend/src/pages/panel/users/index.astro`). Tabs Usuarios/Grupos, cada uno
 * con su tabla (columnas/filtros/acciones exactas), botón de acción, modales y
 * confirmaciones. Datos por el gateway (`serverUsersApi`); mutaciones con la cola
 * write-behind (`runServerMutation` → `withJob`).
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { ScrollView, View } from "react-native";
import { Users, Shield, BarChart3, LogIn } from "lucide-react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { ServerDataTable, type ServerColumn, type ServerFilter, type ServerRowAction, type ServerQuickAction } from "../../../components/server/ServerDataTable";
import { ConfirmDialog, type ConfirmState } from "../../../components/server/Form";
import { pillColors, statusDotColor, type PillKind } from "../../../components/server/badges";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import {
  TablerUserPlus,
  TablerPlus,
  TablerEdit,
  TablerTrash,
  TablerKey,
  TablerLockPassword,
  TablerLock,
  TablerLockOpen,
  TablerActivity,
  TablerTerminal2,
} from "../../../features/app/tabler-icons";
import { serverUsersApi, callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";
import type { ServerUser, ServerRole, UserFormPayload, RoleFormPayload } from "./types";
import { UserDialog } from "./UserDialog";
import { RoleDialog } from "./RoleDialog";
import { ChangePwDialog, SshKeysDialog, GenKeyDialog } from "./UserActionDialogs";
import { UsersModuleHeader } from "./UsersModuleHeader";
import { ModuleSettingsDrawer } from "../../../components/ui/ModuleSettingsDrawer";
import { NativeHostingTools } from "../NativeHostingTools";
import { NativeOperationCard } from "../NativeOperationCard";
import { reportDevelopmentInfo } from "../../../lib/development-errors";

const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE", "DIRECT_AUTH_REQUIRED"];
const PAGE_SIZES = [10, 25, 50, 100];

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

export function UsersScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const moduleContext = useContext(NativeModuleContext);
  const activityPending = useRef(false);
  const confirmPending = useRef(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const moduleVisible = useNativeModuleVisible();
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverUsers;

  const [tab, setTab] = useWorkspaceModuleTab<string>("users");
  useEffect(() => {
    if (moduleVisible) reportDevelopmentInfo(`users-drawer=web-parity-v3 view=${tab}`);
  }, [moduleVisible, tab]);
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [online, setOnline] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [plansOpen, setPlansOpen] = useState(false);
  const [userDialog, setUserDialog] = useState<{ mode: "create" | "edit"; initial?: ServerUser | null } | null>(null);
  const [roleDialog, setRoleDialog] = useState<{ mode: "create" | "edit"; initial?: ServerRole | null } | null>(null);
  const [changePwUser, setChangePwUser] = useState<ServerUser | null>(null);
  const [sshKeysUser, setSshKeysUser] = useState<ServerUser | null>(null);
  const [genKeyUser, setGenKeyUser] = useState<ServerUser | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({
    visible: false,
    variant: "success",
    message: "",
    nonce: 0,
  });
  const showToast = useCallback((message: string, err = false) => {
    setToast((prev) => ({ visible: true, variant: err ? "error" : "success", message, nonce: prev.nonce + 1 }));
  }, []);

  const load = useCallback(async (background = false) => {
    const [uRes, sRes, rRes] = await Promise.all([
      serverUsersApi.list(panelId, token),
      background ? Promise.resolve(null) : serverUsersApi.sessions(panelId, token),
      serverUsersApi.listRoles(panelId, token),
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
  }, [panelId, token, t.toasts.errorDeleting]);

  useLiveModuleData(panelId, ["users/system", "users/roles"], () => load(true));

  useEffect(() => {
    if (!moduleVisible) return;
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load, moduleVisible]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const exportSummary = async (kind: "users" | "roles") => {
    try {
      const rows: unknown[][] = kind === "users"
        ? [["usuario","nombre","correo","uid","gid","directorio","grupos","modulos","conexiones","ultimo_acceso"], ...users.map(user => [user.username,user.displayName,user.email,user.systemUid ?? user.uid,user.gid,user.homeDir,user.groups?.join("; "),user.modules?.join("; "),online[user.username] ?? 0,user.lastLogin])]
        : [["grupo","tipo","descripcion","miembros","modulos"], ...roles.map(role => [role.name,role.kind,role.description,role.members?.join("; "),role.modules?.join("; ")])];
      if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error(nativeText("No se puede compartir el archivo en este dispositivo."));
      const uri = FileSystem.cacheDirectory + `${kind}-${new Date().toISOString().slice(0,10)}.csv`;
      const csv = rows.map(row => row.map(value => '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")).join("\r\n");
      await FileSystem.writeAsStringAsync(uri, "\uFEFF" + csv);
      await Sharing.shareAsync(uri, { mimeType: "text/csv" });
    } catch (cause) { showToast(cause instanceof Error ? cause.message : nativeText("No se pudo exportar."), true); }
  };

  // ── Mutaciones ─────────────────────────────────────────────────────────────
  const saveUser = useCallback(
    async (payload: UserFormPayload): Promise<boolean> => {
      const editing = userDialog?.mode === "edit" ? userDialog.initial : null;
      const body = {
        username: payload.username,
        ...(editing ? { _lookupUsername: editing.username } : {}),
        displayName: payload.displayName,
        email: payload.email,
        groups: payload.groups,
        enabled: payload.enabled,
        ...(payload.password ? { password: payload.password } : {}),
      };
      const out = editing
        ? await runServerMutation(panelId, token, () => serverUsersApi.update(panelId, token, String(editing.id), body))
        : await runServerMutation(panelId, token, () => serverUsersApi.create(panelId, token, body));
      if (out.ok) {
        showToast(editing ? t.toasts.userUpdated : t.toasts.userCreated);
        await load();
        return true;
      }
      throw new Error(out.error ?? t.toasts.saveFailed);
    },
    [userDialog, panelId, token, showToast, load, t.toasts],
  );

  const saveRole = useCallback(
    async (payload: RoleFormPayload): Promise<boolean> => {
      const editing = roleDialog?.mode === "edit" ? roleDialog.initial : null;
      const out = editing
        ? await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", `/api/roles/${encodeURIComponent(editing.name)}`, payload))
        : await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", "/api/roles", payload));
      if (out.ok) {
        showToast(editing ? t.toasts.groupUpdated : t.toasts.groupCreated);
        await load();
        return true;
      }
      throw new Error(out.error ?? t.toasts.saveFailed);
    },
    [roleDialog, panelId, token, showToast, load, t.toasts],
  );

  const runConfirm = useCallback(async () => {
    if (!confirm || confirmPending.current) return;
    confirmPending.current = true; setConfirmBusy(true); setConfirmError(null);
    try { await confirm.onConfirm(); setConfirm(null); }
    catch (cause) { setConfirmError(cause instanceof Error ? cause.message : t.toasts.saveFailed); }
    finally { confirmPending.current = false; setConfirmBusy(false); }
  }, [confirm, t.toasts.saveFailed]);

  const reviewActivity = async (row: ServerUser) => {
    if (activityPending.current) return;
    if (!moduleContext?.openModule) { showToast(nativeText("Abre el asistente desde el espacio del servidor."), true); return; }
    activityPending.current = true;
    try {
      const {chatController} = await import("../../../features/assistant/chat-controller");
      const {chatStore} = await import("../../../features/assistant/chat-store");
      chatController.configure(panelId, {token});
      await chatController.loadProviders(panelId);
      chatController.newConversation(panelId);
      chatStore.setStarted(panelId, true);
      moduleContext.openModule("assistant");
      const prompt = `Investiga la actividad del usuario Linux ${JSON.stringify(row.username)} durante los últimos 30 días en este servidor. Revisa accesos SSH/locales, fallos de autenticación, uso de sudo y archivos modificados. Usa datos reales y explica qué registros no están disponibles. No modifiques el servidor.\nDatos del módulo Usuarios: ${JSON.stringify({username:row.username,uid:row.systemUid ?? row.uid,groups:row.groups,homeDir:row.homeDir,lastLogin:row.lastLogin})}`;
      await chatController.sendText(panelId, prompt);
    } catch (cause) { showToast(cause instanceof Error ? cause.message : t.toasts.saveFailed, true); }
    finally { activityPending.current = false; }
  };

  // ── Acciones de fila (Usuarios) ─────────────────────────────────────────────
  const onUserAction = useCallback(
    (actionId: string, row: ServerUser) => {
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
          void reviewActivity(row);
          break;
        case "toggle-block": {
          const block = row.enabled !== false;
          setConfirm({
            title: block ? t.confirm.blockUserTitle : t.confirm.unblockUserTitle,
            message: formatMessage(block ? t.confirm.blockUser : t.confirm.unblockUser, { username: row.username }),
            onConfirm: async () => {
              const out = await runServerMutation(panelId, token, () =>
                serverUsersApi.update(panelId, token, String(row.id), { enabled: !block, _lookupUsername: row.username }),
              );
              if (out.ok) {
                showToast(block ? t.toasts.userBlocked : t.toasts.userUnblocked);
                await load();
              } else throw new Error(out.error ?? t.toasts.saveFailed);
            },
          });
          break;
        }
        case "delete":
          setConfirm({
            title: t.confirm.deleteUserTitle,
            message: formatMessage(t.confirm.deleteUser, { username: row.username }),
            onConfirm: async () => {
              const out = await runServerMutation(panelId, token, () =>
                callServerApi(panelId, token, "DELETE", `/api/users/${encodeURIComponent(String(row.id))}?username=${encodeURIComponent(row.username)}`),
              );
              if (out.ok) {
                showToast(t.toasts.userDeleted);
                await load();
              } else throw new Error(out.error ?? t.toasts.errorDeleting);
            },
          });
          break;
      }
    },
    [panelId, token, showToast, load, t, moduleContext],
  );

  const onUserQuickAction = useCallback(
    (actionId: string, rows: ServerUser[]) => {
      if (rows.length === 0) return;
      if (actionId === "delete") {
        const applyBatch = createMutationBatch(rows, r => runServerMutation(panelId, token, () => callServerApi(panelId, token, "DELETE", `/api/users/${encodeURIComponent(String(r.id))}?username=${encodeURIComponent(r.username)}`)), r => r.username);
        setConfirm({
          title: t.confirm.deleteUsersTitle,
          message: formatMessage(t.confirm.deleteUsers, { count: rows.length }),
          onConfirm: async () => {
            try { await applyBatch(); } catch (cause) { await load(); throw cause; }
            showToast(t.toasts.usersDeleted);
            await load();
          },
        });
      } else {
        const enable = actionId === "enable";
        void (async () => {
          for (const r of rows) {
            const out = await runServerMutation(panelId, token, () => serverUsersApi.update(panelId, token, String(r.id), { enabled: enable, _lookupUsername: r.username }));
            if (!out.ok) { showToast(`${r.username}: ${out.error ?? t.toasts.saveFailed}`, true); await load(); return; }
          }
          showToast(enable ? t.toasts.usersEnabled : t.toasts.usersDisabled);
          await load();
        })();
      }
    },
    [panelId, token, showToast, load, t],
  );

  // ── Acciones de fila (Grupos) ───────────────────────────────────────────────
  const onRoleAction = useCallback(
    (actionId: string, row: ServerRole) => {
      if (actionId === "edit") setRoleDialog({ mode: "edit", initial: row });
      else if (actionId === "delete")
        setConfirm({
          title: t.confirm.deleteGroupTitle,
          message: formatMessage(t.confirm.deleteGroup, { name: row.name }),
          onConfirm: async () => {
            const out = await runServerMutation(panelId, token, () =>
              callServerApi(panelId, token, "DELETE", `/api/roles/${encodeURIComponent(row.name)}`),
            );
            if (out.ok) {
              showToast(t.toasts.groupDeleted);
              await load();
            } else throw new Error(out.error ?? t.toasts.errorDeleting);
          },
        });
    },
    [panelId, token, showToast, load, t],
  );

  // ── Celdas (pills / status-dot) ─────────────────────────────────────────────
  const Pill = ({ label, kind }: { label: string; kind: PillKind }) => {
    const c = kind === "amber" ? { bg: withAlpha("#f59e0b", 0.1), border: withAlpha("#d97706", 0.3), text: theme === "dark" ? "#fcd34d" : "#b45309" }
      : kind === "sky" ? { bg: withAlpha("#0ea5e9", 0.1), border: withAlpha("#0284c7", 0.3), text: theme === "dark" ? "#7dd3fc" : "#0369a1" }
      : pillColors(tokens, kind);
    return (
      <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 10, fontWeight: "500" }}>{label}</Text>
      </View>
    );
  };
  const StatusCell = ({ user }: { user: ServerUser }) => {
    const isOnline = (online[user.username] ?? 0) > 0;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusDotColor(tokens, isOnline) }} />
        <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{isOnline ? t.labels.statusOnline : t.labels.statusOffline}</Text>
      </View>
    );
  };

  // ── Definición de columnas ──────────────────────────────────────────────────
  const userColumns: ServerColumn<ServerUser>[] = useMemo(
    () => [
      { id: "username", header: t.table.columns.username, cell: (u) => u.username, sortable: true, sortValue: (u) => u.username, width: 150 },
      { id: "displayName", header: t.table.columns.displayName, cell: (u) => u.displayName ?? "—", sortable: true, sortValue: u => u.displayName ?? "", width: 150, defaultHidden: true },
      { id: "status", header: t.table.columns.status, cell: (u) => <StatusCell user={u} />, width: 120, defaultHidden: true },
      { id: "connections", header: t.table.columns.connections, cell: (u) => String(online[u.username] ?? 0), sortable: true, sortValue: u => online[u.username] ?? 0, width: 100, defaultHidden: true },
      { id: "uidGid", header: t.table.columns.uidGid, cell: (u) => `${u.systemUid ?? u.uid ?? "—"}/${u.systemGid ?? u.gid ?? "—"}`, sortable: true, sortValue: u => u.systemUid ?? u.uid ?? 0, width: 110, defaultHidden: true },
      { id: "homeDir", header: t.table.columns.homeDir, cell: (u) => u.homeDir ?? "—", sortable: true, sortValue: u => u.homeDir ?? "", width: 170, defaultHidden: true },
      { id: "groups", header: t.table.columns.groups, cell: (u) => (u.groups ?? []).join(", ") || "—", width: 160, defaultHidden: true },
      { id: "modules", header: t.table.columns.modules, cell: (u) => (u.modules ?? []).join(", ") || "—", width: 160, defaultHidden: true },
      {
        id: "linuxPasswordState",
        header: t.table.columns.linuxPasswordState,
        sortable: true, sortValue: u => u.enabled !== false ? t.labels.statusAvailable : t.labels.statusLocked,
        cell: (u) => <Pill label={u.enabled !== false ? t.labels.statusAvailable : t.labels.statusLocked} kind={u.enabled !== false ? "ok" : "danger"} />,
        width: 170,
        defaultHidden: true,
      },
      { id: "lastLogin", header: t.table.columns.lastLogin, cell: (u) => fmtDate(u.lastLogin), sortable: true, sortValue: (u) => u.lastLogin ?? "", width: 150, defaultHidden: true },
      { id: "createdAt", header: t.table.columns.createdAt, cell: (u) => fmtDate(u.createdAt), sortable: true, sortValue: (u) => u.createdAt ?? "", width: 150, defaultHidden: true },
      { id: "updatedAt", header: t.table.columns.updatedAt, cell: (u) => fmtDate(u.updatedAt), sortable: true, sortValue: u => u.updatedAt ?? "", width: 150, defaultHidden: true },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, online, tokens],
  );

  const userFilters: ServerFilter<ServerUser>[] = useMemo(
    () => [
      { id: "search", kind: "search", placeholder: t.table.filters.searchUser, match: (u, q) => u.username.toLowerCase().includes(q) },
      {
        id: "state",
        kind: "select",
        placeholder: t.table.filters.linuxState,
        options: [
          { value: "available", label: t.filterValues.available },
          { value: "locked", label: t.filterValues.locked },
        ],
        match: (u, v) => (v === "available" ? u.enabled !== false : u.enabled === false),
      },
    ],
    [t],
  );

  const userRowActions: ServerRowAction[] = useMemo(
    () => [
      { id: "edit", label: t.table.rowActions.edit, icon: <TablerEdit size={18} /> },
      { id: "ssh-keys", label: t.table.rowActions.sshKeys, icon: <TablerTerminal2 size={18} /> },
      { id: "gen-key", label: t.table.rowActions.genKey, icon: <TablerKey size={18} /> },
      { id: "change-password", label: t.table.rowActions.changePassword, icon: <TablerLockPassword size={18} /> },
      { id: "review-activity", label: t.table.rowActions.reviewActivity, icon: <TablerActivity size={18} /> },
      { id: "toggle-block", label: t.table.rowActions.toggleBlock, icon: <TablerLock size={18} /> },
      { id: "delete", label: t.table.rowActions.delete, icon: <TablerTrash size={18} />, danger: true },
    ],
    [t],
  );
  const userQuickActions: ServerQuickAction[] = useMemo(
    () => [
      { id: "delete", label: t.table.quickActions.deleteSelected, icon: <TablerTrash size={16} />, danger: true },
      { id: "disable", label: t.table.quickActions.disableKey, icon: <TablerLock size={16} /> },
      { id: "enable", label: t.table.quickActions.enableKey, icon: <TablerLockOpen size={16} /> },
    ],
    [t],
  );

  const roleColumns: ServerColumn<ServerRole>[] = useMemo(
    () => [
      { id: "name", header: t.table.roleColumns.name, cell: (r) => r.name, sortable: true, sortValue: (r) => r.name, width: 78 },
      { id: "kind", header: t.table.roleColumns.kind, cell: (r) => <Pill label={r.kind === "system" ? t.labels.kindSystem : t.labels.kindUser} kind={r.kind === "system" ? "amber" : "sky"} />, sortable: true, sortValue: (r) => r.kind === "system" ? t.labels.kindSystem : t.labels.kindUser, width: 78 },
      { id: "members", header: t.table.roleColumns.members, cell: (r) => String((r.members ?? []).length), sortable: true, sortValue: (r) => (r.members ?? []).length, width: 38 },
      { id: "modules", header: t.table.roleColumns.modules, cell: (r) => (r.modules ?? []).join(", ") || "—", width: 170, defaultHidden: true },
      { id: "description", header: t.table.roleColumns.description, cell: (r) => r.description ?? "—", width: 200, defaultHidden: true },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tokens],
  );
  const roleFilters: ServerFilter<ServerRole>[] = useMemo(
    () => [
      { id: "search", kind: "search", placeholder: t.table.filters.searchRole, match: (r, q) => r.name.toLowerCase().includes(q) },
      {
        id: "kind",
        kind: "select",
        placeholder: t.table.filters.groupKind,
        options: [
          { value: "user", label: t.filterValues.kindUser },
          { value: "system", label: t.filterValues.kindSystem },
        ],
        match: (r, v) => (v === "system" ? r.kind === "system" : r.kind !== "system"),
      },
    ],
    [t],
  );
  const roleRowActions: ServerRowAction[] = useMemo(
    () => [
      { id: "edit", label: t.table.roleRowActions.editPermissions, icon: <TablerEdit size={18} /> },
      { id: "delete", label: t.table.roleRowActions.delete, icon: <TablerTrash size={18} />, danger: true },
    ],
    [t],
  );

  const tabs = [
    { key: "users", label: t.tabs.users, count: users.length },
    { key: "groups", label: t.tabs.groups, count: roles.length },
  ];

  const action =
    tab === "users"
      ? { label: t.buttons.newUser, icon: <TablerUserPlus size={16} />, onPress: () => setUserDialog({ mode: "create" }) }
      : { label: t.buttons.newGroup, icon: <TablerPlus size={16} />, onPress: () => setRoleDialog({ mode: "create" }) };

  return (
    <>
      <ServerModuleScreen
        title={t.pageTitle}
        subtitle={t.subtitle}
        onBack={onBack}
        contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 44 }}
        showExtras={false}
        renderHeader={({ onSettings, onClose, guarded }) => <UsersModuleHeader tabs={tabs} activeTab={tab} onTabChange={setTab} action={action} onPlans={() => setPlansOpen(true)} onSettings={onSettings} onClose={onClose} guarded={guarded} />}
        settingsPages={[
          {key:"summary",get label() { return nativeText("Resumen"); },icon:<BarChart3 size={20} color={tokens.textMuted}/>,content:<View style={{gap:16}}><ModuleGrid columns={2}>{[["Usuarios",users.length],["Bloqueados",users.filter(user=>user.enabled===false).length],["Conexiones",users.reduce((sum,user)=>sum+(online[user.username]??0),0)],["Roles",roles.length]].map(([label,value])=><View key={String(label)} style={{padding:14,borderWidth:1,borderColor:tokens.border,borderRadius:8,gap:8}}><Text style={{color:tokens.textMuted}}>{label}</Text><Text style={{color:tokens.textPrimary,fontSize:24}}>{value}</Text></View>)}</ModuleGrid><View style={{gap:8}}><Button label={nativeText("Actualizar resumen")} variant="secondary" loading={refreshing} onPress={()=>void onRefresh()}/><Button label={nativeText("Exportar usuarios")} variant="secondary" onPress={()=>void exportSummary("users")}/><Button label={nativeText("Exportar grupos")} variant="secondary" onPress={()=>void exportSummary("roles")}/></View></View>},
          {key:"access",get label() { return nativeText("Accesos"); },icon:<LogIn size={20} color={tokens.textMuted}/>,content:<View style={{gap:12}}>{users.filter(user=>!!online[user.username]||user.lastLogin).sort((a,b)=>(b.lastLogin??"").localeCompare(a.lastLogin??"")).slice(0,25).map(user=><View key={user.id} style={{gap:4,paddingVertical:10,borderBottomWidth:1,borderColor:tokens.border}}><Text style={{color:tokens.textPrimary}}>{user.username}</Text><Text style={{color:tokens.textMuted}}>{online[user.username]??0} {nativeText("conexiones ·")}{" "}{user.lastLogin?new Date(user.lastLogin).toLocaleString(language):"—"}</Text></View>)}<Button label={nativeText("Actualizar")} onPress={onRefresh}/></View>}
        ]}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        action={action}
        guardCode={guardCode}
        error={error}
        onRetry={onRefresh}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <ModuleTabPanel active={tab === "users"}>
          <ServerDataTable
            compact rowHeight={72} headerHeight={50} pageSizeOptions={PAGE_SIZES}
            settingsId="users" settingsIcon={<Users size={20} color={tokens.textMuted}/>} title={t.tabs.users}
            columns={userColumns}
            rows={users}
            rowKey={(u) => String(u.id)}
            filters={userFilters}
            rowActions={userRowActions}
            quickActions={userQuickActions}
            selectable
            loading={loading}
            onRowAction={onUserAction}
            onQuickAction={onUserQuickAction}
          />
        </ModuleTabPanel><ModuleTabPanel active={tab !== "users"}>
          <ServerDataTable
            compact rowHeight={48} headerHeight={34} pageSizeOptions={PAGE_SIZES}
            settingsId="roles" settingsIcon={<Shield size={20} color={tokens.textMuted}/>} title={t.tabs.groups}
            columns={roleColumns}
            rows={roles}
            rowKey={(r) => r.name}
            filters={roleFilters}
            rowActions={roleRowActions}
            quickActions={[{ id: "delete", label: t.table.roleQuickActions.deleteSelected, icon: <TablerTrash size={16} />, danger: true }]}
            selectable
            loading={loading}
            onRowAction={onRoleAction}
            onQuickAction={(actionId, rows) => {
              if (actionId === "delete" && rows.length > 0) {
                const applyBatch = createMutationBatch(rows, r => runServerMutation(panelId, token, () => callServerApi(panelId, token, "DELETE", `/api/roles/${encodeURIComponent(r.name)}`)), r => r.name);
                setConfirm({
                  title: t.confirm.deleteGroupTitle,
                  message: formatMessage(t.confirm.deleteUsers, { count: rows.length }),
                  onConfirm: async () => {
                    try { await applyBatch(); } catch (cause) { await load(); throw cause; }
                    showToast(t.toasts.groupDeleted);
                    await load();
                  },
                });
              }
            }}
          />
        </ModuleTabPanel>
      </ServerModuleScreen>

      {/* Modales */}
      <ModuleSettingsDrawer visible={plansOpen} onClose={() => setPlansOpen(false)} title={language.startsWith("es") ? nativeText("Planes de hosting") : nativeText("Hosting plans")} language={language}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
          <NativeHostingTools panelId={panelId} token={token} selectedId={null} section="plans" onSaved={() => void load()} />
          <NativeOperationCard embedded panelId={panelId} token={token} title={nativeText("Capacidades disponibles para planes")} readPath="/api/roles/templates/capabilities" />
        </ScrollView>
      </ModuleSettingsDrawer>
      {userDialog ? (
        <UserDialog visible mode={userDialog.mode} initial={userDialog.initial} roles={roles} onClose={() => setUserDialog(null)} onSave={saveUser} />
      ) : null}
      {roleDialog ? (
        <RoleDialog visible mode={roleDialog.mode} initial={roleDialog.initial} panelId={panelId} token={token} onClose={() => setRoleDialog(null)} onSave={saveRole} />
      ) : null}
      {changePwUser ? <ChangePwDialog panelId={panelId} token={token} user={changePwUser} onClose={() => setChangePwUser(null)} onToast={showToast} /> : null}
      {sshKeysUser ? <SshKeysDialog panelId={panelId} token={token} user={sshKeysUser} onClose={() => setSshKeysUser(null)} onToast={showToast} /> : null}
      {genKeyUser ? <GenKeyDialog panelId={panelId} token={token} user={genKeyUser} onClose={() => setGenKeyUser(null)} onToast={showToast} /> : null}

      {confirm ? (
        <ConfirmDialog
          visible
          title={confirm.title}
          message={confirm.message}
          confirmLabel={t.confirm.btnConfirm}
          cancelLabel={t.confirm.btnCancel}
          danger={confirm.danger ?? true}
          submitting={confirmBusy}
          error={confirmError ?? undefined}
          onConfirm={runConfirm}
          onCancel={() => { if (!confirmPending.current) setConfirm(null); }}
        />
      ) : null}

      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}
