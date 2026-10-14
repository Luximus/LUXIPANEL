/**
 * CronModule (desktop) — pantalla NATIVA del módulo Cron de un servidor
 * standalone (conexión DIRECTA por `serverApi`). Port React DOM COMPLETO de
 * `app/src/screens/server/cron/*` (CronScreen + cron-dialogs + cron-types),
 * conservando estilos (Tailwind + daisyUI + lucide-react), i18n
 * (`getMessages(...).serverCron`) y contrato (`serverCronApi` + `callServerApi`,
 * token `""` en modo directo).
 *
 * Paridad con app: dos tabs (Trabajos cron clásicos / Agentes IA programados),
 * cada uno con su DataTable de desktop + acciones de fila, box de estado del
 * daemon (instalar / activar / desactivar servicio) con flujo de contraseña
 * sudo, y diálogos CRUD (crear/editar tarea, crear agente, visor de registros,
 * presets de agentes) como modales `lp-modal-*`. El CRUD va por la cola
 * write-behind (`runServerMutation` → `withJob`); el daemon inspecciona el
 * envelope del panel directamente (HTTP 200 con `{ ok:false, code }` en sudo).
 *
 * Módulo dividido en hermanos: tipos en `cron-types`, constantes + helpers +
 * shell de modal en `cron-ui`, diálogos CRUD en `cron-dialogs`.
 */
import { useLiveModuleData } from "../../../lib/use-live-module-data";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Download,
  Pause,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableRowActionConfig,
} from "../../../components/DataTable";
import { useConfirm } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ToastProvider";
import {
  callServerApi,
  serverCronApi,
  unwrap,
  type GatewayGuardCode,
} from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";
import type {
  AgentRow,
  CronAiJob,
  CronJob,
  CronStatus,
  DaemonAction,
  DaemonEnvelope,
  JobRow,
} from "./cron-types";
import { GUARDS, StatusPill, agentRunning, jobActive, runServerMutation } from "./cron-ui";
import { AgentDialog, JobDialog, LogsDialog, PresetsDialog, SudoPasswordModal } from "./cron-dialogs";

