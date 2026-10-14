import { nativeText } from '../../../i18n/native-text';
import { ModuleTabPanel } from "../../../components/server/ModuleLayouts";
import { useWorkspaceModuleTab } from "../../main/use-workspace-module-tab";
/**
 * MailScreen — réplica nativa del módulo Correo (mail) de LUXIPANEL: tab Cuentas
 * con tabla (dirección/dominio/cuota-uso/estado) + crear/editar/eliminar +
 * diálogo de reenvíos; y un tab Bandeja COMPLETO: selector de cuenta/carpeta,
 * lista de mensajes, ABRIR mensaje (detalle from/asunto/fecha/cuerpo vía
 * `fetchMessage` por uid) y REDACTAR/RESPONDER (compose → `send`). Sobre el
 * gateway (`serverMailApi` + `callServerApi` para el detalle sin wrapper).
 *
 * Este archivo es la FACHADA/orquestador del módulo: los diálogos de cuenta y
 * bandeja viven en `mail-ui.tsx`, la gestión por cuenta (filtros/autorespuesta/
 * firmas/contactos/calendarios/carpetas) en `mail-manage.tsx` y los ajustes de
 * dominio/servidor en `mail-settings.tsx` (espejo del reparto de desktop).
 * Los helpers sin estado siguen en mail-{types,constants,format,normalizers,icons}.
 */
