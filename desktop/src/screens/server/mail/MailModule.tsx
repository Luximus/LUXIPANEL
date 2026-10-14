/**
 * MailModule (desktop) — pantalla NATIVA del módulo Correo (mail) de un servidor
 * standalone (conexión DIRECTA por `serverApi`). Port React DOM COMPLETO de
 * `app/src/screens/server/mail/MailScreen.tsx` (+ hermanos), conservando estilos
 * (Tailwind + daisyUI + lucide-react), i18n (`getMessages(...).serverMail`) y
 * contrato (`serverMailApi` + `callServerApi`, token `""` en modo directo).
 *
 * Paridad con app:
 *  - Tab Cuentas: tabla (dirección/dominio/cuota-uso/estado) + crear/editar/
 *    eliminar + diálogo de reenvíos + "Administrar cuenta".
 *  - Tab Bandeja: selector de carpeta, lista de mensajes (DataTable), abrir un
 *    mensaje (detalle vía `fetchMessage` por uid) y Redactar/Responder (`send`).
 *  - Tab Ajustes: spam · enrutamiento · reenvíos de dominio · dirección por
 *    defecto · archivado · cifrado PGP · filtros globales (`mail-settings`).
 *  - Administrar cuenta: filtros Sieve · autorespuesta · firmas · contactos ·
 *    calendarios · carpetas IMAP (`mail-manage`).
 * NO incluye MB de facturación (retirado); la cuota de buzón (disco real) sí.
 */
import { useLiveModuleData } from "../../../lib/use-live-module-data";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Inbox, Mail, Pencil, Plus, RefreshCw, Reply, Settings, Trash2 } from "lucide-react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableRowActionConfig,
} from "../../../components/DataTable";
import { useToast } from "../../../components/ToastProvider";
import { serverMailApi, callServerApi, unwrap, type GatewayGuardCode } from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";
import { GUARDS } from "./mail-constants";
import { addressEmail, fmtDate, fmtUsage, splitEmails } from "./mail-format";
import { normFolders, normMessages, normForwards, normFullMessage } from "./mail-normalizers";
import type { MailAccount, MailFolder, MailMessage, FullMessage, ComposeSeed } from "./mail-types";
import { Modal, DialogFooter, Field, TextInput, TextArea, SelectInput, CheckboxRow, InfoBox, Pill, runServerMutation } from "./mail-ui";
import { AccountManageScreen } from "./mail-manage";
import { MailSettingsScreen } from "./mail-settings";

const enc = encodeURIComponent;
type MainTab = "accounts" | "inbox" | "settings";

// Fila plana para el DataTable de cuentas.
type AccountRow = { id: string; address: string; domain: string; used: number; usage: string; status: string; search: string; raw: MailAccount };
type MessageRow = { id: string; from: string; subject: string; date: string; raw: MailMessage };

