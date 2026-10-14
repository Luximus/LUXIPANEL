import { nativeText } from '../../../i18n/native-text';
import { FormDrawer } from "../../../components/ui/FormDrawer";
import { ModuleTabPanel } from "../../../components/server/ModuleLayouts";
import { useWorkspaceModuleTab } from "../../main/use-workspace-module-tab";
/**
 * ServerAlertsScreen — réplica nativa del módulo Notificaciones (server-alerts):
 * preferencias (push owner), enviar notificación, notificaciones programadas
 * (CRUD) y reglas de métrica (CRUD). Sobre el gateway (`serverAlertsApi`).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { ServerDataTable, type ServerColumn, type ServerRowAction } from "../../../components/server/ServerDataTable";
import { ConfirmDialog, Field, Checkbox, DialogFooter } from "../../../components/server/Form";
import { pillColors } from "../../../components/server/badges";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import { TablerBellRinging, TablerEdit, TablerTrash, TablerDeviceFloppy } from "../../../features/app/tabler-icons";
import { serverAlertsApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";

const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE", "DIRECT_AUTH_REQUIRED"];

type Prefs = { enabled?: boolean; manual?: boolean; scheduled?: boolean; rules?: boolean; web?: boolean; mobile?: boolean };
type Scheduled = { id: string; title: string; body: string; scheduleAt?: string | null; cron?: string | null; timeZone?: string | null; recurring?: boolean; enabled?: boolean };
type Rule = { id: string; name: string; metric: string; op: string; threshold?: number | null; service?: string | null; enabled?: boolean; cooldownMinutes?: number };

export function ServerAlertsScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverAlerts;

  const [tab, setTab] = useWorkspaceModuleTab<string>("prefs");
  const [prefs, setPrefs] = useState<Prefs>({});
  const [channelStatus, setChannelStatus] = useState("");
  const [lastDelivery, setLastDelivery] = useState("");
  const [deliveryHistory, setDeliveryHistory] = useState<Array<{id?:string;title:string;createdAt?:string;web:string;mobile:string}>>([]);
  const [testing, setTesting] = useState(false);
  const [scheduled, setScheduled] = useState<Scheduled[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [schedDialog, setSchedDialog] = useState<{ mode: "create" | "edit"; row?: Scheduled } | null>(null);
  const [ruleDialog, setRuleDialog] = useState<{ mode: "create" | "edit"; row?: Rule } | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ kind: "scheduled" | "rule"; id: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({ visible: false, variant: "success", message: "", nonce: 0 });
  const showToast = useCallback((message: string, err = false) => setToast((p) => ({ visible: true, variant: err ? "error" : "success", message, nonce: p.nonce + 1 })), []);

  const load = useCallback(async () => {
    const [pr, sc, ru, ch, hi] = await Promise.all([serverAlertsApi.getPrefs(panelId, token), serverAlertsApi.listScheduled(panelId, token), serverAlertsApi.listRules(panelId, token), serverAlertsApi.getChannels(panelId, token), serverAlertsApi.getHistory(panelId, token)]);
    if (pr.code && GUARDS.includes(pr.code)) {
      setGuardCode(pr.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    setPrefs(unwrap<Prefs>(pr) ?? {});
    setScheduled(unwrap<Scheduled[]>(sc) ?? []);
    setRules(unwrap<Rule[]>(ru) ?? []);
    const channels = unwrap<{ devices: { web: number; mobile: number } }>(ch);
    if (channels) setChannelStatus(`Web: ${channels.devices.web} · App: ${channels.devices.mobile}`);
    const history = unwrap<{ data: Array<{ title: string; createdAt?: string; web: string; mobile: string }> }>(hi);
    setDeliveryHistory(history?.data ?? []);
    setLastDelivery(history?.data[0] ? `${history.data[0].title} · Web: ${history.data[0].web} · App: ${history.data[0].mobile}` : "");
  }, [panelId, token]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const savePrefs = useCallback(async () => {
    setSavingPrefs(true);
    const out = await runServerMutation(panelId, token, () => serverAlertsApi.setPrefs(panelId, token, prefs));
    setSavingPrefs(false);
    if (out.ok) showToast(t.toasts.saved);
    else showToast(out.error ?? t.toasts.error, true);
  }, [panelId, token, prefs, showToast, t.toasts]);

  const doDelete = useCallback(async () => {
    if (!confirmDel) return;
    setConfirmBusy(true);
    try {
    const op = confirmDel.kind === "scheduled" ? () => serverAlertsApi.deleteScheduled(panelId, token, confirmDel.id) : () => serverAlertsApi.deleteRule(panelId, token, confirmDel.id);
    const out = await runServerMutation(panelId, token, op);
    if (out.ok) {
      showToast(t.toasts.deleted);
      void load();
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirmDel(null);
    setConfirmBusy(false);
    } finally { setConfirmBusy(false); }
  }, [confirmDel, panelId, token, showToast, load, t.toasts]);

  // ── Tablas ───────────────────────────────────────────────────────────────
  const enabledPill = (on: boolean) => {
    const c = pillColors(tokens, on ? "ok" : "neutral");
    return (
      <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
        <Text style={{ color: c.text, fontSize: 11 }}>{on ? t.scheduled.enabled : "—"}</Text>
      </View>
    );
  };
  const schedColumns: ServerColumn<Scheduled>[] = useMemo(
    () => [
      { id: "title", header: t.scheduled.colTitle, cell: (r) => r.title, width: 160 },
      { id: "when", header: t.scheduled.colWhen, cell: (r) => r.cron || (r.scheduleAt ? new Date(r.scheduleAt).toLocaleString() : "—"), width: 170 },
      { id: "enabled", header: t.scheduled.colEnabled, cell: (r) => enabledPill(r.enabled !== false), width: 90 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tokens],
  );
  const ruleColumns: ServerColumn<Rule>[] = useMemo(
    () => [
      { id: "name", header: t.rules.colName, cell: (r) => r.name, width: 150 },
      { id: "metric", header: t.rules.colMetric, cell: (r) => r.metric, width: 110 },
      { id: "cond", header: t.rules.colCondition, cell: (r) => (r.metric === "service-down" ? `${r.service ?? ""} down` : `${r.op} ${r.threshold ?? ""}`), width: 140 },
      { id: "enabled", header: t.rules.colEnabled, cell: (r) => enabledPill(r.enabled !== false), width: 90 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tokens],
  );
  const rowActions: ServerRowAction[] = useMemo(() => [{ id: "edit", label: t.scheduled.save, icon: <TablerEdit size={18} /> }, { id: "delete", label: t.confirm.confirm, icon: <TablerTrash size={18} />, danger: true }], [t]);

  const runTest = async () => {
    setTesting(true);
    const out = await runServerMutation(panelId, token, () => serverAlertsApi.sendTest(panelId, token));
    setTesting(false);
    if (out.ok) { showToast(language === "es" ? nativeText("Prueba enviada") : nativeText("Test sent")); void load(); }
    else showToast(out.error ?? t.toasts.error, true);
  };

  const tabs = [
    { key: "prefs", label: t.tabs.prefs },
    { key: "send", label: t.sendNow },
    { key: "history", label: language.startsWith("es") ? nativeText("Historial") : nativeText("History") },
    { key: "scheduled", label: t.tabs.scheduled },
    { key: "rules", label: t.tabs.rules },
  ];

  const prefsContent = <>           <View style={{ gap: 12 }}>
            <Checkbox value={prefs.enabled !== false} onChange={(v) => setPrefs((p) => ({ ...p, enabled: v }))} label={t.prefs.enabled} />
            <Checkbox value={prefs.manual !== false} onChange={(v) => setPrefs((p) => ({ ...p, manual: v }))} label={language === "es" ? nativeText("Avisos manuales") : nativeText("Manual alerts")} />
            <Checkbox value={prefs.scheduled !== false} onChange={(v) => setPrefs((p) => ({ ...p, scheduled: v }))} label={language === "es" ? nativeText("Avisos programados") : nativeText("Scheduled alerts")} />
            <Checkbox value={prefs.rules !== false} onChange={(v) => setPrefs((p) => ({ ...p, rules: v }))} label={language === "es" ? nativeText("Alertas por métricas") : nativeText("Metric alerts")} />
            <Button label={t.prefs.save} icon={<TablerDeviceFloppy size={16} />} onPress={savePrefs} loading={savingPrefs} />
          </View>
</>;
  const channelsContent = <View style={{gap:12}}>
    {channelStatus ? <Text style={{ color: tokens.textSecondary }}>{channelStatus}</Text> : null}
    <Checkbox value={prefs.web !== false} onChange={web=>setPrefs(p=>({...p,web}))} label={language.startsWith("es")?nativeText("Navegadores"):nativeText("Browsers")}/>
    <Checkbox value={prefs.mobile !== false} onChange={mobile=>setPrefs(p=>({...p,mobile}))} label={language.startsWith("es")?nativeText("App móvil"):nativeText("Mobile app")}/>
    <Button label={language.startsWith("es")?nativeText("Enviar prueba"):nativeText("Send test")} onPress={runTest} loading={testing}/>
    <Button label={t.prefs.save} icon={<TablerDeviceFloppy size={16}/>} onPress={savePrefs} loading={savingPrefs}/>
    {lastDelivery ? <Text style={{ color: tokens.textSecondary }}>{lastDelivery}</Text> : null}
  </View>;
  return (
    <>
      <ServerModuleScreen
        title={t.pageTitle}
        subtitle={t.subtitle}
        onBack={onBack}
        settingsPages={[{key:"prefs",label:t.tabs.prefs,content:prefsContent},{key:"channels",get label() { return nativeText("Canales"); },content:channelsContent}]}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        action={{ label: t.sendNow, icon: <TablerBellRinging size={16} />, onPress: () => setSendOpen(true) }}
        guardCode={guardCode}
        onRetry={onRefresh}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        {tab === "history" ? <ServerDataTable title={language.startsWith("es") ? nativeText("Historial") : nativeText("History")} rows={deliveryHistory} rowKey={row=>row.id ?? `${row.createdAt}:${row.title}`} loading={loading} columns={[{id:"title",header:language.startsWith("es")?nativeText("Título"):nativeText("Title"),width:180,cell:row=><Text style={{color:tokens.textPrimary}}>{row.title}</Text>},{id:"createdAt",header:language.startsWith("es")?nativeText("Fecha"):nativeText("Date"),width:160,cell:row=><Text style={{color:tokens.textSecondary}}>{row.createdAt?new Date(row.createdAt).toLocaleString(language):"—"}</Text>},{id:"web",get header() { return nativeText("Web"); },cell:row=><Text style={{color:tokens.textSecondary}}>{row.web}</Text>},{id:"mobile",get header() { return nativeText("App"); },cell:row=><Text style={{color:tokens.textSecondary}}>{row.mobile}</Text>}]} /> : tab === "send" ? <View style={{gap:12}}><Text style={{color:tokens.textSecondary}}>{t.sendNow}</Text><Button label={t.sendNow} onPress={()=>setSendOpen(true)}/></View> : tab === "prefs" ? (
          prefsContent
        ) : null}
        <ModuleTabPanel active={tab === "scheduled"}>
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <Button label={t.scheduled.new} size="sm" onPress={() => setSchedDialog({ mode: "create" })} />
            </View>
            <ServerDataTable
              settingsId="scheduled" title={t.tabs.scheduled}
              columns={schedColumns}
              rows={scheduled}
              rowKey={(r) => r.id}
              rowActions={rowActions}
              loading={loading}
              onRowAction={(id, row) => (id === "edit" ? setSchedDialog({ mode: "edit", row }) : setConfirmDel({ kind: "scheduled", id: row.id }))}
            />
        </ModuleTabPanel>
        <ModuleTabPanel active={tab === "rules"}>
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <Button label={t.rules.new} size="sm" onPress={() => setRuleDialog({ mode: "create" })} />
            </View>
            <ServerDataTable
              settingsId="rules" title={t.tabs.rules}
              columns={ruleColumns}
              rows={rules}
              rowKey={(r) => r.id}
              rowActions={rowActions}
              loading={loading}
              onRowAction={(id, row) => (id === "edit" ? setRuleDialog({ mode: "edit", row }) : setConfirmDel({ kind: "rule", id: row.id }))}
            />
        </ModuleTabPanel>
      </ServerModuleScreen>

      {sendOpen ? <SendDialog panelId={panelId} token={token} onClose={() => setSendOpen(false)} onToast={showToast} /> : null}
      {schedDialog ? (
        <ScheduledDialog
          panelId={panelId}
          token={token}
          mode={schedDialog.mode}
          row={schedDialog.row}
          onClose={() => setSchedDialog(null)}
          onSaved={() => {
            setSchedDialog(null);
            showToast(t.toasts.saved);
            void load();
          }}
          onError={() => showToast(t.toasts.error, true)}
        />
      ) : null}
      {ruleDialog ? (
        <RuleDialog
          panelId={panelId}
          token={token}
          mode={ruleDialog.mode}
          row={ruleDialog.row}
          onClose={() => setRuleDialog(null)}
          onSaved={() => {
            setRuleDialog(null);
            showToast(t.toasts.saved);
            void load();
          }}
          onError={() => showToast(t.toasts.error, true)}
        />
      ) : null}
      {confirmDel ? (
        <ConfirmDialog visible title={t.confirm.deleteTitle} message={t.confirm.delete} confirmLabel={t.confirm.confirm} cancelLabel={t.confirm.cancel} submitting={confirmBusy} onConfirm={doDelete} onCancel={() => setConfirmDel(null)} />
      ) : null}
      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}

function SendDialog({ panelId, token, onClose, onToast }: { panelId: string; token: string; onClose: () => void; onToast: (m: string, e?: boolean) => void }) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverAlerts;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => serverAlertsApi.send(panelId, token, { title, body }));
    setBusy(false);
    if (out.ok) {
      onToast(t.toasts.sent);
      onClose();
    } else throw new Error(out.error ?? t.toasts.error);
  };
  return (
    <FormDrawer visible onClose={onClose} title={t.sendDialog.title} language={language} footer={<DialogFooter onCancel={onClose} cancelLabel={t.sendDialog.cancel} onSubmit={submit} submitLabel={t.sendDialog.send} submitting={busy} />}>
      <Field label={t.sendDialog.labelTitle}>
        <Input value={title} onChangeText={setTitle} />
      </Field>
      <Field label={t.sendDialog.labelBody}>
        <Input value={body} onChangeText={setBody} multiline style={{ minHeight: 70 }} />
      </Field>
    </FormDrawer>
  );
}

function ScheduledDialog({ panelId, token, mode, row, onClose, onSaved, onError }: { panelId: string; token: string; mode: "create" | "edit"; row?: Scheduled; onClose: () => void; onSaved: () => void; onError: () => void }) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverAlerts;
  const [title, setTitle] = useState(row?.title ?? "");
  const [body, setBody] = useState(row?.body ?? "");
  const [recurring, setRecurring] = useState(!!row?.cron);
  const [date, setDate] = useState(row?.scheduleAt ?? "");
  const [cron, setCron] = useState(row?.cron ?? "");
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const payload = { title, body, enabled, ...(recurring ? { cron, recurring: true, scheduleAt: null, timeZone: row?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" } : { scheduleAt: date, recurring: false, cron: null, timeZone: null }) };
    const op = mode === "edit" && row ? () => serverAlertsApi.updateScheduled(panelId, token, row.id, payload) : () => serverAlertsApi.createScheduled(panelId, token, payload);
    const out = await runServerMutation(panelId, token, op);
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? t.toasts.error);
  };
  return (
    <FormDrawer visible onClose={onClose} title={t.scheduled.dialogTitle} language={language} footer={<DialogFooter onCancel={onClose} cancelLabel={t.scheduled.cancel} onSubmit={submit} submitLabel={t.scheduled.save} submitting={busy} />}>
      <Field label={t.scheduled.labelTitle}>
        <Input value={title} onChangeText={setTitle} />
      </Field>
      <Field label={t.scheduled.labelBody}>
        <Input value={body} onChangeText={setBody} multiline style={{ minHeight: 60 }} />
      </Field>
      <Field label={t.scheduled.labelMode}>
        <Select value={recurring ? "cron" : "once"} options={[{ value: "once", label: t.scheduled.modeOnce }, { value: "cron", label: t.scheduled.modeCron }]} onChange={(v) => setRecurring(v === "cron")} />
      </Field>
      {recurring ? (
        <Field label={t.scheduled.labelCron}>
          <Input value={cron} onChangeText={setCron} placeholder={t.scheduled.placeholderCron} autoCapitalize="none" />
        </Field>
      ) : (
        <Field label={t.scheduled.labelDate}>
          <Input value={date} onChangeText={setDate} placeholder="2026-06-30T09:00:00Z" autoCapitalize="none" />
        </Field>
      )}
      <Checkbox value={enabled} onChange={setEnabled} label={t.scheduled.enabled} />
    </FormDrawer>
  );
}

function RuleDialog({ panelId, token, mode, row, onClose, onSaved, onError }: { panelId: string; token: string; mode: "create" | "edit"; row?: Rule; onClose: () => void; onSaved: () => void; onError: () => void }) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverAlerts;
  const [name, setName] = useState(row?.name ?? "");
  const [metric, setMetric] = useState(row?.metric ?? "cpu");
  const [op, setOp] = useState(row?.op ?? ">=");
  const [threshold, setThreshold] = useState(row?.threshold != null ? String(row.threshold) : "");
  const [service, setService] = useState(row?.service ?? "");
  const [cooldown, setCooldown] = useState(String(row?.cooldownMinutes ?? 30));
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [busy, setBusy] = useState(false);
  const isServiceDown = metric === "service-down";
  const submit = async () => {
    const numericThreshold = Number(threshold);
    const numericCooldown = Number(cooldown);
    if (!name.trim() || (isServiceDown && !service.trim()) || (!isServiceDown && (!threshold.trim() || !Number.isFinite(numericThreshold) || numericThreshold < 0)) || !cooldown.trim() || !Number.isInteger(numericCooldown) || numericCooldown < 0 || numericCooldown > 10080) {
      throw new Error(nativeText("Revisa el nombre, umbral, servicio y tiempo de espera (0 a 10080 minutos)."));
    }
    setBusy(true);
    const payload = {
      name,
      metric,
      op: isServiceDown ? "down" : op,
      threshold: isServiceDown ? null : numericThreshold,
      service: isServiceDown ? service : null,
      cooldownMinutes: numericCooldown,
      enabled,
    };
    const out2 = mode === "edit" && row ? () => serverAlertsApi.updateRule(panelId, token, row.id, payload) : () => serverAlertsApi.createRule(panelId, token, payload);
    const out = await runServerMutation(panelId, token, out2);
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? t.toasts.error);
  };
  return (
    <FormDrawer visible onClose={onClose} title={t.rules.dialogTitle} language={language} footer={<DialogFooter onCancel={onClose} cancelLabel={t.rules.cancel} onSubmit={submit} submitLabel={t.rules.save} submitting={busy} />}>
      <Field label={t.rules.labelName}>
        <Input value={name} onChangeText={setName} />
      </Field>
      <Field label={t.rules.labelMetric}>
        <Select
          value={metric}
          onChange={setMetric}
          options={[
            { value: "cpu", label: t.rules.metricCpu },
            { value: "ram", label: t.rules.metricRam },
            { value: "disk", label: t.rules.metricDisk },
            { value: "load", label: t.rules.metricLoad },
            { value: "service-down", label: t.rules.metricServiceDown },
          ]}
        />
      </Field>
      {isServiceDown ? (
        <Field label={t.rules.labelService}>
          <Input value={service} onChangeText={setService} placeholder="nginx" autoCapitalize="none" />
        </Field>
      ) : (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label={t.rules.labelOp}>
              <Select value={op} onChange={setOp} options={[{ value: ">=", label: "≥" }, { value: "<=", label: "≤" }, { value: "==", label: "=" }]} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t.rules.labelThreshold}>
              <Input value={threshold} onChangeText={setThreshold} keyboardType="number-pad" />
            </Field>
          </View>
        </View>
      )}
      <Field label={t.rules.labelCooldown}>
        <Input value={cooldown} onChangeText={setCooldown} keyboardType="number-pad" />
      </Field>
      <Checkbox value={enabled} onChange={setEnabled} label={t.rules.enabled} />
    </FormDrawer>
  );
}
