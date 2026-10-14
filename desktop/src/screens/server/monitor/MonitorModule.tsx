import { useDataAppActive } from "../../../lib/use-live-module-data";
import { useNativeModuleVisible } from "../module-visibility";
/**
 * MonitorModule (desktop) — pantalla NATIVA del módulo Monitor de un servidor
 * standalone (conexión DIRECTA por `serverApi`). Port React DOM COMPLETO de
 * `app/src/screens/server/monitor/MonitorScreen.tsx`, conservando estilos
 * (Tailwind + daisyUI + lucide-react), i18n (`getMessages(...).serverMonitor`)
 * y contrato (`serverMonitorApi` + `callServerApi`, token `""` en modo directo).
 *
 * Paridad con app: health pill, stat cards (CPU/RAM/disco/red), chart de
 * historial (SVG inline, rangos 1h/6h/24h/7d), doughnuts de breakdown
 * (memoria/disco/red, SVG inline) + top procesos (mini-barras CPU/RAM),
 * servicios con tabs all/active/inactive + activar/instalar, tabla de procesos
 * (DataTable de desktop) + confirm kill, card de watchdog editable y toasts.
 * Igual que en app NO hay WebSocket: el gateway no túnela `/api/monitor/ws`,
 * así que se usa el MISMO fallback de snapshot HTTP (poll de 8 s).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  Cpu,
  Database,
  RefreshCw,
  RotateCcw,
  Save,
  Wifi,
} from "lucide-react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableRowActionConfig,
} from "../../../components/DataTable";
import { useConfirm } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ToastProvider";
import {
  callServerApi,
  serverMonitorApi,
  unwrap,
  withJob,
  type GatewayGuardCode,
  type GatewayResponse,
} from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";

const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE"];

/** Paleta para las mini-barras de procesos (espejo de la polar-area del web/app). */
const POLAR = ["#f59e0b", "#a855f7", "#0ea5e9", "#10b981", "#ef4444", "#6366f1", "#ec4899"];

// Colores de serie/segmento (mismos roles que en app: warning=CPU, brand=RAM,
// sky=disco, green/indigo=red). Los de tema salen de las CSS vars de daisyUI.
const CPU_COLOR = "var(--color-warning)";
const RAM_COLOR = "var(--color-primary)";
const DISK_COLOR = "#0ea5e9";
const NET_IN_COLOR = "#10b981";
const NET_OUT_COLOR = "#6366f1";
const TRACK_COLOR = "color-mix(in oklab, var(--color-base-content) 15%, transparent)";
const FREE_COLOR = "color-mix(in oklab, var(--color-base-content) 30%, transparent)";

type Snapshot = {
  cpu?: { usagePercent?: number; loadAvg1m?: number };
  memory?: { usagePercent?: number; usedBytes?: number; freeBytes?: number; totalBytes?: number };
  disk?: { usagePercent?: number; usedBytes?: number; availableBytes?: number; totalBytes?: number };
  network?: { rxBytesPerSec?: number; txBytesPerSec?: number };
};
type ServiceRow = { name: string; active: boolean; installed: boolean; installable?: boolean };
type ProcRow = { pid: number; name: string; user: string; cpuPercent: number; memPercent: number; memRss: number };
type Watchdog = { enabled?: boolean; cpuPercent?: number | null; memPercent?: number | null; sustainedSeconds?: number };

