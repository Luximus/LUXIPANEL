import { nativeText } from '../../../i18n/native-text';
import { ModuleTabPanel } from "../../../components/server/ModuleLayouts";
import { useWorkspaceModuleTab } from "../../main/use-workspace-module-tab";
/**
 * CronScreen — réplica nativa del módulo Cron de LUXIPANEL
 * (`frontend/src/pages/panel/cron/index.astro`). Dos tabs: Trabajos (cron jobs
 * clásicos) y Agentes IA (agentes programados). Cada tab con su tabla, botón de
 * acción, diálogos CRUD y confirmaciones. Datos por el gateway
 * (`serverCronApi` + `callServerApi` para las rutas de ai-jobs sin wrapper).
 * El CRUD de cron va por la cola write-behind (`runServerMutation` → `withJob`).
 */
import { useLiveModuleData } from "../../../lib/use-live-module-data";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { ServerDataTable, type ServerColumn, type ServerRowAction } from "../../../components/server/ServerDataTable";
import { ConfirmDialog, Field, Checkbox, InfoBox, DialogFooter } from "../../../components/server/Form";
import { pillColors, type PillKind } from "../../../components/server/badges";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Modal } from "../../../components/ui/Modal";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import { Button } from "../../../components/ui/Button";
import {
  TablerClock,
  TablerSparkles,
  TablerEdit,
  TablerTrash,
  TablerPlayerPlay,
  TablerPlayerPause,
  TablerChevronLeft,
  TablerChevronRight,
  TablerRefresh,
} from "../../../features/app/tabler-icons";
import { serverCronApi, callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";

import { TablerAdjustments, TablerDownload, TablerFileText } from "./cron-icons";
import { JobDialog, AgentDialog, LogsDialog, SudoPasswordModal, PresetsDialog } from "./cron-dialogs";
import {
  type CronAiJob,
  type CronJob,
  type CronStatus,
  type DaemonAction,
  type DaemonEnvelope,
  GUARDS,
  agentRunning,
  jobActive,
} from "./cron-types";

export function CronScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverCron;

  const [tab, setTab] = useWorkspaceModuleTab<string>("jobs");
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [agents, setAgents] = useState<CronAiJob[]>([]);
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [jobDialog, setJobDialog] = useState<{ mode: "create" | "edit"; row?: CronJob } | null>(null);
  const [agentDialog, setAgentDialog] = useState<boolean>(false);
  const [confirmDel, setConfirmDel] = useState<{ kind: "job" | "agent"; row: CronJob | CronAiJob } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [logsTarget, setLogsTarget] = useState<{ kind: "job" | "agent"; id: string; name: string } | null>(null);

  // Daemon (instalación / servicio) + diálogo de presets de agentes.
  const [daemonBusy, setDaemonBusy] = useState<DaemonAction | null>(null);
  const [sudoPrompt, setSudoPrompt] = useState<{ action: DaemonAction } | null>(null);
  const [sudoError, setSudoError] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);

  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({ visible: false, variant: "success", message: "", nonce: 0 });
  const showToast = useCallback((message: string, err = false) => setToast((p) => ({ visible: true, variant: err ? "error" : "success", message, nonce: p.nonce + 1 })), []);

  const load = useCallback(async () => {
    const [st, jb, ag] = await Promise.all([serverCronApi.status(panelId, token), serverCronApi.listJobs(panelId, token), serverCronApi.listAiJobs(panelId, token)]);
    if (jb.code && GUARDS.includes(jb.code)) {
      setGuardCode(jb.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    if (!jb.ok) {
      setError(jb.error ?? t.toasts.loadError);
      return;
    }
    setError(null);
    setStatus(unwrap<CronStatus>(st) ?? null);
    setJobs(unwrap<CronJob[]>(jb) ?? []);
    setAgents(unwrap<CronAiJob[]>(ag) ?? []);
  }, [panelId, token, t.toasts.loadError]);

  useLiveModuleData(panelId, ["cron/jobs"], load);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Pills de estado ────────────────────────────────────────────────────────
  const StatusPill = ({ label, kind }: { label: string; kind: PillKind }) => {
    const c = pillColors(tokens, kind);
    return (
      <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
        <Text style={{ color: c.text, fontSize: 11, fontWeight: "500" }}>{label}</Text>
      </View>
    );
  };

  // ── Columnas ───────────────────────────────────────────────────────────────
  const jobColumns: ServerColumn<CronJob>[] = useMemo(
    () => [
      { id: "schedule", header: t.jobs.colSchedule, cell: (r) => r.schedule || "—", width: 150, sortable: true, sortValue: (r) => r.schedule ?? "" },
      { id: "command", header: t.jobs.colCommand, cell: (r) => r.command || "—", width: 230 },
      { id: "status", header: t.jobs.colStatus, cell: (r) => <StatusPill label={jobActive(r) ? t.jobs.statusActive : t.jobs.statusPaused} kind={jobActive(r) ? "ok" : "neutral"} />, width: 110 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tokens],
  );

  const agentColumns: ServerColumn<CronAiJob>[] = useMemo(
    () => [
      { id: "name", header: t.agents.colName, cell: (r) => r.name || "—", width: 180, sortable: true, sortValue: (r) => r.name ?? "" },
      { id: "schedule", header: t.agents.colSchedule, cell: (r) => r.schedule || t.agents.noSchedule, width: 150 },
      {
        id: "status",
        header: t.agents.colStatus,
        cell: (r) =>
          agentRunning(r) ? (
            <StatusPill label={t.agents.statusRunning} kind="amber" />
          ) : (
            <StatusPill label={r.enabled !== false ? t.agents.statusActive : t.agents.statusPaused} kind={r.enabled !== false ? "ok" : "neutral"} />
          ),
        width: 130,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tokens],
  );

  const jobActions: ServerRowAction[] = useMemo(
    () => [
      { id: "edit", label: t.rowActions.edit, icon: <TablerEdit size={18} /> },
      { id: "toggle", label: t.rowActions.toggle, icon: <TablerPlayerPause size={18} /> },
      { id: "logs", label: t.rowActions.logs, icon: <TablerFileText size={18} /> },
      { id: "delete", label: t.rowActions.delete, icon: <TablerTrash size={18} />, danger: true },
    ],
    [t],
  );
  const agentActions: ServerRowAction[] = useMemo(
    () => [
      { id: "run", label: t.rowActions.run, icon: <TablerPlayerPlay size={18} /> },
      { id: "toggle", label: t.rowActions.toggle, icon: <TablerPlayerPause size={18} /> },
      { id: "logs", label: t.rowActions.logs, icon: <TablerFileText size={18} /> },
      { id: "delete", label: t.rowActions.delete, icon: <TablerTrash size={18} />, danger: true },
    ],
    [t],
  );

  // ── Acciones de fila (Trabajos) ────────────────────────────────────────────
  const onJobAction = useCallback(
    async (actionId: string, row: CronJob) => {
      if (actionId === "edit") {
        setJobDialog({ mode: "edit", row });
      } else if (actionId === "toggle") {
        const out = await runServerMutation(panelId, token, () => serverCronApi.toggleJob(panelId, token, row.id));
        if (out.ok) {
          showToast(t.toasts.jobToggled);
          await load();
        } else showToast(out.error ?? t.toasts.error, true);
      } else if (actionId === "logs") {
        setLogsTarget({ kind: "job", id: row.id, name: row.command || row.schedule || row.id });
      } else if (actionId === "delete") {
        setConfirmDel({ kind: "job", row });
      }
    },
    [panelId, token, showToast, load, t.toasts],
  );

  // ── Acciones de fila (Agentes IA) ──────────────────────────────────────────
  const onAgentAction = useCallback(
    async (actionId: string, row: CronAiJob) => {
      if (actionId === "run") {
        if (agentRunning(row)) {
          showToast(t.toasts.agentRunning, true);
          return;
        }
        const out = await runServerMutation(panelId, token, () => serverCronApi.runAiJob(panelId, token, row.id));
        if (out.ok) {
          showToast(t.toasts.agentStarted);
          await load();
        } else showToast(out.error ?? t.toasts.error, true);
      } else if (actionId === "toggle") {
        const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", `/api/cron/ai-jobs/${encodeURIComponent(row.id)}/toggle`));
        if (out.ok) {
          showToast(t.toasts.jobToggled);
          await load();
        } else showToast(out.error ?? t.toasts.error, true);
      } else if (actionId === "logs") {
        setLogsTarget({ kind: "agent", id: row.id, name: row.name || row.id });
      } else if (actionId === "delete") {
        setConfirmDel({ kind: "agent", row });
      }
    },
    [panelId, token, showToast, load, t.toasts],
  );

  const doDelete = useCallback(async () => {
    if (!confirmDel) return;
    setConfirmBusy(true);
    try {
    const op =
      confirmDel.kind === "job"
        ? () => serverCronApi.deleteJob(panelId, token, confirmDel.row.id)
        : () => callServerApi(panelId, token, "DELETE", `/api/cron/ai-jobs/${encodeURIComponent(confirmDel.row.id)}`);
    const out = await runServerMutation(panelId, token, op);
    if (out.ok) {
      showToast(confirmDel.kind === "job" ? t.toasts.jobDeleted : t.toasts.agentDeleted);
      await load();
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirmDel(null);
    setConfirmBusy(false);
    } finally { setConfirmBusy(false); }
  }, [confirmDel, panelId, token, showToast, load, t.toasts]);

  // ── Daemon: instalar / activar / desactivar el servicio cron ───────────────
  // No usa `runServerMutation`: estas rutas devuelven HTTP 200 con un envelope
  // `{ ok:false, code }` cuando sudo pide contraseña, y el gateway lo marcaría
  // como éxito. Inspeccionamos el envelope del panel directamente.
  const runDaemonAction = useCallback(
    async (action: DaemonAction, sudoPassword?: string) => {
      setDaemonBusy(action);
      setSudoError(null);
      const path =
        action === "install" ? "/api/cron/install" : action === "enable" ? "/api/cron/service/enable" : "/api/cron/service/disable";
      const res = await callServerApi(panelId, token, "POST", path, sudoPassword ? { sudoPassword } : {});
      setDaemonBusy(null);
      if (res.code && GUARDS.includes(res.code)) {
        showToast(t.daemon.actionError, true);
        return;
      }
      const panel = res.data as DaemonEnvelope | undefined;
      const code = panel?.code ?? panel?.data?.code;
      const okLogical = res.ok && panel?.ok !== false;
      if (code === "SUDO_PASSWORD_REQUIRED") {
        setSudoPrompt({ action });
        if (sudoPassword) setSudoError(t.daemon.sudoInvalid);
        else showToast(t.daemon.sudoRequired, true);
        return;
      }
      if (code === "SUDO_PASSWORD_INVALID") {
        setSudoPrompt({ action });
        setSudoError(t.daemon.sudoInvalid);
        return;
      }
      if (!okLogical) {
        const out = panel?.data?.output ?? panel?.error;
        showToast(out && out.length <= 160 ? out : t.daemon.actionError, true);
        return;
      }
      setSudoPrompt(null);
      setSudoError(null);
      showToast(action === "install" ? t.daemon.installed : action === "enable" ? t.daemon.enabled : t.daemon.disabled);
      await load();
    },
    [panelId, token, showToast, load, t.daemon],
  );

  const tabs = [
    { key: "jobs", label: t.tabs.jobs, icon: <TablerClock size={16} /> },
    { key: "agents", label: t.tabs.agents, icon: <TablerSparkles size={16} /> },
  ];

  const action =
    tab === "jobs"
      ? { label: t.jobs.new, icon: <TablerClock size={16} />, onPress: () => setJobDialog({ mode: "create" }) }
      : { label: t.agents.new, icon: <TablerSparkles size={16} />, onPress: () => setAgentDialog(true) };

  // Estado del daemon: "none" mientras carga, luego instalar / detenido / activo.
  const daemonState: "none" | "install" | "stopped" | "active" = !status
    ? "none"
    : status.installed === false
      ? "install"
      : status.service?.active === false
        ? "stopped"
        : "active";

  return (
    <>
      <ServerModuleScreen
        title={t.pageTitle}
        subtitle={t.subtitle}
        onBack={onBack}
        settingsPages={[{key:"service",get label() { return nativeText("Servicio"); },content:<>        {daemonState === "install" || daemonState === "stopped" ? (
          <InfoBox tone={daemonState === "install" ? "danger" : "warn"}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 2 }}>
                  {daemonState === "install" ? t.daemon.notInstalled : t.service.stopped}
                </Text>
                <Text style={{ color: tokens.textSecondary, fontSize: 12, lineHeight: 17 }}>
                  {daemonState === "install" ? t.daemon.notInstalledDesc : t.service.stoppedDesc}
                </Text>
              </View>
              <Button
                label={daemonState === "install" ? t.daemon.install : t.daemon.enable}
                icon={daemonState === "install" ? <TablerDownload size={16} /> : <TablerPlayerPlay size={16} />}
                size="sm"
                variant={daemonState === "install" ? "primary" : "secondary"}
                loading={daemonBusy === (daemonState === "install" ? "install" : "enable")}
                onPress={() => void runDaemonAction(daemonState === "install" ? "install" : "enable")}
              />
            </View>
          </InfoBox>
        ) : null}

        {daemonState === "active" ? (
          <InfoBox tone="info">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 2 }}>{t.daemon.active}</Text>
                <Text style={{ color: tokens.textSecondary, fontSize: 12, lineHeight: 17 }}>{t.daemon.activeDesc}</Text>
              </View>
              <Button
                label={t.daemon.disable}
                icon={<TablerPlayerPause size={16} />}
                size="sm"
                variant="ghost"
                loading={daemonBusy === "disable"}
                onPress={() => void runDaemonAction("disable")}
              />
            </View>
          </InfoBox>
        ) : null}

</>}]}
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
        <ModuleTabPanel active={tab === "jobs"}>
          <ServerDataTable
            title={t.tabs.jobs}
            columns={jobColumns}
            rows={jobs}
            rowKey={(r) => r.id}
            rowActions={jobActions}
            loading={loading}
            onRowAction={(id, row) => void onJobAction(id, row)}
          />
        </ModuleTabPanel><ModuleTabPanel active={tab !== "jobs"}>
          <>
            <ServerDataTable
              title={t.tabs.agents}
              columns={agentColumns}
              rows={agents}
              rowKey={(r) => r.id}
              rowActions={agentActions}
              loading={loading}
              onRowAction={(id, row) => void onAgentAction(id, row)}
            />
          </>
        </ModuleTabPanel>
        <PresetsDialog embedded panelId={panelId} token={token} onClose={()=>{}} onSaved={()=>showToast(t.presets.saved)} onError={message=>showToast(message ?? t.presets.loadError,true)} />
      </ServerModuleScreen>

      {jobDialog ? (
        <JobDialog
          panelId={panelId}
          token={token}
          mode={jobDialog.mode}
          row={jobDialog.row}
          onClose={() => setJobDialog(null)}
          onSaved={(created) => {
            setJobDialog(null);
            showToast(created ? t.toasts.jobCreated : t.toasts.jobSaved);
            void load();
          }}
          onError={(msg) => showToast(msg ?? t.toasts.error, true)}
        />
      ) : null}

      {agentDialog ? (
        <AgentDialog
          panelId={panelId}
          token={token}
          onClose={() => setAgentDialog(false)}
          onSaved={() => {
            setAgentDialog(false);
            showToast(t.toasts.agentCreated);
            void load();
          }}
          onError={(msg) => showToast(msg ?? t.toasts.error, true)}
        />
      ) : null}

      {confirmDel ? (
        <ConfirmDialog
          visible
          title={confirmDel.kind === "job" ? t.confirm.deleteJobTitle : t.confirm.deleteAgentTitle}
          message={formatMessage(confirmDel.kind === "job" ? t.confirm.deleteJob : t.confirm.deleteAgent, {
            name: (confirmDel.kind === "job" ? (confirmDel.row as CronJob).command : (confirmDel.row as CronAiJob).name) || "—",
          })}
          confirmLabel={t.confirm.confirm}
          cancelLabel={t.confirm.cancel}
          submitting={confirmBusy}
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(null)}
        />
      ) : null}

      {logsTarget ? (
        <LogsDialog
          panelId={panelId}
          token={token}
          kind={logsTarget.kind}
          targetId={logsTarget.id}
          name={logsTarget.name}
          onClose={() => setLogsTarget(null)}
        />
      ) : null}

      {sudoPrompt ? (
        <SudoPasswordModal
          busy={daemonBusy === sudoPrompt.action}
          error={sudoError}
          onSubmit={(pw) => void runDaemonAction(sudoPrompt.action, pw)}
          onClose={() => {
            setSudoPrompt(null);
            setSudoError(null);
          }}
        />
      ) : null}

      {presetsOpen ? (
        <PresetsDialog
          panelId={panelId}
          token={token}
          onClose={() => setPresetsOpen(false)}
          onSaved={() => {
            setPresetsOpen(false);
            showToast(t.presets.saved);
          }}
          onError={(msg) => showToast(msg ?? t.toasts.error, true)}
        />
      ) : null}

      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}

