/**
 * mail-manage — gestión POR CUENTA del módulo Correo extraída de
 * `MailScreen.tsx` (espejo del reparto de desktop): sub-pantalla con filtros
 * Sieve, autorespuesta, firmas, contactos, calendarios y carpetas IMAP. Los
 * diálogos viven en `mail-manage-dialogs.tsx`; `FilterDialog` se re-exporta
 * desde aquí porque lo reutiliza la sección de filtros globales de
 * `mail-settings`.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { ServerDataTable, type ServerColumn, type ServerFilter, type ServerRowAction } from "../../../components/server/ServerDataTable";
import { ConfirmDialog, Field, Checkbox, InfoBox } from "../../../components/server/Form";
import { pillColors } from "../../../components/server/badges";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import { TablerPlus, TablerEdit, TablerTrash, TablerDeviceFloppy } from "../../../features/app/tabler-icons";
import { serverMailApi, callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";
import {
  IconFilter, IconMessage, IconSignature, IconUser, IconFolder, IconCalendar,
} from "./mail-icons";
import { GUARDS } from "./mail-constants";
import {
  normFilters, normSignatures, normContacts,
  normCalendars, normManageFolders,
} from "./mail-normalizers";
import type {
  MailFilter, Autoresponder, Signature, MailAccount,
  Contact, ManageFolder, Calendar,
} from "./mail-types";
import {
  FilterDialog, SignatureDialog, ContactDialog, CalendarDialog,
  FolderDialog, FolderRenameDialog,
} from "./mail-manage-dialogs";

// Re-export: `mail-settings.tsx` importa `FilterDialog` desde este módulo.
export { FilterDialog } from "./mail-manage-dialogs";

const enc = encodeURIComponent;

// ═══════════════════════════════════════════════════════════════════════════
// Gestión POR CUENTA: Filtros (Sieve) · Autorespuesta (vacation) · Firmas.
// Sub-pantalla con su propio scaffold (ServerModuleScreen) y onBack al listado.
// ═══════════════════════════════════════════════════════════════════════════

export function AccountManageScreen({ panelId, token, account, onBack }: { panelId: string; token: string; account: MailAccount; onBack: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverMail;
  const m = t.manage;
  const accountId = String(account.id);

  const [tab, setTab] = useState<string>("filters");
  const [filters, setFilters] = useState<MailFilter[]>([]);
  const [auto, setAuto] = useState<Autoresponder | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [folders, setFolders] = useState<ManageFolder[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);

  const [filterDialog, setFilterDialog] = useState<{ mode: "create" | "edit"; row?: MailFilter } | null>(null);
  const [sigDialog, setSigDialog] = useState<{ mode: "create" | "edit"; row?: Signature } | null>(null);
  const [contactDialog, setContactDialog] = useState<{ mode: "create" | "edit"; row?: Contact } | null>(null);
  const [calendarDialog, setCalendarDialog] = useState<{ mode: "create" | "edit"; row?: Calendar } | null>(null);
  const [folderDialog, setFolderDialog] = useState<boolean>(false);
  const [folderRename, setFolderRename] = useState<ManageFolder | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "filter" | "auto" | "signature" | "contact" | "calendar" | "folder"; id?: string; name?: string; path?: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({ visible: false, variant: "success", message: "", nonce: 0 });
  const showToast = useCallback((message: string, err = false) => setToast((p) => ({ visible: true, variant: err ? "error" : "success", message, nonce: p.nonce + 1 })), []);

  const load = useCallback(async () => {
    const [fRes, aRes, sRes, cRes, calRes] = await Promise.all([
      serverMailApi.listFilters(panelId, token, accountId),
      callServerApi(panelId, token, "GET", `/api/accounts/${enc(accountId)}/autoresponder`),
      callServerApi(panelId, token, "GET", `/api/accounts/${enc(accountId)}/signatures`),
      callServerApi(panelId, token, "GET", `/api/accounts/${enc(accountId)}/contacts`),
      callServerApi(panelId, token, "GET", `/api/accounts/${enc(accountId)}/calendars`),
    ]);
    if (fRes.code && GUARDS.includes(fRes.code)) {
      setGuardCode(fRes.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    setFilters(normFilters(unwrap(fRes)));
    setAuto((unwrap<Autoresponder>(aRes) as Autoresponder | null) ?? null);
    setSignatures(normSignatures(unwrap(sRes)));
    setContacts(normContacts(unwrap(cRes)));
    setCalendars(normCalendars(unwrap(calRes)));
  }, [panelId, token, accountId]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  // Las carpetas IMAP requieren login al buzón (lento / puede fallar si no hay
  // contraseña capturada) → carga perezosa al entrar a su pestaña.
  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    setFoldersError(false);
    const res = await serverMailApi.listFolders(panelId, token, accountId);
    const data = unwrap(res);
    if (!res.ok || data == null) {
      setFoldersError(true);
      setFolders([]);
    } else {
      setFolders(normManageFolders(data));
    }
    setFoldersLoaded(true);
    setFoldersLoading(false);
  }, [panelId, token, accountId]);

  useEffect(() => {
    if (tab === "folders" && !foldersLoaded) void loadFolders();
  }, [tab, foldersLoaded, loadFolders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (tab === "folders") await loadFolders();
    setRefreshing(false);
  }, [load, loadFolders, tab]);

  const doConfirm = useCallback(async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    const op =
      confirm.kind === "filter"
        ? () => serverMailApi.deleteFilter(panelId, token, accountId, String(confirm.id))
        : confirm.kind === "signature"
          ? () => callServerApi(panelId, token, "DELETE", `/api/accounts/${enc(accountId)}/signatures/${enc(String(confirm.id))}`)
          : confirm.kind === "contact"
            ? () => callServerApi(panelId, token, "DELETE", `/api/accounts/${enc(accountId)}/contacts/${enc(String(confirm.id))}`)
            : confirm.kind === "calendar"
              ? () => callServerApi(panelId, token, "DELETE", `/api/accounts/${enc(accountId)}/calendars/${enc(String(confirm.id))}`)
              : confirm.kind === "folder"
                ? () => callServerApi(panelId, token, "DELETE", `/api/mail/${enc(accountId)}/folders?path=${enc(String(confirm.path))}`)
                : () => callServerApi(panelId, token, "DELETE", `/api/accounts/${enc(accountId)}/autoresponder`);
    const out = await runServerMutation(panelId, token, op);
    setConfirmBusy(false);
    if (out.ok) {
      showToast(
        confirm.kind === "filter"
          ? m.toasts.filterDeleted
          : confirm.kind === "signature"
            ? m.toasts.signatureDeleted
            : confirm.kind === "contact"
              ? m.contacts.tDeleted
              : confirm.kind === "calendar"
                ? m.calendars.tDeleted
                : confirm.kind === "folder"
                  ? m.folders.tDeleted
                  : m.toasts.autoDeleted,
      );
      if (confirm.kind === "folder") void loadFolders();
      else void load();
    } else throw new Error(out.error ?? m.toasts.error);
    setConfirm(null);
  }, [confirm, panelId, token, accountId, showToast, load, loadFolders, m.toasts, m.contacts, m.calendars, m.folders]);

  const enabledPill = (on: boolean) => {
    const c = pillColors(tokens, on ? "ok" : "neutral");
    return (
      <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
        <Text style={{ color: c.text, fontSize: 11 }}>{on ? m.filters.enabled : "—"}</Text>
      </View>
    );
  };

  const filterColumns: ServerColumn<MailFilter>[] = useMemo(
    () => [
      { id: "name", header: m.filters.colName, cell: (f) => f.name, sortable: true, sortValue: (f) => f.name, width: 180 },
      { id: "rules", header: m.filters.colRules, cell: (f) => String((f.rules ?? []).length), width: 100 },
      { id: "status", header: m.filters.colStatus, cell: (f) => enabledPill(f.enabled !== false), width: 100 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, tokens],
  );

  const signatureColumns: ServerColumn<Signature>[] = useMemo(
    () => [
      { id: "sender", header: m.signatures.colSender, cell: (s) => s.senderName || "—", width: 160 },
      { id: "email", header: m.signatures.colEmail, cell: (s) => s.senderEmail || "—", width: 200 },
      { id: "linked", header: m.signatures.colLinked, cell: (s) => (s.linkToSender ? m.signatures.linkedYes : "—"), width: 100 },
    ],
    [m],
  );

  const contactColumns: ServerColumn<Contact>[] = useMemo(
    () => [
      { id: "email", header: m.contacts.colEmail, cell: (c) => c.email, sortable: true, sortValue: (c) => c.email, width: 220 },
      { id: "name", header: m.contacts.colName, cell: (c) => c.displayName || "—", width: 160 },
      { id: "uses", header: m.contacts.colUses, cell: (c) => String(c.useCount), sortable: true, sortValue: (c) => c.useCount, width: 90 },
    ],
    [m],
  );

  const contactFilters: ServerFilter<Contact>[] = useMemo(
    () => [{ id: "search", kind: "search", placeholder: m.contacts.searchPlaceholder, match: (c, q) => c.email.toLowerCase().includes(q) || (c.displayName ?? "").toLowerCase().includes(q) }],
    [m],
  );

  const calendarName = (cal: Calendar) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: cal.color || "#3b82f6", borderWidth: 1, borderColor: tokens.border }} />
      <Text style={{ color: tokens.textSecondary, fontSize: 13 }} numberOfLines={1}>{cal.name}</Text>
    </View>
  );

  const calendarColumns: ServerColumn<Calendar>[] = useMemo(
    () => [
      { id: "name", header: m.calendars.colName, cell: (cal) => calendarName(cal), sortable: true, sortValue: (cal) => cal.name, width: 200 },
      { id: "timezone", header: m.calendars.colTimezone, cell: (cal) => cal.timezone || "—", width: 140 },
      { id: "status", header: m.calendars.colStatus, cell: (cal) => enabledPill(cal.enabled !== false), width: 100 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, tokens],
  );

  const folderTag = (f: ManageFolder) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={{ color: tokens.textSecondary, fontSize: 13 }} numberOfLines={1}>{f.name}</Text>
      {f.isProtected ? (
        <View style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: pillColors(tokens, "sky").bg, borderColor: pillColors(tokens, "sky").border }}>
          <Text style={{ color: pillColors(tokens, "sky").text, fontSize: 10 }}>{m.folders.protectedTag}</Text>
        </View>
      ) : null}
    </View>
  );

  const folderColumns: ServerColumn<ManageFolder>[] = useMemo(
    () => [
      { id: "name", header: m.folders.colName, cell: (f) => folderTag(f), width: 200 },
      { id: "path", header: m.folders.colPath, cell: (f) => f.path, width: 180 },
      { id: "messages", header: m.folders.colMessages, cell: (f) => String(f.messageCount), sortable: true, sortValue: (f) => f.messageCount, width: 100 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, tokens],
  );

  const rowActions = (edit: string, del: string): ServerRowAction[] => [
    { id: "edit", label: edit, icon: <TablerEdit size={18} /> },
    { id: "delete", label: del, icon: <TablerTrash size={18} />, danger: true },
  ];

  const folderActions: ServerRowAction[] = [
    { id: "rename", label: m.folders.rowRename, icon: <TablerEdit size={18} /> },
    { id: "delete", label: m.folders.rowDelete, icon: <TablerTrash size={18} />, danger: true },
  ];

  const tabs = [
    { key: "filters", label: m.tabFilters, icon: <IconFilter size={16} /> },
    { key: "autoresponder", label: m.tabAutoresponder, icon: <IconMessage size={16} /> },
    { key: "signatures", label: m.tabSignatures, icon: <IconSignature size={16} /> },
    { key: "contacts", label: m.tabContacts, icon: <IconUser size={16} /> },
    { key: "calendars", label: m.tabCalendars, icon: <IconCalendar size={16} /> },
    { key: "folders", label: m.tabFolders, icon: <IconFolder size={16} /> },
  ];

  const action =
    tab === "filters"
      ? { label: m.filters.new, icon: <TablerPlus size={16} />, onPress: () => setFilterDialog({ mode: "create" }) }
      : tab === "signatures"
        ? { label: m.signatures.new, icon: <TablerPlus size={16} />, onPress: () => setSigDialog({ mode: "create" }) }
        : tab === "contacts"
          ? { label: m.contacts.new, icon: <TablerPlus size={16} />, onPress: () => setContactDialog({ mode: "create" }) }
          : tab === "calendars"
            ? { label: m.calendars.new, icon: <TablerPlus size={16} />, onPress: () => setCalendarDialog({ mode: "create" }) }
            : tab === "folders"
              ? { label: m.folders.new, icon: <TablerPlus size={16} />, onPress: () => setFolderDialog(true) }
              : null;

  return (
    <>
      <ServerModuleScreen
        title={account.address}
        subtitle={m.subtitle}
        onBack={onBack}
        guardCode={guardCode}
        onRetry={onRefresh}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        {/* 5 pestañas: barra propia con scroll horizontal (la del scaffold no
            desplaza y se recortaría en pantallas estrechas). */}
        <SegmentedControl scroll items={tabs} value={tab} onChange={setTab} />
        {action ? (
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Button label={action.label} icon={action.icon} onPress={action.onPress} size="sm" />
          </View>
        ) : null}
        {tab === "filters" ? (
          <ServerDataTable
            title={m.filters.title}
            columns={filterColumns}
            rows={filters}
            rowKey={(f) => String(f.id)}
            rowActions={rowActions(m.filters.rowEdit, m.filters.rowDelete)}
            loading={loading}
            onRowAction={(id, row) => (id === "edit" ? setFilterDialog({ mode: "edit", row }) : setConfirm({ kind: "filter", id: String(row.id), name: row.name }))}
          />
        ) : tab === "signatures" ? (
          <ServerDataTable
            title={m.signatures.title}
            columns={signatureColumns}
            rows={signatures}
            rowKey={(s) => String(s.id)}
            rowActions={rowActions(m.signatures.rowEdit, m.signatures.rowDelete)}
            loading={loading}
            onRowAction={(id, row) => (id === "edit" ? setSigDialog({ mode: "edit", row }) : setConfirm({ kind: "signature", id: String(row.id) }))}
          />
        ) : tab === "contacts" ? (
          <ServerDataTable
            title={m.contacts.title}
            columns={contactColumns}
            rows={contacts}
            rowKey={(c) => String(c.id)}
            filters={contactFilters}
            rowActions={rowActions(m.contacts.rowEdit, m.contacts.rowDelete)}
            loading={loading}
            onRowAction={(id, row) => (id === "edit" ? setContactDialog({ mode: "edit", row }) : setConfirm({ kind: "contact", id: String(row.id), name: row.email }))}
          />
        ) : tab === "calendars" ? (
          <ServerDataTable
            title={m.calendars.title}
            columns={calendarColumns}
            rows={calendars}
            rowKey={(cal) => String(cal.id)}
            rowActions={rowActions(m.calendars.rowEdit, m.calendars.rowDelete)}
            loading={loading}
            onRowAction={(id, row) => (id === "edit" ? setCalendarDialog({ mode: "edit", row }) : setConfirm({ kind: "calendar", id: String(row.id), name: row.name }))}
          />
        ) : tab === "folders" ? (
          foldersError ? (
            <InfoBox tone="warn">{m.folders.loadError}</InfoBox>
          ) : (
            <ServerDataTable
              title={m.folders.title}
              columns={folderColumns}
              rows={folders}
              rowKey={(f) => f.path}
              rowActions={folderActions}
              loading={foldersLoading}
              onRowAction={(id, row) => {
                if (row.isProtected) {
                  showToast(m.folders.protectedError, true);
                  return;
                }
                if (id === "rename") setFolderRename(row);
                else setConfirm({ kind: "folder", path: row.path, name: row.name });
              }}
            />
          )
        ) : (
          <AutoresponderForm
            panelId={panelId}
            token={token}
            account={account}
            current={auto}
            loading={loading}
            onSaved={() => {
              showToast(m.toasts.autoSaved);
              void load();
            }}
            onDelete={() => setConfirm({ kind: "auto" })}
            onError={(msg) => showToast(msg ?? m.toasts.error, true)}
          />
        )}
      </ServerModuleScreen>

      {filterDialog ? (
        <FilterDialog
          panelId={panelId}
          token={token}
          accountId={accountId}
          mode={filterDialog.mode}
          row={filterDialog.row}
          onClose={() => setFilterDialog(null)}
          onSaved={(created) => {
            setFilterDialog(null);
            showToast(created ? m.toasts.filterCreated : m.toasts.filterUpdated);
            void load();
          }}
          onError={(msg) => showToast(msg ?? m.toasts.error, true)}
        />
      ) : null}

      {sigDialog ? (
        <SignatureDialog
          panelId={panelId}
          token={token}
          accountId={accountId}
          account={account}
          mode={sigDialog.mode}
          row={sigDialog.row}
          onClose={() => setSigDialog(null)}
          onSaved={(created) => {
            setSigDialog(null);
            showToast(created ? m.toasts.signatureCreated : m.toasts.signatureUpdated);
            void load();
          }}
          onError={(msg) => showToast(msg ?? m.toasts.error, true)}
        />
      ) : null}

      {contactDialog ? (
        <ContactDialog
          panelId={panelId}
          token={token}
          accountId={accountId}
          mode={contactDialog.mode}
          row={contactDialog.row}
          onClose={() => setContactDialog(null)}
          onSaved={(created) => {
            setContactDialog(null);
            showToast(created ? m.contacts.tCreated : m.contacts.tUpdated);
            void load();
          }}
          onError={(msg) => showToast(msg ?? m.toasts.error, true)}
        />
      ) : null}

      {calendarDialog ? (
        <CalendarDialog
          panelId={panelId}
          token={token}
          accountId={accountId}
          mode={calendarDialog.mode}
          row={calendarDialog.row}
          onClose={() => setCalendarDialog(null)}
          onSaved={(created) => {
            setCalendarDialog(null);
            showToast(created ? m.calendars.tCreated : m.calendars.tUpdated);
            void load();
          }}
          onError={(msg) => showToast(msg ?? m.toasts.error, true)}
        />
      ) : null}

      {folderDialog ? (
        <FolderDialog
          panelId={panelId}
          token={token}
          accountId={accountId}
          folders={folders}
          onClose={() => setFolderDialog(false)}
          onSaved={() => {
            setFolderDialog(false);
            showToast(m.folders.tCreated);
            void loadFolders();
          }}
          onError={(msg) => showToast(msg ?? m.toasts.error, true)}
        />
      ) : null}

      {folderRename ? (
        <FolderRenameDialog
          panelId={panelId}
          token={token}
          accountId={accountId}
          folder={folderRename}
          onClose={() => setFolderRename(null)}
          onSaved={() => {
            setFolderRename(null);
            showToast(m.folders.tRenamed);
            void loadFolders();
          }}
          onError={(msg) => showToast(msg ?? m.toasts.error, true)}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          visible
          title={
            confirm.kind === "filter"
              ? m.filters.deleteTitle
              : confirm.kind === "signature"
                ? m.signatures.deleteTitle
                : confirm.kind === "contact"
                  ? m.contacts.deleteTitle
                  : confirm.kind === "calendar"
                    ? m.calendars.deleteTitle
                    : confirm.kind === "folder"
                      ? m.folders.deleteTitle
                      : m.autoresponder.deleteTitle
          }
          message={
            confirm.kind === "filter"
              ? formatMessage(m.filters.deleteMessage, { name: confirm.name ?? "" })
              : confirm.kind === "signature"
                ? m.signatures.deleteMessage
                : confirm.kind === "contact"
                  ? formatMessage(m.contacts.deleteMessage, { email: confirm.name ?? "" })
                  : confirm.kind === "calendar"
                    ? formatMessage(m.calendars.deleteMessage, { name: confirm.name ?? "" })
                    : confirm.kind === "folder"
                      ? formatMessage(m.folders.deleteMessage, { name: confirm.name ?? "" })
                      : m.autoresponder.deleteMessage
          }
          confirmLabel={
            confirm.kind === "filter"
              ? m.filters.deleteConfirm
              : confirm.kind === "signature"
                ? m.signatures.deleteConfirm
                : confirm.kind === "contact"
                  ? m.contacts.deleteConfirm
                  : confirm.kind === "calendar"
                    ? m.calendars.deleteConfirm
                    : confirm.kind === "folder"
                      ? m.folders.deleteConfirm
                      : m.autoresponder.deleteConfirm
          }
          cancelLabel={m.filters.cancel}
          submitting={confirmBusy}
          onConfirm={doConfirm}
          onCancel={() => setConfirm(null)}
        />
      ) : null}

      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}

