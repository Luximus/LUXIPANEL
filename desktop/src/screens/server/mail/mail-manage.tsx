/**
 * mail-manage (desktop) — gestión POR CUENTA del módulo Correo: Filtros (Sieve),
 * Autorespuesta (vacation), Firmas, Contactos, Calendarios y Carpetas IMAP.
 * Port React DOM de `AccountManageScreen` + sus diálogos de
 * `app/src/screens/server/mail/MailScreen.tsx`. `FilterDialog` se exporta para
 * reutilizarse en los filtros globales (tab Ajustes).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Calendar,
  Filter,
  Folder,
  MessageSquare,
  Plus,
  RefreshCw,
  Signature,
  Trash2,
  User,
} from "lucide-react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableRowActionConfig,
} from "../../../components/DataTable";
import { useConfirm } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ToastProvider";
import { serverMailApi, callServerApi, unwrap, type GatewayGuardCode } from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import { GUARDS, FILTER_PARTS, FILTER_MATCHES, FILTER_ACTIONS, ACTION_NEEDS_VALUE } from "./mail-constants";
import { normRules, normActions, normFilters, normSignatures, normManageFolders, normContacts, normCalendars } from "./mail-normalizers";
import type {
  MailAccount,
  MailFilter,
  Autoresponder,
  Signature as MailSignature,
  Contact,
  Calendar as MailCalendar,
  ManageFolder,
  FilterRule,
  FilterAction,
} from "./mail-types";
import {
  Modal,
  DialogFooter,
  Field,
  TextInput,
  SelectInput,
  CheckboxRow,
  InfoBox,
  Pill,
  SegTabs,
  runServerMutation,
} from "./mail-ui";
import {
  AutoresponderForm,
  SignatureDialog,
  ContactDialog,
  CalendarDialog,
  FolderDialog,
  FolderRenameDialog,
} from "./mail-manage-dialogs";

const enc = encodeURIComponent;
type ShowToast = (message: string, err?: boolean) => void;

// ── Filas planas para el DataTable de desktop ────────────────────────────────
type FilterRow = { id: string; name: string; rules: number; enabled: boolean; raw: MailFilter };
type SignatureRow = { id: string; sender: string; email: string; linked: string; raw: MailSignature };
type ContactRow = { id: string; email: string; name: string; uses: number; search: string; raw: Contact };
type CalendarRow = { id: string; name: string; color: string; timezone: string; enabled: boolean; raw: MailCalendar };
type FolderRow = { id: string; name: string; path: string; messages: number; isProtected: boolean; raw: ManageFolder };

type ManageTab = "filters" | "autoresponder" | "signatures" | "contacts" | "calendars" | "folders";

export function AccountManageScreen({
  serverId,
  account,
  language,
  onBack,
}: {
  serverId: string;
  account: MailAccount;
  language?: string;
  onBack: () => void;
}) {
  const root = getMessages(language).serverMail;
  const m = root.manage;
  const c = getMessages(language).common;
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const showToast: ShowToast = useCallback((msg, err) => (err ? toast.error(msg) : toast.success(msg)), [toast]);
  const accountId = String(account.id);

  const [tab, setTab] = useState<ManageTab>("filters");
  const [filters, setFilters] = useState<MailFilter[]>([]);
  const [auto, setAuto] = useState<Autoresponder | null>(null);
  const [signatures, setSignatures] = useState<MailSignature[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [calendars, setCalendars] = useState<MailCalendar[]>([]);
  const [folders, setFolders] = useState<ManageFolder[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);

  const [filterDialog, setFilterDialog] = useState<{ mode: "create" | "edit"; row?: MailFilter } | null>(null);
  const [sigDialog, setSigDialog] = useState<{ mode: "create" | "edit"; row?: MailSignature } | null>(null);
  const [contactDialog, setContactDialog] = useState<{ mode: "create" | "edit"; row?: Contact } | null>(null);
  const [calendarDialog, setCalendarDialog] = useState<{ mode: "create" | "edit"; row?: MailCalendar } | null>(null);
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderRename, setFolderRename] = useState<ManageFolder | null>(null);

  const load = useCallback(async () => {
    const [fRes, aRes, sRes, cRes, calRes] = await Promise.all([
      serverMailApi.listFilters(serverId, "", accountId),
      callServerApi(serverId, "", "GET", `/api/accounts/${enc(accountId)}/autoresponder`),
      callServerApi(serverId, "", "GET", `/api/accounts/${enc(accountId)}/signatures`),
      callServerApi(serverId, "", "GET", `/api/accounts/${enc(accountId)}/contacts`),
      callServerApi(serverId, "", "GET", `/api/accounts/${enc(accountId)}/calendars`),
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
  }, [serverId, accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    setFoldersError(false);
    const res = await serverMailApi.listFolders(serverId, "", accountId);
    const data = unwrap(res);
    if (!res.ok || data == null) {
      setFoldersError(true);
      setFolders([]);
    } else {
      setFolders(normManageFolders(data));
    }
    setFoldersLoaded(true);
    setFoldersLoading(false);
  }, [serverId, accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    if (tab === "folders" && !foldersLoaded) void loadFolders();
  }, [tab, foldersLoaded, loadFolders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (tab === "folders") await loadFolders();
    setRefreshing(false);
  }, [load, loadFolders, tab]);

  // ── Confirmaciones de borrado ──────────────────────────────────────────────
  const doDelete = useCallback(
    async (kind: "filter" | "auto" | "signature" | "contact" | "calendar" | "folder", target: { id?: string; path?: string }) => {
      const op =
        kind === "filter"
          ? () => serverMailApi.deleteFilter(serverId, "", accountId, String(target.id))
          : kind === "signature"
            ? () => callServerApi(serverId, "", "DELETE", `/api/accounts/${enc(accountId)}/signatures/${enc(String(target.id))}`)
            : kind === "contact"
              ? () => callServerApi(serverId, "", "DELETE", `/api/accounts/${enc(accountId)}/contacts/${enc(String(target.id))}`)
              : kind === "calendar"
                ? () => callServerApi(serverId, "", "DELETE", `/api/accounts/${enc(accountId)}/calendars/${enc(String(target.id))}`)
                : kind === "folder"
                  ? () => callServerApi(serverId, "", "DELETE", `/api/mail/${enc(accountId)}/folders?path=${enc(String(target.path))}`)
                  : () => callServerApi(serverId, "", "DELETE", `/api/accounts/${enc(accountId)}/autoresponder`);
      const out = await runServerMutation(serverId, op);
      if (out.ok) {
        showToast(
          kind === "filter"
            ? m.toasts.filterDeleted
            : kind === "signature"
              ? m.toasts.signatureDeleted
              : kind === "contact"
                ? m.contacts.tDeleted
                : kind === "calendar"
                  ? m.calendars.tDeleted
                  : kind === "folder"
                    ? m.folders.tDeleted
                    : m.toasts.autoDeleted,
        );
        if (kind === "folder") void loadFolders();
        else void load();
      } else showToast(out.error ?? m.toasts.error, true);
    },
    [serverId, accountId, showToast, load, loadFolders, m],
  );

  const confirmDelete = useCallback(
    async (
      kind: "filter" | "signature" | "contact" | "calendar" | "folder",
      target: { id?: string; path?: string; name?: string },
    ) => {
      const cfg = {
        filter: { title: m.filters.deleteTitle, message: formatMessage(m.filters.deleteMessage, { name: target.name ?? "" }), confirmLabel: m.filters.deleteConfirm },
        signature: { title: m.signatures.deleteTitle, message: m.signatures.deleteMessage, confirmLabel: m.signatures.deleteConfirm },
        contact: { title: m.contacts.deleteTitle, message: formatMessage(m.contacts.deleteMessage, { email: target.name ?? "" }), confirmLabel: m.contacts.deleteConfirm },
        calendar: { title: m.calendars.deleteTitle, message: formatMessage(m.calendars.deleteMessage, { name: target.name ?? "" }), confirmLabel: m.calendars.deleteConfirm },
        folder: { title: m.folders.deleteTitle, message: formatMessage(m.folders.deleteMessage, { name: target.name ?? "" }), confirmLabel: m.folders.deleteConfirm },
      }[kind];
      const ok = await confirm({ title: cfg.title, message: cfg.message, confirmLabel: cfg.confirmLabel, cancelLabel: m.filters.cancel, danger: true });
      if (ok) void doDelete(kind, target);
    },
    [confirm, doDelete, m],
  );

  // ── Columnas / filas ───────────────────────────────────────────────────────
  const filterRows = useMemo<FilterRow[]>(
    () => filters.map((f) => ({ id: String(f.id), name: f.name, rules: (f.rules ?? []).length, enabled: f.enabled !== false, raw: f })),
    [filters],
  );
  const filterColumns = useMemo<DataTableColumnConfig<FilterRow>[]>(
    () => [
      { id: "name", header: m.filters.colName, accessorKey: "name", sortable: true },
      { id: "rules", header: m.filters.colRules, accessorKey: "rules" },
      { id: "status", header: m.filters.colStatus, accessorKey: "enabled", cell: (f) => (f.enabled ? <Pill tone="ok">{m.filters.enabled}</Pill> : <span className="text-base-content/40">—</span>) },
    ],
    [m],
  );

  const signatureRows = useMemo<SignatureRow[]>(
    () => signatures.map((s) => ({ id: String(s.id), sender: s.senderName || "—", email: s.senderEmail || "—", linked: s.linkToSender ? m.signatures.linkedYes : "—", raw: s })),
    [signatures, m],
  );
  const signatureColumns = useMemo<DataTableColumnConfig<SignatureRow>[]>(
    () => [
      { id: "sender", header: m.signatures.colSender, accessorKey: "sender" },
      { id: "email", header: m.signatures.colEmail, accessorKey: "email" },
      { id: "linked", header: m.signatures.colLinked, accessorKey: "linked" },
    ],
    [m],
  );

  const contactRows = useMemo<ContactRow[]>(
    () => contacts.map((ct) => ({ id: String(ct.id), email: ct.email, name: ct.displayName || "—", uses: ct.useCount, search: `${ct.email} ${ct.displayName ?? ""}`.toLowerCase(), raw: ct })),
    [contacts],
  );
  const contactColumns = useMemo<DataTableColumnConfig<ContactRow>[]>(
    () => [
      { id: "email", header: m.contacts.colEmail, accessorKey: "email", sortable: true },
      { id: "name", header: m.contacts.colName, accessorKey: "name" },
      { id: "uses", header: m.contacts.colUses, accessorKey: "uses", sortable: true },
    ],
    [m],
  );
  const contactFilters = useMemo<DataTableFilterConfig<ContactRow>[]>(
    () => [{ id: "search", label: m.contacts.searchPlaceholder, accessorKey: "search", type: "text" }],
    [m],
  );

  const calendarRows = useMemo<CalendarRow[]>(
    () => calendars.map((cal) => ({ id: String(cal.id), name: cal.name, color: cal.color, timezone: cal.timezone || "—", enabled: cal.enabled !== false, raw: cal })),
    [calendars],
  );
  const calendarColumns = useMemo<DataTableColumnConfig<CalendarRow>[]>(
    () => [
      {
        id: "name",
        header: m.calendars.colName,
        accessorKey: "name",
        sortable: true,
        cell: (cal) => (
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full border border-base-300" style={{ backgroundColor: cal.color || "#3b82f6" }} />
            <span className="truncate">{cal.name}</span>
          </span>
        ),
      },
      { id: "timezone", header: m.calendars.colTimezone, accessorKey: "timezone" },
      { id: "status", header: m.calendars.colStatus, accessorKey: "enabled", cell: (cal) => (cal.enabled ? <Pill tone="ok">{m.filters.enabled}</Pill> : <span className="text-base-content/40">—</span>) },
    ],
    [m],
  );

  const folderRows = useMemo<FolderRow[]>(
    () => folders.map((f) => ({ id: f.path, name: f.name, path: f.path, messages: f.messageCount, isProtected: f.isProtected, raw: f })),
    [folders],
  );
  const folderColumns = useMemo<DataTableColumnConfig<FolderRow>[]>(
    () => [
      {
        id: "name",
        header: m.folders.colName,
        accessorKey: "name",
        cell: (f) => (
          <span className="flex items-center gap-1.5">
            <span className="truncate">{f.name}</span>
            {f.isProtected ? <Pill tone="sky">{m.folders.protectedTag}</Pill> : null}
          </span>
        ),
      },
      { id: "path", header: m.folders.colPath, accessorKey: "path" },
      { id: "messages", header: m.folders.colMessages, accessorKey: "messages", sortable: true },
    ],
    [m],
  );

  const tabs: { key: ManageTab; label: string; icon: ReactNode }[] = [
    { key: "filters", label: m.tabFilters, icon: <Filter size={14} /> },
    { key: "autoresponder", label: m.tabAutoresponder, icon: <MessageSquare size={14} /> },
    { key: "signatures", label: m.tabSignatures, icon: <Signature size={14} /> },
    { key: "contacts", label: m.tabContacts, icon: <User size={14} /> },
    { key: "calendars", label: m.tabCalendars, icon: <Calendar size={14} /> },
    { key: "folders", label: m.tabFolders, icon: <Folder size={14} /> },
  ];

  const action =
    tab === "filters"
      ? { label: m.filters.new, onClick: () => setFilterDialog({ mode: "create" }) }
      : tab === "signatures"
        ? { label: m.signatures.new, onClick: () => setSigDialog({ mode: "create" }) }
        : tab === "contacts"
          ? { label: m.contacts.new, onClick: () => setContactDialog({ mode: "create" }) }
          : tab === "calendars"
            ? { label: m.calendars.new, onClick: () => setCalendarDialog({ mode: "create" }) }
            : tab === "folders"
              ? { label: m.folders.new, onClick: () => setFolderDialog(true) }
              : null;

  if (guardCode) {
    return (
      <div className="flex flex-col gap-4">
        <BackHeader title={account.address} subtitle={m.subtitle} onBack={onBack} onRefresh={onRefresh} refreshing={refreshing} refreshLabel={c.refresh} />
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm text-error">{root.pageTitle}</p>
          <p className="font-mono text-xs text-base-content/50">{guardCode}</p>
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BackHeader title={account.address} subtitle={m.subtitle} onBack={onBack} onRefresh={onRefresh} refreshing={refreshing} refreshLabel={c.refresh} />

      <SegTabs items={tabs} value={tab} onChange={setTab} />
      {action ? (
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={action.onClick}>
            <Plus size={14} /> {action.label}
          </button>
        </div>
      ) : null}

      {tab === "filters" ? (
        <DataTable<FilterRow>
          tableId="mail-filters"
          title={m.filters.title}
          data={filterRows}
          columns={filterColumns}
          rowActions={rowActionsFor(m.filters.rowEdit, m.filters.rowDelete)}
          language={language}
          loading={loading}
          onRowAction={(id, row) => (id === "edit" ? setFilterDialog({ mode: "edit", row: row.raw }) : void confirmDelete("filter", { id: row.id, name: row.name }))}
        />
      ) : tab === "signatures" ? (
        <DataTable<SignatureRow>
          tableId="mail-signatures"
          title={m.signatures.title}
          data={signatureRows}
          columns={signatureColumns}
          rowActions={rowActionsFor(m.signatures.rowEdit, m.signatures.rowDelete)}
          language={language}
          loading={loading}
          onRowAction={(id, row) => (id === "edit" ? setSigDialog({ mode: "edit", row: row.raw }) : void confirmDelete("signature", { id: row.id }))}
        />
      ) : tab === "contacts" ? (
        <DataTable<ContactRow>
          tableId="mail-contacts"
          title={m.contacts.title}
          data={contactRows}
          columns={contactColumns}
          filters={contactFilters}
          rowActions={rowActionsFor(m.contacts.rowEdit, m.contacts.rowDelete)}
          language={language}
          loading={loading}
          onRowAction={(id, row) => (id === "edit" ? setContactDialog({ mode: "edit", row: row.raw }) : void confirmDelete("contact", { id: row.id, name: row.email }))}
        />
      ) : tab === "calendars" ? (
        <DataTable<CalendarRow>
          tableId="mail-calendars"
          title={m.calendars.title}
          data={calendarRows}
          columns={calendarColumns}
          rowActions={rowActionsFor(m.calendars.rowEdit, m.calendars.rowDelete)}
          language={language}
          loading={loading}
          onRowAction={(id, row) => (id === "edit" ? setCalendarDialog({ mode: "edit", row: row.raw }) : void confirmDelete("calendar", { id: row.id, name: row.name }))}
        />
      ) : tab === "folders" ? (
        foldersError ? (
          <InfoBox tone="warn">{m.folders.loadError}</InfoBox>
        ) : (
          <DataTable<FolderRow>
            tableId="mail-folders"
            title={m.folders.title}
            data={folderRows}
            columns={folderColumns}
            rowActions={[
              { id: "rename", label: m.folders.rowRename },
              { id: "delete", label: m.folders.rowDelete, variant: "danger" },
            ]}
            language={language}
            loading={foldersLoading}
            onRowAction={(id, row) => {
              if (row.isProtected) {
                showToast(m.folders.protectedError, true);
                return;
              }
              if (id === "rename") setFolderRename(row.raw);
              else void confirmDelete("folder", { path: row.path, name: row.name });
            }}
          />
        )
      ) : (
        <AutoresponderForm
          serverId={serverId}
          account={account}
          language={language}
          current={auto}
          loading={loading}
          onSaved={() => {
            showToast(m.toasts.autoSaved);
            void load();
          }}
          onDelete={async () => {
            const ok = await confirm({ title: m.autoresponder.deleteTitle, message: m.autoresponder.deleteMessage, confirmLabel: m.autoresponder.deleteConfirm, cancelLabel: m.filters.cancel, danger: true });
            if (ok) void doDelete("auto", {});
          }}
          onError={(msg) => showToast(msg ?? m.toasts.error, true)}
        />
      )}

      {filterDialog ? (
        <FilterDialog
          serverId={serverId}
          accountId={accountId}
          language={language}
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
          serverId={serverId}
          accountId={accountId}
          account={account}
          language={language}
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
          serverId={serverId}
          accountId={accountId}
          language={language}
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
          serverId={serverId}
          accountId={accountId}
          language={language}
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
          serverId={serverId}
          accountId={accountId}
          language={language}
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
          serverId={serverId}
          accountId={accountId}
          language={language}
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

      {dialog}
    </div>
  );
}

// ── Cabecera con botón atrás ─────────────────────────────────────────────────
export function BackHeader({
  title,
  subtitle,
  onBack,
  onRefresh,
  refreshing,
  refreshLabel,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  refreshLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onBack} aria-label="back">
        <ArrowLeft size={18} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="truncate text-base font-semibold">{title}</h2>
        <p className="text-xs text-base-content/60">{subtitle}</p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
        {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {refreshLabel}
      </button>
    </div>
  );
}

function rowActionsFor<T extends Record<string, unknown>>(edit: string, del: string): DataTableRowActionConfig<T>[] {
  return [
    { id: "edit", label: edit },
    { id: "delete", label: del, variant: "danger" },
  ];
}

// ── Diálogo de filtro Sieve (exportado para filtros globales) ────────────────
export function FilterDialog({
  serverId,
  accountId,
  language,
  mode,
  row,
  onClose,
  onSaved,
  onError,
  customSubmit,
}: {
  serverId: string;
  accountId: string;
  language?: string;
  mode: "create" | "edit";
  row?: MailFilter;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
  customSubmit?: (payload: { name: string; enabled: boolean; rules: unknown[]; actions: unknown[] }) => ReturnType<typeof callServerApi>;
}) {
  const f = getMessages(language).serverMail.manage.filters;
  const isCreate = mode === "create";
  const [name, setName] = useState(row?.name ?? "");
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [rules, setRules] = useState<FilterRule[]>(() => {
    const r = normRules(row?.rules);
    return r.length ? r : [{ part: "from", match: "contains", value: "" }];
  });
  const [actions, setActions] = useState<FilterAction[]>(() => {
    const a = normActions(row?.actions);
    return a.length ? a : [{ type: "deliver_to_folder", value: "" }];
  });
  const [busy, setBusy] = useState(false);

  const partOptions = FILTER_PARTS.map((p) => ({ value: p, label: f.parts[p] }));
  const matchOptions = FILTER_MATCHES.map((mm) => ({ value: mm, label: f.matches[mm] }));
  const actionOptions = FILTER_ACTIONS.map((a) => ({ value: a, label: f.actionLabels[a] }));
  const joinOptions = [
    { value: "and", label: f.joinAnd },
    { value: "or", label: f.joinOr },
  ];
  const actionPlaceholder = (type: string): string =>
    type === "deliver_to_folder" ? f.folderPlaceholder : type === "redirect" ? f.redirectPlaceholder : type === "pipe" ? f.pipePlaceholder : f.failPlaceholder;

  const submit = async () => {
    if (!name.trim()) return onError(f.errName);
    const cleanRules = rules
      .map((r, i) => ({ part: r.part, match: r.match, value: r.value ?? "", ...(i > 0 ? { joinWithPrevious: r.joinWithPrevious === "or" ? "or" : "and" } : {}) }))
      .filter((r) => FILTER_PARTS.includes(r.part as (typeof FILTER_PARTS)[number]));
    if (!cleanRules.length) return onError(f.errRules);
    const cleanActions = actions
      .filter((a) => FILTER_ACTIONS.includes(a.type as (typeof FILTER_ACTIONS)[number]))
      .map((a) => (ACTION_NEEDS_VALUE.has(a.type) ? { type: a.type, value: (a.value ?? "").trim() } : { type: a.type }));
    if (!cleanActions.length) return onError(f.errActions);
    setBusy(true);
    const payload = { name: name.trim(), enabled, rules: cleanRules, actions: cleanActions };
    const op = customSubmit
      ? () => customSubmit(payload)
      : !isCreate && row
        ? () => serverMailApi.updateFilter(serverId, "", accountId, String(row.id), payload)
        : () => serverMailApi.createFilter(serverId, "", accountId, payload);
    const out = await runServerMutation(serverId, op);
    setBusy(false);
    if (out.ok) onSaved(isCreate);
    else onError(out.error);
  };

  return (
    <Modal
      title={isCreate ? f.createTitle : f.editTitle}
      onClose={onClose}
      footer={<DialogFooter onCancel={onClose} cancelLabel={f.cancel} onSubmit={() => void submit()} submitLabel={isCreate ? f.create : f.save} submitting={busy} disabled={!name.trim()} />}
    >
      <Field label={f.labelName}>
        <TextInput value={name} onChange={setName} placeholder={f.placeholderName} />
      </Field>
      <CheckboxRow checked={enabled} onChange={setEnabled} label={f.labelEnabled} />

      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-bold">{f.rulesTitle}</span>
        <span className="text-[11px] text-base-content/50">{f.rulesHint}</span>
      </div>
      {rules.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-base-300 p-2.5">
          {i > 0 ? (
            <SelectInput value={r.joinWithPrevious ?? "and"} options={joinOptions} onChange={(v) => setRules((prev) => prev.map((x, j) => (j === i ? { ...x, joinWithPrevious: v === "or" ? "or" : "and" } : x)))} />
          ) : null}
          <SelectInput value={r.part} options={partOptions} onChange={(v) => setRules((prev) => prev.map((x, j) => (j === i ? { ...x, part: v } : x)))} />
          <SelectInput value={r.match} options={matchOptions} onChange={(v) => setRules((prev) => prev.map((x, j) => (j === i ? { ...x, match: v } : x)))} />
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <TextInput value={r.value} onChange={(v) => setRules((prev) => prev.map((x, j) => (j === i ? { ...x, value: v } : x)))} placeholder={f.ruleValuePlaceholder} />
            </div>
            {rules.length > 1 ? (
              <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm w-fit gap-1" onClick={() => setRules((prev) => [...prev, { part: "from", match: "contains", value: "", joinWithPrevious: "and" }])}>
        <Plus size={14} /> {f.addRule}
      </button>

      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-bold">{f.actionsTitle}</span>
        <span className="text-[11px] text-base-content/50">{f.actionsHint}</span>
      </div>
      {actions.map((a, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-base-300 p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SelectInput value={a.type} options={actionOptions} onChange={(v) => setActions((prev) => prev.map((x, j) => (j === i ? { ...x, type: v } : x)))} />
            </div>
            {actions.length > 1 ? (
              <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => setActions((prev) => prev.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
          {ACTION_NEEDS_VALUE.has(a.type) ? (
            <TextInput value={a.value ?? ""} onChange={(v) => setActions((prev) => prev.map((x, j) => (j === i ? { ...x, value: v } : x)))} placeholder={actionPlaceholder(a.type)} />
          ) : null}
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm w-fit gap-1" onClick={() => setActions((prev) => [...prev, { type: "deliver_to_folder", value: "" }])}>
        <Plus size={14} /> {f.addAction}
      </button>
    </Modal>
  );
}