export function MailModule({ serverId, language }: ModuleProps) {
  const t = getMessages(language).serverMail;
  const c = getMessages(language).common;
  const toast = useToast();
  const showToast = useCallback((msg: string, err?: boolean) => (err ? toast.error(msg) : toast.success(msg)), [toast]);

  const [tab, setTab] = useState<MainTab>("accounts");
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);

  const [accountDialog, setAccountDialog] = useState<{ mode: "create" | "edit"; row?: MailAccount } | null>(null);
  const [forwardsAccount, setForwardsAccount] = useState<MailAccount | null>(null);
  const [manageAccount, setManageAccount] = useState<MailAccount | null>(null);
  const [confirmDel, setConfirmDel] = useState<MailAccount | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Bandeja (read-only) — usa la 1ª cuenta.
  const inboxAccount = useMemo(() => accounts[0] ?? null, [accounts]);
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [folder, setFolder] = useState("INBOX");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [openMsg, setOpenMsg] = useState<MailMessage | null>(null);
  const [compose, setCompose] = useState<ComposeSeed | null>(null);

  const load = useCallback(async () => {
    const res = await serverMailApi.listAccounts(serverId, "");
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    if (!res.ok) return;
    setGuardCode(null);
    setAccounts(unwrap<MailAccount[]>(res) ?? []);
  }, [serverId]);

  useLiveModuleData(serverId, ["mail/accounts"], load);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const loadInbox = useCallback(async () => {
    if (!inboxAccount) return;
    setInboxLoading(true);
    try {
      const id = String(inboxAccount.id);
      const [fRes, mRes] = await Promise.all([
        serverMailApi.listFolders(serverId, "", id),
        serverMailApi.listMessages(serverId, "", id, `?folder=${enc(folder)}&limit=50`),
      ]);
      const fl = normFolders(unwrap(fRes));
      if (fl.length) setFolders(fl);
      setMessages(normMessages(unwrap(mRes)));
    } finally {
      setInboxLoading(false);
    }
  }, [serverId, inboxAccount, folder]);

  useEffect(() => {
    if (tab === "inbox" && inboxAccount) void loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, inboxAccount, folder]);

  const doDelete = useCallback(async () => {
    if (!confirmDel) return;
    setConfirmBusy(true);
    const out = await runServerMutation(serverId, () => serverMailApi.deleteAccount(serverId, "", String(confirmDel.id)));
    setConfirmBusy(false);
    if (out.ok) {
      showToast(t.toasts.deleted);
      void load();
    } else showToast(out.error ?? t.toasts.error, true);
    setConfirmDel(null);
  }, [confirmDel, serverId, showToast, load, t.toasts]);

  // ── Cuentas: filas + columnas ──────────────────────────────────────────────
  const accountRows = useMemo<AccountRow[]>(
    () =>
      accounts.map((a) => {
        const domain = a.domain ?? (a.address.includes("@") ? a.address.split("@")[1] : "—");
        return {
          id: String(a.id ?? a.address),
          address: a.address,
          domain,
          used: a.used ?? 0,
          usage: fmtUsage(a, t.accounts.usageUnlimited),
          status: a.enabled !== false ? "active" : "inactive",
          search: `${a.address} ${domain}`.toLowerCase(),
          raw: a,
        };
      }),
    [accounts, t.accounts.usageUnlimited],
  );
  const accountColumns = useMemo<DataTableColumnConfig<AccountRow>[]>(
    () => [
      { id: "address", header: t.accounts.colAddress, accessorKey: "address", sortable: true },
      { id: "domain", header: t.accounts.colDomain, accessorKey: "domain" },
      { id: "usage", header: t.accounts.colUsage, accessorKey: "used", sortable: true, cell: (a) => a.usage },
      {
        id: "status",
        header: t.accounts.colStatus,
        accessorKey: "status",
        cell: (a) => <Pill tone={a.status === "active" ? "ok" : "neutral"}>{a.status === "active" ? t.accounts.statusActive : t.accounts.statusInactive}</Pill>,
      },
    ],
    [t.accounts],
  );
  const accountFilters = useMemo<DataTableFilterConfig<AccountRow>[]>(
    () => [
      { id: "search", label: t.accounts.searchPlaceholder, accessorKey: "search", type: "text" },
      {
        id: "status",
        label: t.accounts.filterStatus,
        accessorKey: "status",
        type: "select",
        options: [
          { value: "active", label: t.accounts.statusActive },
          { value: "inactive", label: t.accounts.statusInactive },
        ],
      },
    ],
    [t.accounts],
  );
  const accountActions = useMemo<DataTableRowActionConfig<AccountRow>[]>(
    () => [
      { id: "edit", label: t.accounts.rowEdit },
      { id: "forwards", label: t.accounts.rowForwards },
      { id: "manage", label: t.manage.rowAction },
      { id: "delete", label: t.accounts.rowDelete, variant: "danger" },
    ],
    [t.accounts, t.manage],
  );

  const messageRows = useMemo<MessageRow[]>(
    () => messages.map((mm) => ({ id: mm.key, from: mm.from, subject: mm.subject, date: fmtDate(mm.date), raw: mm })),
    [messages],
  );
  const messageColumns = useMemo<DataTableColumnConfig<MessageRow>[]>(
    () => [
      { id: "from", header: t.inbox.colFrom, accessorKey: "from" },
      { id: "subject", header: t.inbox.colSubject, accessorKey: "subject" },
      { id: "date", header: t.inbox.colDate, accessorKey: "date" },
    ],
    [t.inbox],
  );

  // ── Sub-pantalla: administrar cuenta ───────────────────────────────────────
  if (manageAccount) {
    return <AccountManageScreen serverId={serverId} account={manageAccount} language={language} onBack={() => setManageAccount(null)} />;
  }

  const tabs: { key: MainTab; label: string; icon: ReactNode }[] = [
    { key: "accounts", label: t.tabs.accounts, icon: <Mail size={14} /> },
    { key: "inbox", label: t.tabs.inbox, icon: <Inbox size={14} /> },
    { key: "settings", label: t.settings.tab, icon: <Settings size={14} /> },
  ];

  if (guardCode) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.pageTitle}</h2>
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm text-error">{t.pageTitle}</p>
          <p className="font-mono text-xs text-base-content/50">{guardCode}</p>
          <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => void onRefresh()}>
            <RefreshCw size={14} /> {c.refresh}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera + acción de tab + refrescar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-semibold">{t.pageTitle}</h2>
          <p className="text-xs text-base-content/60">{t.subtitle}</p>
        </div>
        {tab === "accounts" ? (
          <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setAccountDialog({ mode: "create" })}>
            <Plus size={14} /> {t.newAccount}
          </button>
        ) : tab === "inbox" && inboxAccount ? (
          <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setCompose({ fromId: String(inboxAccount.id) })}>
            <Pencil size={14} /> {t.compose.action}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {c.refresh}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            className={`btn btn-sm shrink-0 gap-1 ${tab === tb.key ? "btn-primary" : "btn-ghost border border-base-300"}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "accounts" ? (
        <DataTable<AccountRow>
          tableId="mail-accounts"
          title={t.accounts.title}
          data={accountRows}
          columns={accountColumns}
          filters={accountFilters}
          rowActions={accountActions}
          language={language}
          loading={loading}
          onRowAction={(id, row) => {
            if (id === "edit") setAccountDialog({ mode: "edit", row: row.raw });
            else if (id === "forwards") setForwardsAccount(row.raw);
            else if (id === "manage") setManageAccount(row.raw);
            else if (id === "delete") setConfirmDel(row.raw);
          }}
        />
      ) : tab === "settings" ? (
        <MailSettingsScreen serverId={serverId} language={language} />
      ) : !inboxAccount ? (
        <InfoBox>{t.inbox.noAccount}</InfoBox>
      ) : (
        <div className="flex flex-col gap-3">
          <InfoBox>{t.inbox.hint}</InfoBox>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t.inbox.account}>
              <TextInput value={inboxAccount.address} />
            </Field>
            <Field label={t.inbox.folder}>
              <SelectInput
                value={folder}
                options={(folders.length ? folders : [{ label: "INBOX", value: "INBOX" }]).map((f) => ({ value: f.value, label: f.label }))}
                onChange={setFolder}
              />
            </Field>
          </div>
          <DataTable<MessageRow>
            tableId="mail-inbox"
            title={t.inbox.title}
            data={messageRows}
            columns={messageColumns}
            rowActions={[{ id: "open", label: t.detail.title }]}
            language={language}
            loading={inboxLoading}
            onRowAction={(_id, row) => {
              if (row.raw.uid) setOpenMsg(row.raw);
              else showToast(t.detail.loadError, true);
            }}
          />
        </div>
      )}

      {accountDialog ? (
        <AccountDialog
          serverId={serverId}
          language={language}
          mode={accountDialog.mode}
          row={accountDialog.row}
          onClose={() => setAccountDialog(null)}
          onSaved={(created) => {
            setAccountDialog(null);
            showToast(created ? t.toasts.created : t.toasts.updated);
            void load();
          }}
          onError={(msg) => showToast(msg ?? t.toasts.error, true)}
        />
      ) : null}

      {forwardsAccount ? (
        <ForwardsDialog
          serverId={serverId}
          language={language}
          account={forwardsAccount}
          onClose={() => setForwardsAccount(null)}
          onSaved={() => {
            setForwardsAccount(null);
            showToast(t.toasts.forwardsSaved);
          }}
          onError={(msg) => showToast(msg ?? t.toasts.error, true)}
        />
      ) : null}

      {confirmDel ? (
        <Modal
          title={t.confirm.deleteTitle}
          onClose={() => setConfirmDel(null)}
          maxWidth="max-w-sm"
          footer={<DialogFooter onCancel={() => setConfirmDel(null)} cancelLabel={t.confirm.cancel} onSubmit={() => void doDelete()} submitLabel={t.confirm.confirm} submitting={confirmBusy} danger />}
        >
          <p className="text-sm text-base-content/80">{formatMessage(t.confirm.deleteMessage, { address: confirmDel.address })}</p>
        </Modal>
      ) : null}

      {openMsg && inboxAccount ? (
        <MessageDialog
          serverId={serverId}
          language={language}
          accountId={String(inboxAccount.id)}
          folder={folder}
          message={openMsg}
          onClose={() => setOpenMsg(null)}
          onReply={(seed) => {
            setOpenMsg(null);
            setCompose({ fromId: String(inboxAccount.id), ...seed });
          }}
        />
      ) : null}

      {compose && inboxAccount ? (
        <ComposeDialog
          serverId={serverId}
          language={language}
          accounts={accounts}
          seed={compose}
          onClose={() => setCompose(null)}
          onSent={() => {
            setCompose(null);
            showToast(t.toasts.sent);
          }}
          onError={(msg) => showToast(msg ?? t.toasts.error, true)}
        />
      ) : null}
    </div>
  );
}

// ── Diálogo crear/editar cuenta ──────────────────────────────────────────────
function AccountDialog({
  serverId,
  language,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  language?: string;
  mode: "create" | "edit";
  row?: MailAccount;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
}) {
  const t = getMessages(language).serverMail;
  const isCreate = mode === "create";
  const [address, setAddress] = useState(row?.address ?? "");
  const [password, setPassword] = useState("");
  const [quota, setQuota] = useState(row?.quota != null ? String(row.quota) : "0");
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const quotaNum = Number(quota) || 0;
    const op =
      !isCreate && row
        ? () => serverMailApi.updateAccount(serverId, "", String(row.id), { quota: quotaNum, enabled })
        : () => serverMailApi.createAccount(serverId, "", { address: address.trim(), password, quota: quotaNum, enabled });
    const out = await runServerMutation(serverId, op);
    setBusy(false);
    if (out.ok) onSaved(isCreate);
    else onError(out.error);
  };

  return (
    <Modal
      title={isCreate ? t.dialog.createTitle : t.dialog.editTitle}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.dialog.cancel} onSubmit={() => void submit()} submitLabel={isCreate ? t.dialog.create : t.dialog.save} submitting={busy} disabled={isCreate && !address.trim()} />}
    >
      <Field label={t.dialog.labelAddress}>
        <TextInput value={address} onChange={isCreate ? setAddress : undefined} placeholder={t.dialog.placeholderAddress} />
      </Field>
      {isCreate ? (
        <Field label={t.dialog.labelPassword}>
          <TextInput value={password} onChange={setPassword} type="password" placeholder={t.dialog.placeholderPassword} />
        </Field>
      ) : null}
      <Field label={t.dialog.labelQuota} hint={t.dialog.quotaHint}>
        <TextInput value={quota} onChange={setQuota} type="number" placeholder="0" />
      </Field>
      <CheckboxRow checked={enabled} onChange={setEnabled} label={t.dialog.labelEnabled} />
    </Modal>
  );
}

// ── Diálogo de reenvíos por cuenta ───────────────────────────────────────────
function ForwardsDialog({
  serverId,
  language,
  account,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  language?: string;
  account: MailAccount;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg?: string) => void;
}) {
  const t = getMessages(language).serverMail;
  const [dests, setDests] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await serverMailApi.listForwards(serverId, "", String(account.id));
      if (!alive) return;
      setDests(normForwards(unwrap(res)));
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [serverId, account.id]);

  const submit = async () => {
    setBusy(true);
    const forwards = dests.map((d) => d.trim()).filter(Boolean);
    const out = await runServerMutation(serverId, () => serverMailApi.setForwards(serverId, "", String(account.id), { forwards }));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };

  return (
    <Modal
      title={t.forwards.title}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.forwards.close} onSubmit={() => void submit()} submitLabel={t.forwards.save} submitting={busy} disabled={!loaded} />}
    >
      <InfoBox>{`${account.address}\n${t.forwards.intro}`}</InfoBox>
      {dests.length === 0 ? <p className="text-xs text-base-content/50">{t.forwards.empty}</p> : null}
      {dests.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <TextInput value={d} onChange={(v) => setDests((prev) => prev.map((x, j) => (j === i ? v : x)))} placeholder={t.forwards.placeholder} />
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={() => setDests((prev) => prev.filter((_, j) => j !== i))}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm w-fit gap-1" onClick={() => setDests((prev) => [...prev, ""])}>
        <Plus size={14} /> {t.forwards.add}
      </button>
    </Modal>
  );
}

// ── Detalle de un mensaje ────────────────────────────────────────────────────
function MessageDialog({
  serverId,
  language,
  accountId,
  folder,
  message,
  onClose,
  onReply,
}: {
  serverId: string;
  language?: string;
  accountId: string;
  folder: string;
  message: MailMessage;
  onClose: () => void;
  onReply: (seed: ComposeSeed) => void;
}) {
  const t = getMessages(language).serverMail;
  const [full, setFull] = useState<FullMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(serverId, "", "GET", `/api/mail/${enc(accountId)}/messages/${enc(message.uid)}?folder=${enc(folder)}`);
      if (!alive) return;
      const data = unwrap<Record<string, unknown>>(res);
      if (!res.ok || !data) {
        setError(true);
        setLoading(false);
        return;
      }
      setFull(normFullMessage(data));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [serverId, accountId, folder, message.uid]);

  const fromText = full?.from || message.from;
  const subjectText = (full?.subject || message.subject || "").trim() || t.detail.noSubject;
  const dateText = fmtDate(full?.date || message.date);

  const replySeed = (): ComposeSeed => {
    const subj = (full?.subject || message.subject || "").trim();
    return { to: addressEmail(fromText), subject: subj && /^re:/i.test(subj) ? subj : `${t.detail.replyPrefix} ${subj}`.trim() };
  };

  const metaRow = (label: string, value: string) => (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 text-xs font-semibold text-base-content/50">{label}</span>
      <span className="flex-1 select-text text-[13px] text-base-content/80">{value || "—"}</span>
    </div>
  );

  return (
    <Modal
      title={t.detail.title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t.detail.close}
          </button>
          <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => onReply(replySeed())} disabled={loading || error}>
            <Reply size={14} /> {t.detail.reply}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-3 py-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 rounded bg-base-content/15" style={{ width: `${85 - i * 12}%` }} />
          ))}
        </div>
      ) : error ? (
        <InfoBox tone="danger">{t.detail.loadError}</InfoBox>
      ) : (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-base font-bold">{subjectText}</h4>
          {metaRow(t.detail.from, fromText)}
          {full?.to ? metaRow(t.detail.to, full.to) : null}
          {metaRow(t.detail.date, dateText)}
          {full && full.attachments > 0 ? (
            <span className="text-xs text-base-content/50">{formatMessage(t.detail.attachments, { count: full.attachments })}</span>
          ) : null}
          <div className="my-1 h-px bg-base-300" />
          <p className="whitespace-pre-line select-text text-sm leading-relaxed text-base-content/80">{full?.body ? full.body : t.detail.emptyBody}</p>
        </div>
      )}
    </Modal>
  );
}

// ── Redactar / Responder ─────────────────────────────────────────────────────
function ComposeDialog({
  serverId,
  language,
  accounts,
  seed,
  onClose,
  onSent,
  onError,
}: {
  serverId: string;
  language?: string;
  accounts: MailAccount[];
  seed: ComposeSeed;
  onClose: () => void;
  onSent: () => void;
  onError: (msg?: string) => void;
}) {
  const t = getMessages(language).serverMail;
  const [fromId, setFromId] = useState(seed.fromId ?? (accounts[0] ? String(accounts[0].id) : ""));
  const [to, setTo] = useState(seed.to ?? "");
  const [cc, setCc] = useState(seed.cc ?? "");
  const [showCc, setShowCc] = useState(!!seed.cc);
  const [subject, setSubject] = useState(seed.subject ?? "");
  const [body, setBody] = useState(seed.body ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const toList = splitEmails(to);
    if (!toList.length) return onError(t.compose.errNoTo);
    const ccList = splitEmails(cc);
    setBusy(true);
    const payload = { to: toList, subject: subject.trim(), text: body, ...(ccList.length ? { cc: ccList } : {}) };
    const out = await runServerMutation(serverId, () => serverMailApi.send(serverId, "", fromId, payload));
    setBusy(false);
    if (out.ok) onSent();
    else onError(out.error);
  };

  const fromOptions = accounts.map((a) => ({ value: String(a.id), label: a.address }));

  return (
    <Modal
      title={seed.subject ? t.compose.replyTitle : t.compose.title}
      onClose={onClose}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.compose.cancel} onSubmit={() => void submit()} submitLabel={t.compose.send} submitting={busy} disabled={!fromId || !to.trim()} />}
    >
      <Field label={t.compose.labelFrom}>
        {fromOptions.length > 1 ? <SelectInput value={fromId} options={fromOptions} onChange={setFromId} /> : <TextInput value={fromOptions[0]?.label ?? ""} />}
      </Field>
      <Field label={t.compose.labelTo} hint={t.compose.hintTo}>
        <TextInput value={to} onChange={setTo} placeholder={t.compose.placeholderTo} />
      </Field>
      {showCc ? (
        <Field label={t.compose.labelCc}>
          <TextInput value={cc} onChange={setCc} placeholder={t.compose.placeholderTo} />
        </Field>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm w-fit gap-1" onClick={() => setShowCc(true)}>
          <Plus size={14} /> {t.compose.toggleCc}
        </button>
      )}
      <Field label={t.compose.labelSubject}>
        <TextInput value={subject} onChange={setSubject} placeholder={t.compose.placeholderSubject} />
      </Field>
      <Field label={t.compose.labelBody}>
        <TextArea value={body} onChange={setBody} placeholder={t.compose.placeholderBody} rows={6} />
      </Field>
    </Modal>
  );
}