/** Formulario de autorespuesta (upsert único por cuenta). */
function AutoresponderForm({
  panelId,
  token,
  account,
  current,
  loading,
  onSaved,
  onDelete,
  onError,
}: {
  panelId: string;
  token: string;
  account: MailAccount;
  current: Autoresponder | null;
  loading: boolean;
  onSaved: () => void;
  onDelete: () => void;
  onError: (msg?: string) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const m = getMessages(language).serverMail.manage;
  const ar = m.autoresponder;

  // Deriva local-part/dominio de la dirección (el backend exige el dominio registrado).
  const [localPart, domainPart] = useMemo(() => {
    const at = account.address.indexOf("@");
    return at > 0 ? [account.address.slice(0, at), account.address.slice(at + 1)] : [account.address, ""];
  }, [account.address]);

  const [enabled, setEnabled] = useState(current?.enabled !== false);
  const [subject, setSubject] = useState(current?.subject ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const [interval, setIntervalH] = useState(current?.intervalHours != null ? String(current.intervalHours) : "24");
  const [fromName, setFromName] = useState(current?.fromName ?? "");
  const [busy, setBusy] = useState(false);
  const exists = !!current;

  // Re-sincroniza al cambiar la autorespuesta cargada (recarga tras guardar).
  useEffect(() => {
    setEnabled(current?.enabled !== false);
    setSubject(current?.subject ?? "");
    setBody(current?.body ?? "");
    setIntervalH(current?.intervalHours != null ? String(current.intervalHours) : "24");
    setFromName(current?.fromName ?? "");
  }, [current]);

  const submit = async () => {
    if (!subject.trim()) {
      onError(ar.errSubject);
      return;
    }
    if (!body.trim()) {
      onError(ar.errBody);
      return;
    }
    setBusy(true);
    const payload = {
      enabled,
      charset: current?.charset?.trim() || "utf-8",
      intervalHours: Number(interval) || 24,
      localPart: (current?.localPart || localPart).toLowerCase(),
      domain: (current?.domain || domainPart).toLowerCase(),
      fromName: fromName.trim() || null,
      subject: subject.trim(),
      body,
      isHtml: current?.isHtml === true,
    };
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", `/api/accounts/${enc(String(account.id))}/autoresponder`, payload));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };

  if (loading) {
    return (
      <View style={{ paddingVertical: 28 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ height: 12, width: `${85 - i * 12}%`, borderRadius: 6, backgroundColor: withAlpha(tokens.textMuted, 0.18), marginVertical: 6 }} />
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: 4 }}>
      <InfoBox>{exists ? ar.intro : ar.none}</InfoBox>
      <Checkbox value={enabled} onChange={setEnabled} label={ar.labelEnabled} />
      <View style={{ height: 10 }} />
      <Field label={ar.labelFor}>
        <Input value={account.address} editable={false} />
      </Field>
      <Field label={ar.labelSubject}>
        <Input value={subject} onChangeText={setSubject} placeholder={ar.placeholderSubject} />
      </Field>
      <Field label={ar.labelBody}>
        <Input value={body} onChangeText={setBody} multiline style={{ minHeight: 110 }} placeholder={ar.placeholderBody} />
      </Field>
      <Field label={ar.labelFromName}>
        <Input value={fromName ?? ""} onChangeText={setFromName} placeholder={ar.placeholderFromName} />
      </Field>
      <Field label={ar.labelInterval} hint={ar.intervalHint}>
        <Input value={interval} onChangeText={setIntervalH} keyboardType="number-pad" placeholder="24" />
      </Field>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button label={ar.save} icon={<TablerDeviceFloppy size={16} />} onPress={submit} loading={busy} style={{ flex: 1 }} />
        {exists ? <Button label={ar.delete} variant="danger" icon={<TablerTrash size={16} />} onPress={onDelete} style={{ flex: 1 }} /> : null}
      </View>
    </View>
  );
}