/** Fila plana para el DataTable de desktop (accessorKeys ordenables/filtrables). */
type ProcTableRow = {
  id: string;
  pid: number;
  name: string;
  user: string;
  cpu: number;
  ramBytes: number;
  mem: number;
};

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function fmtBytes(b: number): string {
  if (!b || b < 1024) return `${Math.round(b)} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}
function fmtRate(b: number): string {
  return `${fmtBytes(b)}/s`;
}

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

export function MonitorModule({ serverId, language }: ModuleProps) {
  const appActive=useDataAppActive();
  const moduleVisible=useNativeModuleVisible() && appActive;
  const t = getMessages(language).serverMonitor;
  const c = getMessages(language).common;
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [procs, setProcs] = useState<ProcRow[]>([]);
  const [watchdog, setWatchdog] = useState<Watchdog | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [range, setRange] = useState<"1h" | "6h" | "24h" | "7d">("1h");
  const [serviceTab, setServiceTab] = useState<"all" | "active" | "inactive">("all");
  const [breakdownMetric, setBreakdownMetric] = useState<"cpu" | "mem">("cpu");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [savingWd, setSavingWd] = useState(false);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [serviceBusy, setServiceBusy] = useState<string | null>(null);

  const aliveRef = useRef(true);

  // ── Carga (mismo contrato/paths que app) ────────────────────────────────
  const loadSnapshot = useCallback(async () => {
    const res = await serverMonitorApi.snapshot(serverId, "");
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    const data = unwrap<Snapshot>(res);
    if (data && aliveRef.current) setSnap(data);
  }, [serverId]);

  const loadRest = useCallback(async () => {
    const [svc, pr, wd, hist] = await Promise.all([
      serverMonitorApi.services(serverId, ""),
      serverMonitorApi.processes(serverId, ""),
      callServerApi(serverId, "", "GET", "/api/monitor/watchdog"),
      callServerApi(serverId, "", "GET", `/api/monitor/history?range=${encodeURIComponent(range)}`),
    ]);
    if (!aliveRef.current) return;
    setServices((unwrap<ServiceRow[]>(svc) ?? []).filter(Boolean));
    setProcs((unwrap<ProcRow[]>(pr) ?? []).filter(Boolean));
    const wdData = unwrap<{ config?: Watchdog } & Watchdog>(wd);
    setWatchdog((wdData?.config ?? wdData) as Watchdog | null);
    setHistory(unwrap<Snapshot[]>(hist) ?? []);
  }, [serverId, range]);

  useEffect(() => {
    if (!moduleVisible) return;
    aliveRef.current = true;
    setLoading(true);
    void Promise.all([loadSnapshot(), loadRest()]).finally(() => {
      if (aliveRef.current) setLoading(false);
    });
    const timer = setInterval(() => void loadSnapshot(), 5000);
    return () => {
      aliveRef.current = false;
      clearInterval(timer);
    };
  }, [loadSnapshot, loadRest, moduleVisible]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSnapshot(), loadRest()]);
    if (aliveRef.current) setRefreshing(false);
  }, [loadSnapshot, loadRest]);

  // ── Salud (mismos umbrales que app) ─────────────────────────────────────
  const cpu = num(snap?.cpu?.usagePercent);
  const mem = num(snap?.memory?.usagePercent);
  const disk = num(snap?.disk?.usagePercent);
  const health = useMemo<{ level: "ok" | "warn" | "crit"; label: string }>(() => {
    if (cpu >= 88 || mem >= 90 || disk >= 92) return { level: "crit", label: t.healthCrit };
    if (cpu >= 70 || mem >= 75 || disk >= 80) return { level: "warn", label: t.healthWarn };
    return { level: "ok", label: t.healthOk };
  }, [cpu, mem, disk, t]);
  const healthClass =
    health.level === "crit"
      ? "bg-error/10 border-error/30 text-error"
      : health.level === "warn"
        ? "bg-warning/10 border-warning/30 text-warning"
        : "bg-success/10 border-success/30 text-success";
  const healthDotClass = health.level === "crit" ? "bg-error" : health.level === "warn" ? "bg-warning" : "bg-success";

  // ── Watchdog (edición) ──────────────────────────────────────────────────
  const [wdEnabled, setWdEnabled] = useState(false);
  const [wdCpu, setWdCpu] = useState("");
  const [wdMem, setWdMem] = useState("");
  const [wdSustained, setWdSustained] = useState("120");
  useEffect(() => {
    if (!watchdog) return;
    setWdEnabled(!!watchdog.enabled);
    setWdCpu(watchdog.cpuPercent != null ? String(watchdog.cpuPercent) : "");
    setWdMem(watchdog.memPercent != null ? String(watchdog.memPercent) : "");
    setWdSustained(String(watchdog.sustainedSeconds ?? 120));
  }, [watchdog]);

  const saveWatchdog = useCallback(async () => {
    setSavingWd(true);
    const toThreshold = (s: string): number | null => {
      const n = Number(s);
      if (!Number.isFinite(n) || n <= 0) return null;
      return Math.min(100, Math.max(50, Math.round(n)));
    };
    const body = {
      enabled: wdEnabled,
      cpuPercent: toThreshold(wdCpu),
      memPercent: toThreshold(wdMem),
      sustainedSeconds: Number(wdSustained) || 120,
    };
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", "/api/monitor/watchdog", body));
    setSavingWd(false);
    if (out.ok) {
      toast.success(t.watchdog.savedToast);
      void loadRest();
    } else toast.error(out.error ?? t.watchdog.errorToast);
  }, [wdEnabled, wdCpu, wdMem, wdSustained, serverId, toast, loadRest, t]);

  // ── Servicios ───────────────────────────────────────────────────────────
  const filteredServices = useMemo(
    () => services.filter((s) => (serviceTab === "all" ? true : serviceTab === "active" ? s.active : !s.active)),
    [services, serviceTab],
  );
  const activateService = useCallback(
    async (s: ServiceRow) => {
      setServiceBusy(s.name);
      const path = s.installed
        ? `/api/monitor/services/${encodeURIComponent(s.name)}/start`
        : `/api/monitor/services/${encodeURIComponent(s.name)}/install`;
      const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "POST", path));
      setServiceBusy(null);
      if (out.ok) {
        toast.success(formatMessage(t.services.startedToast, { name: s.name }));
        void loadRest();
      } else toast.error(formatMessage(s.installed ? t.services.startError : t.services.installError, { name: s.name }));
    },
    [serverId, toast, loadRest, t],
  );

  // ── Procesos (DataTable de desktop) ─────────────────────────────────────
  const procRows = useMemo<ProcTableRow[]>(
    () =>
      procs.map((p) => ({
        id: String(p.pid),
        pid: p.pid,
        name: p.name,
        user: p.user,
        cpu: num(p.cpuPercent),
        ramBytes: num(p.memRss),
        mem: num(p.memPercent),
      })),
    [procs],
  );
  const procColumns = useMemo<DataTableColumnConfig<ProcTableRow>[]>(
    () => [
      { id: "pid", header: t.processes.colPid, accessorKey: "pid" },
      { id: "name", header: t.processes.colName, accessorKey: "name", cell: (p) => <span className="font-mono text-xs">{p.name}</span> },
      { id: "user", header: t.processes.colUser, accessorKey: "user" },
      { id: "cpu", header: t.processes.colCpu, accessorKey: "cpu", cell: (p) => `${p.cpu.toFixed(1)}%` },
      { id: "ram", header: t.processes.colRam, accessorKey: "ramBytes", cell: (p) => fmtBytes(p.ramBytes) },
      { id: "mem", header: t.processes.colMem, accessorKey: "mem", cell: (p) => `${p.mem.toFixed(1)}%` },
    ],
    [t],
  );
  const procFilters = useMemo<DataTableFilterConfig<ProcTableRow>[]>(
    () => [
      { id: "search", label: t.processes.filterSearch, accessorKey: "name", type: "text" },
      { id: "user", label: t.processes.filterUser, accessorKey: "user", type: "text" },
    ],
    [t],
  );
  const procActions = useMemo<DataTableRowActionConfig<ProcTableRow>[]>(
    () => [{ id: "kill", label: t.processes.actionKill, variant: "danger" }],
    [t],
  );

  const killProcess = useCallback(
    async (row: ProcTableRow) => {
      const accepted = await confirm({
        title: t.killDialog.title,
        danger: true,
        confirmLabel: t.killDialog.confirmButton,
        cancelLabel: t.killDialog.cancelButton,
        message: (
          <span className="flex flex-col gap-2">
            <span>{t.killDialog.warningDetail}</span>
            <span>
              {t.killDialog.processLabel}: <span className="font-mono">{row.name}</span>
            </span>
            <span>
              {t.killDialog.pidLabel}: {row.pid}
            </span>
          </span>
        ),
      });
      if (!accepted) return;
      setKillingPid(row.pid);
      const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "POST", `/api/monitor/processes/${row.pid}/kill`));
      setKillingPid(null);
      if (out.ok) {
        toast.success(formatMessage(t.processes.killedToast, { pid: row.pid }));
        void loadRest();
      } else toast.error(out.error ?? t.processes.killError);
    },
    [confirm, serverId, toast, loadRest, t],
  );

  // ── Chart historial (series 0–100%) ─────────────────────────────────────
  const chartSeries = useMemo(
    () => [
      { color: CPU_COLOR, values: history.map((s) => num(s.cpu?.usagePercent)) },
      { color: RAM_COLOR, values: history.map((s) => num(s.memory?.usagePercent)) },
      { color: DISK_COLOR, values: history.map((s) => num(s.disk?.usagePercent)) },
    ],
    [history],
  );

  // ── Breakdown (doughnuts + top procesos) ────────────────────────────────
  const memUsed = num(snap?.memory?.usedBytes);
  const memTotal = num(snap?.memory?.totalBytes);
  const memFree = num(snap?.memory?.freeBytes) || Math.max(0, memTotal - memUsed);
  const diskUsed = num(snap?.disk?.usedBytes);
  const diskTotal = num(snap?.disk?.totalBytes);
  const diskFree = num(snap?.disk?.availableBytes) || Math.max(0, diskTotal - diskUsed);
  const rxRate = Math.max(0, num(snap?.network?.rxBytesPerSec));
  const txRate = Math.max(0, num(snap?.network?.txBytesPerSec));
  const topProcs = useMemo(() => {
    const val = (p: ProcRow) => (breakdownMetric === "cpu" ? num(p.cpuPercent) : num(p.memPercent));
    return [...procs].sort((a, b) => val(b) - val(a)).slice(0, 6);
  }, [procs, breakdownMetric]);
  const procMax = Math.max(1, ...topProcs.map((p) => (breakdownMetric === "cpu" ? num(p.cpuPercent) : num(p.memPercent))));

  // ── Render ──────────────────────────────────────────────────────────────
  if (guardCode) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.pageTitle}</h2>
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm text-error">{t.loadError}</p>
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
      {/* Cabecera + health pill + refrescar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-semibold">{t.pageTitle}</h2>
          <p className="text-xs text-base-content/60">{t.subtitle}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${healthClass}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${healthDotClass}`} />
          {health.label}
        </span>
        <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {c.refresh}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Cpu size={16} className="text-warning" />}
              label={t.stats.cpu}
              value={`${cpu.toFixed(0)}%`}
              pct={cpu}
              detail={`${t.stats.loadAvg} ${num(snap?.cpu?.loadAvg1m).toFixed(2)}`}
            />
            <StatCard
              icon={<Activity size={16} className="text-primary" />}
              label={t.stats.ram}
              value={`${mem.toFixed(0)}%`}
              pct={mem}
              detail={snap?.memory?.usedBytes ? `${fmtBytes(memUsed)} / ${fmtBytes(memTotal)}` : undefined}
            />
            <StatCard
              icon={<Database size={16} style={{ color: DISK_COLOR }} />}
              label={t.stats.disk}
              value={`${disk.toFixed(0)}%`}
              pct={disk}
              detail={snap?.disk?.usedBytes ? `${fmtBytes(diskUsed)} / ${fmtBytes(diskTotal)}` : undefined}
            />
            <StatCard
              icon={<Wifi size={16} className="text-success" />}
              label={t.stats.network}
              value={fmtRate(rxRate)}
              detail={`${t.stats.out} ${fmtRate(txRate)}`}
            />
          </div>

          {/* Historial */}
          <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">{t.history.title}</h3>
              <div className="flex gap-1.5">
                {(["1h", "6h", "24h", "7d"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`btn btn-xs ${range === r ? "btn-primary" : "btn-ghost border border-base-300"}`}
                    onClick={() => setRange(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {history.length > 1 ? (
              <LineChart series={chartSeries} height={150} />
            ) : (
              <p className="py-6 text-center text-xs text-base-content/50">{formatMessage(t.history.empty, { range })}</p>
            )}
            <div className="flex gap-4">
              <ChartLegend color={CPU_COLOR} label="CPU" />
              <ChartLegend color={RAM_COLOR} label="RAM" />
              <ChartLegend color={DISK_COLOR} label={t.stats.disk} />
            </div>
          </div>

          {/* Breakdown: doughnuts memoria/disco/red + top procesos */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DoughnutCard
              icon={<Activity size={15} className="text-primary" />}
              title={t.breakdown.memory}
              center={`${mem.toFixed(0)}%`}
              segments={[
                { value: memUsed, color: RAM_COLOR },
                { value: memFree, color: FREE_COLOR },
              ]}
              legends={[
                { color: RAM_COLOR, label: formatMessage(t.charts.memUsed, { size: fmtBytes(memUsed) }) },
                { color: FREE_COLOR, label: formatMessage(t.charts.memFree, { size: fmtBytes(memFree) }) },
              ]}
            />
            <DoughnutCard
              icon={<Database size={15} style={{ color: DISK_COLOR }} />}
              title={t.breakdown.disk}
              center={`${disk.toFixed(0)}%`}
              segments={[
                { value: diskUsed, color: DISK_COLOR },
                { value: diskFree, color: FREE_COLOR },
              ]}
              legends={[
                { color: DISK_COLOR, label: formatMessage(t.charts.diskUsed, { size: fmtBytes(diskUsed) }) },
                { color: FREE_COLOR, label: formatMessage(t.charts.diskFree, { size: fmtBytes(diskFree) }) },
              ]}
            />
            <DoughnutCard
              icon={<Wifi size={15} style={{ color: NET_IN_COLOR }} />}
              title={t.breakdown.network}
              center={fmtRate(rxRate + txRate)}
              segments={[
                { value: rxRate, color: NET_IN_COLOR },
                { value: txRate, color: NET_OUT_COLOR },
              ]}
              legends={[
                { color: NET_IN_COLOR, label: formatMessage(t.charts.netIn, { rate: fmtRate(rxRate) }) },
                { color: NET_OUT_COLOR, label: formatMessage(t.charts.netOut, { rate: fmtRate(txRate) }) },
              ]}
            />
            {/* Top procesos: mini-barras CPU/RAM (reusa los procesos sondeados) */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-base-300 bg-base-100 p-4">
              <div className="flex items-center gap-2">
                <Cpu size={15} className="text-warning" />
                <h3 className="min-w-0 flex-1 truncate text-[13px] font-bold">{t.breakdown.topProcesses}</h3>
              </div>
              <div className="flex gap-1">
                {(["cpu", "mem"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn btn-xs ${breakdownMetric === m ? "btn-primary" : "btn-ghost border border-base-300"}`}
                    onClick={() => setBreakdownMetric(m)}
                  >
                    {m === "cpu" ? t.charts.topCpu : t.charts.topRam}
                  </button>
                ))}
              </div>
              {topProcs.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-base-content/50">{t.charts.noProcesses}</p>
              ) : (
                topProcs.map((p, i) => {
                  const v = breakdownMetric === "cpu" ? num(p.cpuPercent) : num(p.memPercent);
                  const w = Math.min(100, Math.max(3, (v / procMax) * 100));
                  return (
                    <div key={p.pid} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-[11px] text-base-content/70">{p.name}</span>
                        <span className="text-[11px] tabular-nums text-base-content/50">{v.toFixed(1)}%</span>
                      </div>
                      <div className="h-[5px] overflow-hidden rounded-full" style={{ backgroundColor: TRACK_COLOR }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${w}%`, backgroundColor: POLAR[i % POLAR.length] }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Servicios */}
          <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
            <h3 className="text-sm font-bold">{t.services.title}</h3>
            <div className="flex gap-1.5">
              {(["all", "active", "inactive"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`btn btn-xs ${serviceTab === tab ? "btn-primary" : "btn-ghost border border-base-300"}`}
                  onClick={() => setServiceTab(tab)}
                >
                  {tab === "all" ? t.services.tabAll : tab === "active" ? t.services.tabActive : t.services.tabInactive}
                </button>
              ))}
            </div>
            {filteredServices.length === 0 ? (
              <p className="py-2 text-xs text-base-content/50">{t.services.empty}</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {filteredServices.map((s, idx) => (
                  <div
                    key={s.name}
                    className={`flex items-center gap-2.5 py-2 ${idx === filteredServices.length - 1 ? "" : "border-b border-base-300"}`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${s.active ? "bg-success" : s.installed ? "bg-error" : "bg-warning"}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
                    <span className="text-[11px] text-base-content/50">
                      {s.active ? t.services.badgeActive : s.installed ? t.services.badgeInactive : t.services.badgeNotInstalled}
                    </span>
                    {!s.active ? (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        disabled={serviceBusy === s.name}
                        onClick={() => void activateService(s)}
                      >
                        {serviceBusy === s.name ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : s.installed ? (
                          t.services.activate
                        ) : (
                          t.services.install
                        )}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Procesos */}
          <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
            <h3 className="text-sm font-bold">{t.processes.title}</h3>
            <DataTable<ProcTableRow>
              tableId="server-monitor-processes"
              title={t.processes.tableTitle}
              data={procRows}
              columns={procColumns}
              filters={procFilters}
              rowActions={procActions}
              language={language}
              loading={killingPid !== null}
              onRowAction={(actionId, row) => {
                if (actionId === "kill") void killProcess(row);
              }}
            />
          </div>

          {/* Watchdog */}
          <div className="flex max-w-2xl flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
            <div className="flex items-center gap-2">
              <RotateCcw size={16} className="text-warning" />
              <h3 className="min-w-0 flex-1 text-sm font-bold">{t.watchdog.title}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${wdEnabled ? "bg-success/15 text-success" : "bg-base-300 text-base-content/50"}`}
              >
                {wdEnabled ? t.watchdog.badgeActive : t.watchdog.badgeInactive}
              </span>
            </div>
            <p className="text-xs text-base-content/60">{t.watchdog.subtitle}</p>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={wdEnabled}
                onChange={(e) => setWdEnabled(e.target.checked)}
              />
              <span className="text-sm">{t.watchdog.enableLabel}</span>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-base-content/70">{t.watchdog.cpuLabel}</span>
                <input
                  type="number"
                  className="input input-bordered input-sm"
                  value={wdCpu}
                  placeholder="0"
                  min={0}
                  max={100}
                  onChange={(e) => setWdCpu(e.target.value)}
                />
                <span className="text-[11px] text-base-content/50">{t.watchdog.thresholdHint}</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-base-content/70">{t.watchdog.memLabel}</span>
                <input
                  type="number"
                  className="input input-bordered input-sm"
                  value={wdMem}
                  placeholder="0"
                  min={0}
                  max={100}
                  onChange={(e) => setWdMem(e.target.value)}
                />
                <span className="text-[11px] text-base-content/50">{t.watchdog.thresholdHint}</span>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-base-content/70">{t.watchdog.sustainedLabel}</span>
              <select
                className="select select-bordered select-sm w-full max-w-xs"
                value={wdSustained}
                onChange={(e) => setWdSustained(e.target.value)}
              >
                <option value="60">1 min</option>
                <option value="120">2 min</option>
                <option value="300">5 min</option>
                <option value="600">10 min</option>
                <option value="1800">30 min</option>
              </select>
            </label>
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {t.watchdog.warning}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm w-fit gap-1.5"
              onClick={() => void saveWatchdog()}
              disabled={savingWd}
            >
              {savingWd ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
              {t.watchdog.saveButton}
            </button>
          </div>
        </>
      )}

      {dialog}
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function barColorClass(pct: number): string {
  return pct >= 90 ? "bg-error" : pct >= 70 ? "bg-warning" : "bg-success";
}

function StatCard({
  icon,
  label,
  value,
  pct,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  pct?: number;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-base-300 bg-base-100 p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="min-w-0 flex-1 truncate text-xs text-base-content/60">{label}</span>
      </div>
      <span className="text-[22px] font-bold leading-tight tabular-nums">{value}</span>
      {pct != null ? (
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: TRACK_COLOR }}>
          <div
            className={`h-full rounded-full transition-all ${barColorClass(pct)}`}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
      ) : null}
      {detail ? <span className="truncate text-[11px] text-base-content/50">{detail}</span> : null}
    </div>
  );
}

function ChartLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-[3px] w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-base-content/50">{label}</span>
    </span>
  );
}

/**
 * LineChart — chart de historial como SVG inline (equivalente DOM del
 * `SvgLineChart` nativo de app). Valores 0–100 (%); `viewBox` normalizado
 * 0–100 × 0–100 con `preserveAspectRatio="none"` para llenar el ancho del
 * card, y `vector-effect: non-scaling-stroke` para que el trazo no se deforme.
 */
function LineChart({ series, height }: { series: { color: string; values: number[] }[]; height: number }) {
  const gridYs = [0, 25, 50, 75, 100];
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-hidden
    >
      {gridYs.map((y) => (
        <line
          key={y}
          x1={0}
          x2={100}
          y1={100 - y}
          y2={100 - y}
          stroke={TRACK_COLOR}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {series.map((s, i) => {
        const n = s.values.length;
        if (n < 2) return null;
        const points = s.values
          .map((v, idx) => {
            const x = (idx / (n - 1)) * 100;
            const y = 100 - Math.min(100, Math.max(0, v));
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(" ");
        return (
          <polyline
            key={i}
            points={points}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

/**
 * SvgDoughnut — anillo SVG inline con N segmentos contiguos (equivalente DOM
 * del de app): aro de fondo + un `<circle>` por segmento cuyo `strokeDasharray`
 * cubre su fracción, rotado a su ángulo de inicio (−90° = arriba). Si el total
 * es 0 solo se ve el aro de fondo.
 */
function SvgDoughnut({
  size,
  strokeWidth,
  segments,
}: {
  size: number;
  strokeWidth: number;
  segments: { value: number; color: string }[];
}) {
  const r = (size - strokeWidth) / 2;
  const cxy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  let covered = 0;
  return (
    <svg width={size} height={size} role="img" aria-hidden>
      <circle cx={cxy} cy={cxy} r={r} stroke={TRACK_COLOR} strokeWidth={strokeWidth} fill="none" />
      {total > 0
        ? segments.map((s, i) => {
            const frac = Math.max(0, s.value) / total;
            const startFrac = covered;
            covered += frac;
            if (frac <= 0) return null;
            return (
              <circle
                key={i}
                cx={cxy}
                cy={cxy}
                r={r}
                stroke={s.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${frac * circ} ${circ}`}
                strokeLinecap="butt"
                transform={`rotate(${-90 + startFrac * 360} ${cxy} ${cxy})`}
              />
            );
          })
        : null}
    </svg>
  );
}

function DoughnutCard({
  icon,
  title,
  center,
  segments,
  legends,
}: {
  icon: ReactNode;
  title: string;
  center: string;
  segments: { value: number; color: string }[];
  legends: { color: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-base-300 bg-base-100 p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-bold">{title}</h3>
      </div>
      <div className="relative grid h-[124px] place-items-center">
        <SvgDoughnut size={116} strokeWidth={15} segments={segments} />
        <span className="absolute text-[15px] font-bold tabular-nums">{center}</span>
      </div>
      <div className="flex flex-col gap-1">
        {legends.map((l, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="h-[9px] w-[9px] shrink-0 rounded-sm" style={{ backgroundColor: l.color }} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-base-content/50">{l.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