export function CronModule({ serverId, language }: ModuleProps) {
  const t = getMessages(language).serverCron;
  const c = getMessages(language).common;
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [tab, setTab] = useState<"jobs" | "agents">("jobs");
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [agents, setAgents] = useState<CronAiJob[]>([]);
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [jobDialog, setJobDialog] = useState<{ mode: "create" | "edit"; row?: CronJob } | null>(null);
  const [agentDialog, setAgentDialog] = useState(false);
  const [logsTarget, setLogsTarget] = useState<{ kind: "job" | "agent"; id: string; name: string } | null>(null);

  const [daemonBusy, setDaemonBusy] = useState<DaemonAction | null>(null);
  const [sudoPrompt, setSudoPrompt] = useState<{ action: DaemonAction } | null>(null);
  const [sudoError, setSudoError] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);

  const showToast = useCallback(
    (message: string, err = false) => (err ? toast.error(message) : toast.success(message)),
    [toast],
  );

  // ── Carga (mismo contrato/paths que app) ──────────────────────────────────
  const load = useCallback(async () => {
    const [st, jb, ag] = await Promise.all([
      serverCronApi.status(serverId, ""),
      serverCronApi.listJobs(serverId, ""),
      serverCronApi.listAiJobs(serverId, ""),
    ]);
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
  }, [serverId, t.toasts.loadError]);

  useLiveModuleData(serverId, ["cron/jobs"], load);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Filas de las tablas ────────────────────────────────────────────────────
  const jobRows = useMemo<JobRow[]>(
    () =>
      jobs.map((j) => ({
        id: j.id,
        schedule: j.schedule || "—",
        command: j.command || "—",
        active: jobActive(j),
        comment: j.comment ?? "",
        enabled: j.enabled !== false,
        managed: j.managed === true,
      })),
    [jobs],
  );
  const agentRows = useMemo<AgentRow[]>(
    () =>
      agents.map((a) => ({
        id: a.id,
        name: a.name || "—",
        schedule: a.schedule || t.agents.noSchedule,
        running: agentRunning(a),
        enabled: a.enabled !== false,
        status: agentRunning(a) ? t.agents.statusRunning : a.enabled !== false ? t.agents.statusActive : t.agents.statusPaused,
      })),
    [agents, t.agents.noSchedule, t.agents.statusRunning, t.agents.statusActive, t.agents.statusPaused],
  );

  const jobColumns = useMemo<DataTableColumnConfig<JobRow>[]>(
    () => [
      { id: "schedule", header: t.jobs.colSchedule, accessorKey: "schedule", sortable: true, cell: (r) => <span className="font-mono text-xs">{r.schedule}</span> },
      { id: "command", header: t.jobs.colCommand, accessorKey: "command", cell: (r) => <span className="font-mono text-xs">{r.command}</span> },
      {
        id: "status",
        header: t.jobs.colStatus,
        accessorKey: "active",
        cell: (r) => <StatusPill label={r.active ? t.jobs.statusActive : t.jobs.statusPaused} kind={r.active ? "ok" : "neutral"} />,
      },
    ],
    [t],
  );
  const agentColumns = useMemo<DataTableColumnConfig<AgentRow>[]>(
    () => [
      { id: "name", header: t.agents.colName, accessorKey: "name", sortable: true },
      { id: "schedule", header: t.agents.colSchedule, accessorKey: "schedule", cell: (r) => <span className="font-mono text-xs">{r.schedule}</span> },
      {
        id: "status",
        header: t.agents.colStatus,
        accessorKey: "status",
        cell: (r) =>
          r.running ? (
            <StatusPill label={t.agents.statusRunning} kind="amber" />
          ) : (
            <StatusPill label={r.enabled ? t.agents.statusActive : t.agents.statusPaused} kind={r.enabled ? "ok" : "neutral"} />
          ),
      },
    ],
    [t],
  );

  const jobActions = useMemo<DataTableRowActionConfig<JobRow>[]>(
    () => [
      { id: "edit", label: t.rowActions.edit },
      { id: "toggle", label: t.rowActions.toggle },
      { id: "logs", label: t.rowActions.logs },
      { id: "delete", label: t.rowActions.delete, variant: "danger" },
    ],
    [t],
  );
  const agentActions = useMemo<DataTableRowActionConfig<AgentRow>[]>(
    () => [
      { id: "run", label: t.rowActions.run },
      { id: "toggle", label: t.rowActions.toggle },
      { id: "logs", label: t.rowActions.logs },
      { id: "delete", label: t.rowActions.delete, variant: "danger" },
    ],
    [t],
  );

  // ── Acciones de fila (Trabajos) ────────────────────────────────────────────
  const onJobAction = useCallback(
    async (actionId: string, row: JobRow) => {
      if (actionId === "edit") {
        setJobDialog({ mode: "edit", row: { id: row.id, schedule: row.schedule === "—" ? "" : row.schedule, command: row.command === "—" ? "" : row.command, comment: row.comment, enabled: row.enabled, managed: row.managed } });
      } else if (actionId === "toggle") {
        const out = await runServerMutation(serverId, () => serverCronApi.toggleJob(serverId, "", row.id));
        if (out.ok) {
          showToast(t.toasts.jobToggled);
          await load();
        } else showToast(out.error ?? t.toasts.error, true);
      } else if (actionId === "logs") {
        setLogsTarget({ kind: "job", id: row.id, name: row.command !== "—" ? row.command : row.schedule });
      } else if (actionId === "delete") {
        const accepted = await confirm({
          title: t.confirm.deleteJobTitle,
          danger: true,
          confirmLabel: t.confirm.confirm,
          cancelLabel: t.confirm.cancel,
          message: formatMessage(t.confirm.deleteJob, { name: row.command !== "—" ? row.command : "—" }),
        });
        if (!accepted) return;
        const out = await runServerMutation(serverId, () => serverCronApi.deleteJob(serverId, "", row.id));
        if (out.ok) {
          showToast(t.toasts.jobDeleted);
          await load();
        } else showToast(out.error ?? t.toasts.error, true);
      }
    },
    [serverId, showToast, load, t, confirm],
  );

  // ── Acciones de fila (Agentes IA) ──────────────────────────────────────────
  const onAgentAction = useCallback(
    async (actionId: string, row: AgentRow) => {
      if (actionId === "run") {
        if (row.running) {
          showToast(t.toasts.agentRunning, true);
          return;
        }
        const out = await runServerMutation(serverId, () => serverCronApi.runAiJob(serverId, "", row.id));
        if (out.ok) {
          showToast(t.toasts.agentStarted);
          await load();
        } else showToast(out.error ?? t.toasts.error, true);
      } else if (actionId === "toggle") {
        const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "POST", `/api/cron/ai-jobs/${encodeURIComponent(row.id)}/toggle`));
        if (out.ok) {
          showToast(t.toasts.jobToggled);
          await load();
        } else showToast(out.error ?? t.toasts.error, true);
      } else if (actionId === "logs") {
        setLogsTarget({ kind: "agent", id: row.id, name: row.name });
      } else if (actionId === "delete") {
        const accepted = await confirm({
          title: t.confirm.deleteAgentTitle,
          danger: true,
          confirmLabel: t.confirm.confirm,
          cancelLabel: t.confirm.cancel,
          message: formatMessage(t.confirm.deleteAgent, { name: row.name || "—" }),
        });
        if (!accepted) return;
        const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "DELETE", `/api/cron/ai-jobs/${encodeURIComponent(row.id)}`));
        if (out.ok) {
          showToast(t.toasts.agentDeleted);
          await load();
        } else showToast(out.error ?? t.toasts.error, true);
      }
    },
    [serverId, showToast, load, t, confirm],
  );

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
      const res = await callServerApi(serverId, "", "POST", path, sudoPassword ? { sudoPassword } : {});
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
    [serverId, showToast, load, t.daemon],
  );

  // Estado del daemon: "none" mientras carga, luego instalar / detenido / activo.
  const daemonState: "none" | "install" | "stopped" | "active" = !status
    ? "none"
    : status.installed === false
      ? "install"
      : status.service?.active === false
        ? "stopped"
        : "active";

  // ── Render ──────────────────────────────────────────────────────────────
  if (guardCode) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.pageTitle}</h2>
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm text-error">{t.toasts.loadError}</p>
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
      {/* Cabecera + refrescar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-semibold">{t.pageTitle}</h2>
          <p className="text-xs text-base-content/60">{t.subtitle}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {c.refresh}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{error}</div>
      ) : null}

      {/* Tabs + acción */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {(["jobs", "agents"] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`btn btn-sm gap-1.5 ${tab === k ? "btn-primary" : "btn-ghost border border-base-300"}`}
              onClick={() => setTab(k)}
            >
              {k === "jobs" ? <Clock size={15} /> : <Sparkles size={15} />}
              {k === "jobs" ? t.tabs.jobs : t.tabs.agents}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {tab === "agents" ? (
            <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setPresetsOpen(true)}>
              <SlidersHorizontal size={15} /> {t.presets.button}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-sm btn-primary gap-1.5"
            onClick={() => (tab === "jobs" ? setJobDialog({ mode: "create" }) : setAgentDialog(true))}
          >
            {tab === "jobs" ? <Clock size={15} /> : <Sparkles size={15} />}
            {tab === "jobs" ? t.jobs.new : t.agents.new}
          </button>
        </div>
      </div>

      {/* Box de estado del daemon */}
      {daemonState === "install" || daemonState === "stopped" ? (
        <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${daemonState === "install" ? "border-error/30 bg-error/10" : "border-warning/30 bg-warning/10"}`}>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-base-content">{daemonState === "install" ? t.daemon.notInstalled : t.service.stopped}</p>
            <p className="text-xs text-base-content/70">{daemonState === "install" ? t.daemon.notInstalledDesc : t.service.stoppedDesc}</p>
          </div>
          <button
            type="button"
            className={`btn btn-sm gap-1.5 ${daemonState === "install" ? "btn-primary" : "btn-outline"}`}
            disabled={daemonBusy === (daemonState === "install" ? "install" : "enable")}
            onClick={() => void runDaemonAction(daemonState === "install" ? "install" : "enable")}
          >
            {daemonBusy === (daemonState === "install" ? "install" : "enable") ? (
              <span className="loading loading-spinner loading-xs" />
            ) : daemonState === "install" ? (
              <Download size={15} />
            ) : (
              <Play size={15} />
            )}
            {daemonState === "install" ? t.daemon.install : t.daemon.enable}
          </button>
        </div>
      ) : null}

      {daemonState === "active" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-info/30 bg-info/10 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-base-content">{t.daemon.active}</p>
            <p className="text-xs text-base-content/70">{t.daemon.activeDesc}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1.5"
            disabled={daemonBusy === "disable"}
            onClick={() => void runDaemonAction("disable")}
          >
            {daemonBusy === "disable" ? <span className="loading loading-spinner loading-xs" /> : <Pause size={15} />}
            {t.daemon.disable}
          </button>
        </div>
      ) : null}

      {/* Tabla */}
      <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
        {tab === "jobs" ? (
          <DataTable<JobRow>
            tableId="server-cron-jobs"
            title={t.tabs.jobs}
            data={jobRows}
            columns={jobColumns}
            rowActions={jobActions}
            language={language}
            loading={loading}
            onRowAction={(id, row) => void onJobAction(id, row)}
          />
        ) : (
          <DataTable<AgentRow>
            tableId="server-cron-agents"
            title={t.tabs.agents}
            data={agentRows}
            columns={agentColumns}
            rowActions={agentActions}
            language={language}
            loading={loading}
            onRowAction={(id, row) => void onAgentAction(id, row)}
          />
        )}
      </div>

      {/* Diálogos */}
      {jobDialog ? (
        <JobDialog
          serverId={serverId}
          language={language}
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
          serverId={serverId}
          language={language}
          onClose={() => setAgentDialog(false)}
          onSaved={() => {
            setAgentDialog(false);
            showToast(t.toasts.agentCreated);
            void load();
          }}
          onError={(msg) => showToast(msg ?? t.toasts.error, true)}
        />
      ) : null}

      {logsTarget ? (
        <LogsDialog
          serverId={serverId}
          language={language}
          kind={logsTarget.kind}
          targetId={logsTarget.id}
          name={logsTarget.name}
          onClose={() => setLogsTarget(null)}
        />
      ) : null}

      {sudoPrompt ? (
        <SudoPasswordModal
          language={language}
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
          serverId={serverId}
          language={language}
          onClose={() => setPresetsOpen(false)}
          onSaved={() => {
            setPresetsOpen(false);
            showToast(t.presets.saved);
          }}
          onError={(msg) => showToast(msg ?? t.toasts.error, true)}
        />
      ) : null}

      {dialog}
    </div>
  );
}