import { useLiveModuleData } from "../../../lib/use-live-module-data";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { ServerDataTable, type ServerColumn, type ServerFilter, type ServerRowAction } from "../../../components/server/ServerDataTable";
import { ConfirmDialog, Field, InfoBox } from "../../../components/server/Form";
import { pillColors } from "../../../components/server/badges";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import { TablerMail, TablerInbox, TablerPlus, TablerEdit, TablerArrowForward, TablerTrash } from "../../../features/app/tabler-icons";
import { serverMailApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";
import { IconPencil, IconCog } from "./mail-icons";
import { GUARDS } from "./mail-constants";
import { fmtUsage, fmtDate } from "./mail-format";
import { normFolders, normMessages } from "./mail-normalizers";
import type { MailAccount, MailFolder, MailMessage, ComposeSeed } from "./mail-types";
import { AccountDialog, ForwardsDialog, MessageDialog, ComposeDialog } from "./mail-ui";
import { AccountManageScreen } from "./mail-manage";
import { ModuleSettingsDrawer } from "../../../components/ui/ModuleSettingsDrawer";
import { MailSettingsScreen } from "./mail-settings";

const enc = encodeURIComponent;

export function MailScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverMail;

  const [tab, setTab] = useWorkspaceModuleTab<string>("accounts");
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => { if (tab === "settings") { setSettingsOpen(true); setTab("accounts"); } }, [tab, setTab]);
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

  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({ visible: false, variant: "success", message: "", nonce: 0 });
  const showToast = useCallback((message: string, err = false) => setToast((p) => ({ visible: true, variant: err ? "error" : "success", message, nonce: p.nonce + 1 })), []);

  const load = useCallback(async () => {
    const res = await serverMailApi.listAccounts(panelId, token);
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    if (!res.ok) return;
    setGuardCode(null);
    setAccounts(unwrap<MailAccount[]>(res) ?? []);
  }, [panelId, token]);

  useLiveModuleData(panelId, ["mail/accounts"], load);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Carga perezosa de la bandeja al entrar al tab (o cambiar de carpeta/cuenta).
  const loadInbox = useCallback(async () => {
    if (!inboxAccount) return;
    setInboxLoading(true);
    try {
      const id = String(inboxAccount.id);
      const [fRes, mRes] = await Promise.all([
        serverMailApi.listFolders(panelId, token, id),
        serverMailApi.listMessages(panelId, token, id, `?folder=${enc(folder)}&limit=50`),
      ]);
      const fl = normFolders(unwrap(fRes));
      if (fl.length) setFolders(fl);
      setMessages(normMessages(unwrap(mRes)));
    } finally {
      setInboxLoading(false);
    }
  }, [panelId, token, inboxAccount, folder]);

  useEffect(() => {
    if (tab === "inbox" && inboxAccount) void loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, inboxAccount, folder]);

  const doDelete = useCallback(async () => {
    if (!confirmDel) return;
    setConfirmBusy(true);
    try {
    const out = await runServerMutation(panelId, token, () => serverMailApi.deleteAccount(panelId, token, String(confirmDel.id)));
    if (out.ok) {
      showToast(t.toasts.deleted);
      void load();
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirmDel(null);
    setConfirmBusy(false);
    } finally { setConfirmBusy(false); }
  }, [confirmDel, panelId, token, showToast, load, t.toasts]);

  // ── Tablas ───────────────────────────────────────────────────────────────
  const statusPill = (on: boolean) => {
    const c = pillColors(tokens, on ? "ok" : "neutral");
    return (
      <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
        <Text style={{ color: c.text, fontSize: 11, fontWeight: "500" }}>{on ? t.accounts.statusActive : t.accounts.statusInactive}</Text>
      </View>
    );
  };

  const accountColumns: ServerColumn<MailAccount>[] = useMemo(
    () => [
      { id: "address", header: t.accounts.colAddress, cell: (a) => a.address, sortable: true, sortValue: (a) => a.address, width: 200 },
      { id: "domain", header: t.accounts.colDomain, cell: (a) => a.domain ?? (a.address.includes("@") ? a.address.split("@")[1] : "—"), width: 140 },
      { id: "usage", header: t.accounts.colUsage, cell: (a) => fmtUsage(a, t.accounts.usageUnlimited), sortable: true, sortValue: (a) => a.usedMb ?? a.used ?? 0, width: 140 },
      { id: "status", header: t.accounts.colStatus, cell: (a) => statusPill(a.enabled !== false), width: 110 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tokens],
  );

  const accountFilters: ServerFilter<MailAccount>[] = useMemo(
    () => [
      { id: "search", kind: "search", placeholder: t.accounts.searchPlaceholder, match: (a, q) => a.address.toLowerCase().includes(q) || (a.domain ?? "").toLowerCase().includes(q) },
      {
        id: "status",
        kind: "select",
        placeholder: t.accounts.filterStatus,
        options: [
          { value: "active", label: t.accounts.statusActive },
          { value: "inactive", label: t.accounts.statusInactive },
        ],
        match: (a, v) => (v === "active" ? a.enabled !== false : a.enabled === false),
      },
    ],
    [t],
  );

  const accountRowActions: ServerRowAction[] = useMemo(
    () => [
      { id: "edit", label: t.accounts.rowEdit, icon: <TablerEdit size={18} /> },
      { id: "forwards", label: t.accounts.rowForwards, icon: <TablerArrowForward size={18} /> },
      { id: "manage", label: t.manage.rowAction, icon: <IconCog size={18} /> },
      { id: "delete", label: t.accounts.rowDelete, icon: <TablerTrash size={18} />, danger: true },
    ],
    [t],
  );

  const messageColumns: ServerColumn<MailMessage>[] = useMemo(
    () => [
      { id: "from", header: t.inbox.colFrom, cell: (m) => m.from, width: 170 },
      { id: "subject", header: t.inbox.colSubject, cell: (m) => m.subject, width: 220 },
      { id: "date", header: t.inbox.colDate, cell: (m) => fmtDate(m.date), width: 150 },
    ],
    [t],
  );

  const tabs = [
    { key: "accounts", label: t.tabs.accounts, icon: <TablerMail size={16} /> },
    { key: "inbox", label: t.tabs.inbox, icon: <TablerInbox size={16} /> },

  ];

  // Sub-navegador: gestión POR CUENTA (filtros / autorespuesta / firmas).
  if (manageAccount) {
    return <AccountManageScreen panelId={panelId} token={token} account={manageAccount} onBack={() => setManageAccount(null)} />;
  }

  return (
    <>
      <ServerModuleScreen
        title={t.pageTitle}
        subtitle={t.subtitle}
        onBack={onBack}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        action={
          tab === "accounts"
            ? { label: t.newAccount, icon: <TablerPlus size={16} />, onPress: () => setAccountDialog({ mode: "create" }) }
            : tab === "inbox" && inboxAccount
              ? { label: t.compose.action, icon: <IconPencil size={16} />, onPress: () => setCompose({ fromId: String(inboxAccount.id) }) }
              : null
        }
        guardCode={guardCode}
        onRetry={onRefresh}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <MailSettingsScreen panelId={panelId} token={token} showToast={showToast} />
        <ModuleTabPanel active={tab === "accounts"}>
          <ServerDataTable
            settingsBulkActions settingsId="accounts" title={t.accounts.title}
            columns={accountColumns}
            rows={accounts}
            rowKey={(a) => String(a.id ?? a.address)}
            filters={accountFilters}
            rowActions={accountRowActions}
            loading={loading}
            onRowAction={(id, row) => {
              if (id === "edit") setAccountDialog({ mode: "edit", row });
              else if (id === "forwards") setForwardsAccount(row);
              else if (id === "manage") setManageAccount(row);
              else if (id === "delete") setConfirmDel(row);
            }}
          />
        </ModuleTabPanel>
        {tab === "inbox" ? (!inboxAccount ? (
          <InfoBox>{t.inbox.noAccount}</InfoBox>
        ) : (
          <View style={{ gap: 12 }}>
            <InfoBox>{t.inbox.hint}</InfoBox>
            <Field label={t.inbox.account}>
              <Input value={inboxAccount.address} editable={false} />
            </Field>
            <Field label={t.inbox.folder}>
              <Select
                value={folder}
                options={(folders.length ? folders : [{ label: nativeText("INBOX"), value: "INBOX" }]).map((f) => ({ value: f.value, label: f.label }))}
                onChange={setFolder}
              />
            </Field>
            <ServerDataTable
              title={t.inbox.title}
              columns={messageColumns}
              rows={messages}
              rowKey={(m) => m.key}
              loading={inboxLoading}
              onRowPress={(m) => {
                if (m.uid) setOpenMsg(m);
                else showToast(t.detail.loadError, true);
              }}
            />
          </View>
        )) : null}
      </ServerModuleScreen>


      {accountDialog ? (
        <AccountDialog
          panelId={panelId}
          token={token}
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
          panelId={panelId}
          token={token}
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
        <ConfirmDialog
          visible
          title={t.confirm.deleteTitle}
          message={formatMessage(t.confirm.deleteMessage, { address: confirmDel.address })}
          confirmLabel={t.confirm.confirm}
          cancelLabel={t.confirm.cancel}
          submitting={confirmBusy}
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(null)}
        />
      ) : null}

      {openMsg && inboxAccount ? (
        <MessageDialog
          panelId={panelId}
          token={token}
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
          panelId={panelId}
          token={token}
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

      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}
