import { nativeText } from '../../../i18n/native-text';
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { NativeOperationCard } from "../NativeOperationCard";
import { MonitorAlertsSettings } from "./MonitorAlertsSettings";
import { useDataAppActive } from "../../../lib/use-live-module-data";
import { useNativeModuleVisible } from "../../main/native-module-context";
/**
 * MonitorScreen — réplica nativa del módulo Monitor de LUXIPANEL
 * (`frontend/src/pages/panel/monitor/index.astro`). Stat cards en vivo (polling
 * del gateway `/api/monitor/snapshot`; el gateway es HTTP, no túnela el WebSocket
 * `/api/monitor/ws`, así que usamos el MISMO fallback de snapshot que el web),
 * health pill, chart de historial (SVG nativo), charts de breakdown (doughnuts
 * de memoria/disco/red + mini-barras de top procesos, SVG nativo), widget de
 * servicios, tabla de procesos + modal kill, y card de watchdog. AI-optimize
 * (picker de proveedor) no tiene equivalente nativo: queda fuera.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { Pressable, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha, type ThemeTokens } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { ServerDataTable, type ServerColumn, type ServerFilter, type ServerRowAction } from "../../../components/server/ServerDataTable";
import { ConfirmDialog, Field, Checkbox, InfoBox, DialogFooter } from "../../../components/server/Form";
import { SvgLineChart, type ChartSeries } from "../../../components/server/SvgLineChart";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Modal } from "../../../components/ui/Modal";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import {
  TablerCpu,
  TablerDeviceAnalytics,
  TablerDatabase,
  TablerWifi,
  TablerArrowDown,
  TablerArrowUp,
  TablerTrash,
  TablerDeviceFloppy,
  TablerRefreshAlert,
} from "../../../features/app/tabler-icons";
import { serverMonitorApi, callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";

const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE", "DIRECT_AUTH_REQUIRED"];

/** Paleta para las mini-barras de procesos (espejo de la polar-area del web). */
const POLAR = ["#f59e0b", "#a855f7", "#0ea5e9", "#10b981", "#ef4444", "#6366f1", "#ec4899"];

type Snapshot = {
  ts?: number;
  cpu?: { usagePercent?: number; loadAvg1m?: number };
  memory?: { usagePercent?: number; usedBytes?: number; freeBytes?: number; totalBytes?: number };
  disk?: { usagePercent?: number; usedBytes?: number; availableBytes?: number; totalBytes?: number };
  network?: { rxBytesPerSec?: number; txBytesPerSec?: number };
};
type ServiceRow = { name: string; active: boolean; installed: boolean; installable?: boolean };
type ProcRow = { pid: number; name: string; user: string; cpuPercent: number; memPercent: number; memRss: number };
type Watchdog = { enabled?: boolean; cpuPercent?: number | null; memPercent?: number | null; sustainedSeconds?: number };

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

export function MonitorScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const appActive=useDataAppActive();
  const moduleVisible=useNativeModuleVisible() && appActive;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverMonitor;

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [procs, setProcs] = useState<ProcRow[]>([]);
  const [watchdog, setWatchdog] = useState<Watchdog | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [processRefresh,setProcessRefresh]=useState("0");
  const [historyRefresh,setHistoryRefresh]=useState("0");
  const [range, setRange] = useState("1h");
  const [historyMetric,setHistoryMetric] = useState("all");
  const [compareHistory,setCompareHistory] = useState(false);
  const [previousHistory,setPreviousHistory] = useState<Snapshot[]>([]);
  const [processUpdatedAt,setProcessUpdatedAt] = useState<number|null>(null);
  const [diagnostics,setDiagnostics] = useState<{totalSamples:number;coverage:number}|null>(null);
  useEffect(()=>{
    let active=true;
    if(!compareHistory){setPreviousHistory([]);return;}
    const duration=({"1h":3600000,"6h":21600000,"24h":86400000,"7d":604800000} as Record<string,number>)[range];
    const end=Date.now()-duration;
    void callServerApi(panelId,token,"GET",`/api/monitor/history?from=${end-duration}&to=${end}`).then(response=>{if(active)setPreviousHistory(unwrap<Snapshot[]>(response)??[]);});
    return ()=>{active=false;};
  },[panelId,token,range,compareHistory]);
  const refreshDiagnostics=async()=>{
    await loadSnapshot();
    const end=Date.now();
    const response=await callServerApi(panelId,token,"GET",`/api/monitor/history?from=${end-3600000}&to=${end}&resolution=chart`);
    const data=unwrap<{totalSamples:number;bucketMs:number;buckets:unknown[]}>(response);
    if(data)setDiagnostics({totalSamples:data.totalSamples,coverage:Math.round(data.buckets.length/Math.ceil(3600000/data.bucketMs)*100)});
  };
  const exportHistory=async()=>{
    try{
      const uri=FileSystem.cacheDirectory+`monitor-${range}.csv`;
      const csv="fecha,cpu,ram,disco,red_recibida,red_enviada\n"+history.map(row=>[row.ts?new Date(row.ts).toISOString():"",row.cpu?.usagePercent??"",row.memory?.usagePercent??"",row.disk?.usagePercent??"",row.network?.rxBytesPerSec??"",row.network?.txBytesPerSec??""].join(",")).join("\n");
      await FileSystem.writeAsStringAsync(uri,csv);
      await Sharing.shareAsync(uri,{mimeType:"text/csv",dialogTitle:"Exportar historial"});
    }catch{showToast(nativeText("No se pudo exportar el historial."),true);}
  };
  const [serviceTab, setServiceTab] = useState<"all" | "active" | "inactive">("all");
  const [breakdownMetric, setBreakdownMetric] = useState<"cpu" | "mem">("cpu");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [chartW, setChartW] = useState(0);
  const [killProc, setKillProc] = useState<ProcRow | null>(null);
  const [killBusy, setKillBusy] = useState(false);
  const [savingWd, setSavingWd] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({ visible: false, variant: "success", message: "", nonce: 0 });
  const showToast = useCallback((message: string, err = false) => setToast((p) => ({ visible: true, variant: err ? "error" : "success", message, nonce: p.nonce + 1 })), []);

  const aliveRef = useRef(true);

  const loadSnapshot = useCallback(async () => {
    const res = await serverMonitorApi.snapshot(panelId, token);
    if (res.code && GUARDS.includes(res.code)) {
      setGuardCode(res.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    const data = unwrap<Snapshot>(res);
    if (data && aliveRef.current) setSnap(data);
  }, [panelId, token]);

  const loadRest = useCallback(async () => {
    const [svc, pr, wd, hist] = await Promise.all([
      serverMonitorApi.services(panelId, token),
      serverMonitorApi.processes(panelId, token),
      callServerApi(panelId, token, "GET", "/api/monitor/watchdog"),
      callServerApi(panelId, token, "GET", `/api/monitor/history?range=${encodeURIComponent(range)}`),
    ]);
    if (!aliveRef.current) return;
    setServices((unwrap<ServiceRow[]>(svc) ?? []).filter(Boolean));
    setProcs((unwrap<ProcRow[]>(pr) ?? []).filter(Boolean));
    if(pr.ok)setProcessUpdatedAt(Date.now());
    const wdData = unwrap<{ config?: Watchdog } & Watchdog>(wd);
    setWatchdog((wdData?.config ?? wdData) as Watchdog | null);
    setHistory(unwrap<Snapshot[]>(hist) ?? []);
  }, [panelId, token, range]);

  useEffect(() => {
    if (!moduleVisible) return;
    aliveRef.current = true;
    setLoading(true);
    void Promise.all([loadSnapshot(), loadRest()]).finally(() => aliveRef.current && setLoading(false));
    const timer = setInterval(() => void loadSnapshot(), 5000);
    return () => {
      aliveRef.current = false;
      clearInterval(timer);
    };
  }, [loadSnapshot, loadRest, moduleVisible]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSnapshot(), loadRest()]);
    setRefreshing(false);
  }, [loadSnapshot, loadRest]);

  // ── Salud ────────────────────────────────────────────────────────────────
  const cpu = num(snap?.cpu?.usagePercent);
  const mem = num(snap?.memory?.usagePercent);
  const disk = num(snap?.disk?.usagePercent);
  const health = useMemo<{ level: "ok" | "warn" | "crit"; label: string }>(() => {
    if (cpu >= 88 || mem >= 90 || disk >= 92) return { level: "crit", label: t.healthCrit };
    if (cpu >= 70 || mem >= 75 || disk >= 80) return { level: "warn", label: t.healthWarn };
    return { level: "ok", label: t.healthOk };
  }, [cpu, mem, disk, t]);
  const healthColor = health.level === "crit" ? tokens.danger : health.level === "warn" ? tokens.warning : tokens.success;

  useEffect(()=>{
    if(!moduleVisible || Number(processRefresh)===0)return;
    const timer=setInterval(()=>{void serverMonitorApi.processes(panelId,token).then(response=>{if(aliveRef.current&&response.ok)setProcs((unwrap<ProcRow[]>(response)??[]).filter(Boolean));});},Number(processRefresh)*1000);
    return ()=>clearInterval(timer);
  },[moduleVisible,processRefresh,panelId,token]);
  useEffect(()=>{
    if(!moduleVisible || Number(historyRefresh)===0)return;
    const timer=setInterval(()=>{void callServerApi(panelId,token,"GET",`/api/monitor/history?range=${encodeURIComponent(range)}`).then(response=>{if(aliveRef.current&&response.ok)setHistory(unwrap<Snapshot[]>(response)??[]);});},Number(historyRefresh)*1000);
    return ()=>clearInterval(timer);
  },[moduleVisible,historyRefresh,range,panelId,token]);
  // ── Watchdog (edición) ───────────────────────────────────────────────────
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
    const body = { ...watchdog, enabled: wdEnabled, cpuPercent: toThreshold(wdCpu), memPercent: toThreshold(wdMem), sustainedSeconds: Number(wdSustained) || 120 };
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", "/api/monitor/watchdog", body));
    setSavingWd(false);
    if (out.ok) {
      showToast(t.watchdog.savedToast);
      void loadRest();
    } else showToast(out.error ?? t.watchdog.errorToast, true);
  }, [watchdog, wdEnabled, wdCpu, wdMem, wdSustained, panelId, token, showToast, loadRest, t]);

  // ── Servicios ────────────────────────────────────────────────────────────
  const filteredServices = useMemo(
    () => services.filter((s) => (serviceTab === "all" ? true : serviceTab === "active" ? s.active : !s.active)),
    [services, serviceTab],
  );
  const activateService = useCallback(
    async (s: ServiceRow) => {
      const path = s.installed ? `/api/monitor/services/${encodeURIComponent(s.name)}/start` : `/api/monitor/services/${encodeURIComponent(s.name)}/install`;
      const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", path));
      if (out.ok) {
        showToast(formatMessage(t.services.startedToast, { name: s.name }));
        void loadRest();
      } else showToast(formatMessage(s.installed ? t.services.startError : t.services.installError, { name: s.name }), true);
    },
    [panelId, token, showToast, loadRest, t],
  );

  // ── Procesos ─────────────────────────────────────────────────────────────
  const procColumns: ServerColumn<ProcRow>[] = useMemo(
    () => [
      { id: "pid", header: t.processes.colPid, cell: (p) => String(p.pid), sortable: true, sortValue: (p) => p.pid, width: 80 },
      { id: "name", header: t.processes.colName, cell: (p) => p.name, sortable: true, sortValue: (p) => p.name, width: 170 },
      { id: "user", header: t.processes.colUser, cell: (p) => p.user, width: 120 },
      { id: "cpu", header: t.processes.colCpu, cell: (p) => `${num(p.cpuPercent).toFixed(1)}%`, sortable: true, sortValue: (p) => num(p.cpuPercent), width: 90 },
      { id: "ram", header: t.processes.colRam, cell: (p) => fmtBytes(num(p.memRss)), width: 100 },
      { id: "mem", header: t.processes.colMem, cell: (p) => `${num(p.memPercent).toFixed(1)}%`, sortable: true, sortValue: (p) => num(p.memPercent), width: 90 },
    ],
    [t],
  );
  const procFilters: ServerFilter<ProcRow>[] = useMemo(
    () => [
      { id: "search", kind: "search", placeholder: t.processes.filterSearch, match: (p, q) => p.name.toLowerCase().includes(q) },
      { id: "user", kind: "search", placeholder: t.processes.filterUser, match: (p, q) => p.user.toLowerCase().includes(q) },
    ],
    [t],
  );
  const procActions: ServerRowAction[] = useMemo(() => [{ id: "kill", label: t.processes.actionKill, icon: <TablerTrash size={18} />, danger: true }], [t]);

  const confirmKill = useCallback(async () => {
    if (!killProc) return;
    setKillBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", `/api/monitor/processes/${killProc.pid}/kill`));
    setKillBusy(false);
    if (out.ok) {
      showToast(formatMessage(t.processes.killedToast, { pid: killProc.pid }));
      void loadRest();
    } else throw new Error(out.error ?? t.processes.killError);
    setKillProc(null);
  }, [killProc, panelId, token, showToast, loadRest, t]);

  // ── Chart historial ───────────────────────────────────────────────────────
  const chartSeries: ChartSeries[] = useMemo(() => {
    const series = (rows:Snapshot[],previous=false) => [
      {metric:"cpu",color:tokens.warning,values:rows.map(s=>num(s.cpu?.usagePercent))},
      {metric:"ram",color:tokens.brand,values:rows.map(s=>num(s.memory?.usagePercent))},
      {metric:"disk",color:"#0ea5e9",values:rows.map(s=>num(s.disk?.usagePercent))},
      {metric:"network",color:"#10b981",values:rows.map(s=>num(s.network?.rxBytesPerSec))},
      {metric:"network",color:"#6366f1",values:rows.map(s=>num(s.network?.txBytesPerSec))},
    ].filter(item=>historyMetric === "all" ? item.metric !== "network" : item.metric === historyMetric).map(item=>({...item,color:previous?withAlpha(item.color,0.35):item.color}));
    return [...(compareHistory?series(previousHistory,true):[]),...series(history)];
  }, [history, previousHistory, historyMetric, compareHistory, tokens]);

  // ── Breakdown (doughnuts mem/disco/red + mini-barras de procesos) ───────────
  const RAM_COLOR = tokens.brand;
  const DISK_COLOR = "#0ea5e9";
  const NET_IN_COLOR = "#10b981";
  const NET_OUT_COLOR = "#6366f1";
  const trackColor = withAlpha(tokens.textMuted, 0.15);
  const freeColor = withAlpha(tokens.textMuted, 0.3);
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

  // ── Render ─────────────────────────────────────────────────────────────────
  // OJO: `StatCard`, `DoughnutCard` y las filas de servicio viven a nivel de
  // MÓDULO (abajo). Declararlos aquí dentro creaba un TIPO de componente nuevo
  // en cada render, así que el poll de 8 s desmontaba y remontaba las 4 stat
  // cards y los 3 doughnuts SVG nativos enteros. De ahí los tirones.
  const cardStyle = useMemo(
    () => ({ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, padding: 14, gap: 10 }) as const,
    [tokens],
  );
  const h2 = useMemo(() => ({ color: tokens.textPrimary, fontSize: 15, fontWeight: "700" }) as const, [tokens]);

  // Callbacks estables para la tabla de procesos: si son arrows inline rompen la
  // memoización de las filas de `ServerDataTable`.
  const procRowKey = useCallback((p: ProcRow) => String(p.pid), []);
  const onProcRowAction = useCallback((id: string, row: ProcRow) => {
    if (id === "kill") setKillProc(row);
  }, []);

  return (
    <>
      <ServerModuleScreen
        title={t.pageTitle}
        subtitle={t.subtitle}
        onBack={onBack}
        settingsPages={[
          {key:"view",get label() { return nativeText("Vista y tablas"); },content:<Field label={nativeText("Actualizar procesos")}><Select value={processRefresh} onChange={setProcessRefresh} options={[{value:"0",get label() { return nativeText("Manual"); }},...['15','30','60'].map(value=>({value,label:nativeText("{p0} segundos", {p0:value})}))]}/></Field>},
          {key:"history",label:t.history.title,content:<View style={{gap:12}}><Field label={nativeText("Rango")}><Select value={range} onChange={setRange} options={["1h","6h","24h","7d"].map(value=>({value,label:nativeText(value)}))}/></Field><Field label={nativeText("Métrica inicial")}><Select value={historyMetric} onChange={setHistoryMetric} options={[{value:"all",get label() { return nativeText("Todos los recursos"); }},{value:"cpu",get label() { return nativeText("CPU"); }},{value:"ram",get label() { return nativeText("RAM"); }},{value:"disk",get label() { return nativeText("Disco"); }},{value:"network",get label() { return nativeText("Red"); }}]}/></Field><Checkbox value={compareHistory} onChange={setCompareHistory} label={nativeText("Comparar con el período anterior")}/><Field label={nativeText("Actualizar historial")}><Select value={historyRefresh} onChange={setHistoryRefresh} options={[{value:"0",get label() { return nativeText("Manual"); }},...['30','60','120'].map(value=>({value,label:nativeText("{p0} segundos", {p0:value})}))]}/></Field><Button label={nativeText("Exportar historial")} variant="secondary" disabled={!history.length} onPress={()=>void exportHistory()}/></View>},
          {key:"alerts",get label() { return nativeText("Alertas"); },content:<MonitorAlertsSettings panelId={panelId} token={token}/>},
          {key:"watchdog",get label() { return nativeText("Protección de reinicios"); },content:<NativeOperationCard embedded title={nativeText("Protección de reinicios")} panelId={panelId} token={token} readPath="/api/monitor/watchdog" path="/api/monitor/watchdog" selectData={value=>{const data=(value??{}) as {config?:Record<string,unknown>};return data.config??data;}} fields={[{key:"intervalSeconds",get label() { return nativeText("Comprobar cada (segundos)"); },type:"number",min:5,max:300},{key:"bootGraceMinutes",get label() { return nativeText("Espera tras arranque (minutos)"); },type:"number",min:2,max:120},{key:"cooldownMinutes",get label() { return nativeText("Espera entre reinicios (minutos)"); },type:"number",min:5,max:1440}]} toBody={v=>v} onSaved={()=>void loadRest()}/>},
          {key:"diagnostics",get label() { return nativeText("Diagnóstico"); },content:<View style={{gap:12}}><Text style={{color:tokens.textSecondary}}>{nativeText("Última lectura:")}{" "}{snap?.ts?new Date(snap.ts).toLocaleString():"—"}</Text><Text style={{color:tokens.textSecondary}}>{nativeText("Procesos actualizados:")}{" "}{processUpdatedAt?new Date(processUpdatedAt).toLocaleString():"—"}</Text><Text style={{color:tokens.textSecondary}}>{nativeText("Muestras (última hora):")}{" "}{diagnostics?.totalSamples??"—"}</Text><Text style={{color:tokens.textSecondary}}>{nativeText("Cobertura:")}{" "}{diagnostics?`${diagnostics.coverage}%`:"—"}</Text><Button label={nativeText("Actualizar diagnósticos")} onPress={()=>void refreshDiagnostics()}/></View>}

        ]}
        guardCode={guardCode}
        onRetry={onRefresh}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        {/* Health pill */}
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: withAlpha(healthColor, 0.08), borderColor: withAlpha(healthColor, 0.3) }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: healthColor }} />
            <Text style={{ color: healthColor, fontSize: 12, fontWeight: "600" }}>{health.label}</Text>
          </View>
        </View>

        {/* Stat cards */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
          <StatCard tokens={tokens} icon={<TablerCpu size={18} color={tokens.warning} />} label={t.stats.cpu} value={`${cpu.toFixed(0)}%`} pct={cpu} detail={`${t.stats.loadAvg} ${num(snap?.cpu?.loadAvg1m).toFixed(2)}`} />
          <StatCard tokens={tokens} icon={<TablerDeviceAnalytics size={18} color={tokens.brand} />} label={t.stats.ram} value={`${mem.toFixed(0)}%`} pct={mem} detail={snap?.memory?.usedBytes ? `${fmtBytes(num(snap.memory.usedBytes))} / ${fmtBytes(num(snap.memory.totalBytes))}` : undefined} />
          <StatCard tokens={tokens} icon={<TablerDatabase size={18} color="#0ea5e9" />} label={t.stats.disk} value={`${disk.toFixed(0)}%`} pct={disk} detail={snap?.disk?.usedBytes ? `${fmtBytes(num(snap.disk.usedBytes))} / ${fmtBytes(num(snap.disk.totalBytes))}` : undefined} />
          <StatCard
            tokens={tokens}
            icon={<TablerWifi size={18} color={tokens.success} />}
            label={t.stats.network}
            value={fmtRate(num(snap?.network?.rxBytesPerSec))}
            detail={`${t.stats.out} ${fmtRate(num(snap?.network?.txBytesPerSec))}`}
          />
        </View>

        {/* Historial */}
        <View style={cardStyle} onLayout={(e) => setChartW(e.nativeEvent.layout.width - 28)}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={h2}>{t.history.title}</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(["1h", "6h", "24h", "7d"] as const).map((r) => (
                <Pressable key={r} onPress={() => setRange(r)} style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: range === r ? tokens.brand : "transparent", borderWidth: 1, borderColor: range === r ? tokens.brand : tokens.border }}>
                  <Text style={{ color: range === r ? "#fff" : tokens.textSecondary, fontSize: 12 }}>{nativeText(r)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {history.length > 1 && chartW > 0 ? (
            <SvgLineChart width={chartW} height={150} series={chartSeries} gridColor={withAlpha(tokens.textMuted, 0.2)} />
          ) : (
            <Text style={{ color: tokens.textMuted, fontSize: 12, paddingVertical: 24, textAlign: "center" }}>{formatMessage(t.history.empty, { range })}</Text>
          )}
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Legend color={tokens.warning} label={nativeText("CPU")} />
            <Legend color={tokens.brand} label={nativeText("RAM")} />
            <Legend color="#0ea5e9" label={t.stats.disk} />
          </View>
        </View>

        {/* Breakdown: doughnuts de memoria/disco/red + top procesos */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
          <DoughnutCard
            tokens={tokens}
            cardStyle={cardStyle}
            trackColor={trackColor}
            icon={<TablerDeviceAnalytics size={16} color={RAM_COLOR} />}
            title={t.breakdown.memory}
            center={`${mem.toFixed(0)}%`}
            segments={[{ value: memUsed, color: RAM_COLOR }, { value: memFree, color: freeColor }]}
            legends={[
              { color: RAM_COLOR, label: formatMessage(t.charts.memUsed, { size: fmtBytes(memUsed) }) },
              { color: freeColor, label: formatMessage(t.charts.memFree, { size: fmtBytes(memFree) }) },
            ]}
          />
          <DoughnutCard
            tokens={tokens}
            cardStyle={cardStyle}
            trackColor={trackColor}
            icon={<TablerDatabase size={16} color={DISK_COLOR} />}
            title={t.breakdown.disk}
            center={`${disk.toFixed(0)}%`}
            segments={[{ value: diskUsed, color: DISK_COLOR }, { value: diskFree, color: freeColor }]}
            legends={[
              { color: DISK_COLOR, label: formatMessage(t.charts.diskUsed, { size: fmtBytes(diskUsed) }) },
              { color: freeColor, label: formatMessage(t.charts.diskFree, { size: fmtBytes(diskFree) }) },
            ]}
          />
          <DoughnutCard
            tokens={tokens}
            cardStyle={cardStyle}
            trackColor={trackColor}
            icon={<TablerWifi size={16} color={NET_IN_COLOR} />}
            title={t.breakdown.network}
            center={fmtRate(rxRate + txRate)}
            segments={[{ value: rxRate, color: NET_IN_COLOR }, { value: txRate, color: NET_OUT_COLOR }]}
            legends={[
              { color: NET_IN_COLOR, label: formatMessage(t.charts.netIn, { rate: fmtRate(rxRate) }) },
              { color: NET_OUT_COLOR, label: formatMessage(t.charts.netOut, { rate: fmtRate(txRate) }) },
            ]}
          />
          {/* Top procesos: mini-barras CPU/RAM (reusa los procesos ya sondeados) */}
          <View style={{ ...cardStyle, width: "48%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TablerCpu size={16} color={tokens.warning} />
              <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "700", flex: 1 }} numberOfLines={1}>{t.breakdown.topProcesses}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {(["cpu", "mem"] as const).map((m) => (
                <Pressable key={m} onPress={() => setBreakdownMetric(m)} style={{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: breakdownMetric === m ? tokens.brand : "transparent", borderWidth: 1, borderColor: breakdownMetric === m ? tokens.brand : tokens.border }}>
                  <Text style={{ color: breakdownMetric === m ? "#fff" : tokens.textSecondary, fontSize: 11 }}>{m === "cpu" ? t.charts.topCpu : t.charts.topRam}</Text>
                </Pressable>
              ))}
            </View>
            {topProcs.length === 0 ? (
              <Text style={{ color: tokens.textMuted, fontSize: 11, paddingVertical: 12, textAlign: "center" }}>{t.charts.noProcesses}</Text>
            ) : (
              topProcs.map((p, i) => {
                const v = breakdownMetric === "cpu" ? num(p.cpuPercent) : num(p.memPercent);
                const w = Math.min(100, Math.max(3, (v / procMax) * 100));
                return (
                  <View key={p.pid} style={{ gap: 3 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 6 }}>
                      <Text style={{ color: tokens.textSecondary, fontSize: 11, flex: 1 }} numberOfLines={1}>{p.name}</Text>
                      <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{v.toFixed(1)}%</Text>
                    </View>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: trackColor, overflow: "hidden" }}>
                      <View style={{ width: `${w}%`, height: 5, borderRadius: 3, backgroundColor: POLAR[i % POLAR.length] }} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Servicios */}
        <View style={cardStyle}>
          <Text style={h2}>{t.services.title}</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["all", "active", "inactive"] as const).map((tab) => (
              <Pressable key={tab} onPress={() => setServiceTab(tab)} style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: serviceTab === tab ? tokens.brand : "transparent", borderWidth: 1, borderColor: serviceTab === tab ? tokens.brand : tokens.border }}>
                <Text style={{ color: serviceTab === tab ? "#fff" : tokens.textSecondary, fontSize: 12 }}>{tab === "all" ? t.services.tabAll : tab === "active" ? t.services.tabActive : t.services.tabInactive}</Text>
              </Pressable>
            ))}
          </View>
          {filteredServices.length === 0 ? (
            <Text style={{ color: tokens.textMuted, fontSize: 12, paddingVertical: 8 }}>{t.services.empty}</Text>
          ) : (
            // Un servidor real tiene 100–300 unidades systemd. Las filas están
            // MEMOIZADAS: así el poll de 8 s (que sólo cambia `snap`/`history`,
            // no `services`) ya no vuelve a renderizarlas todas.
            filteredServices.map((s, idx) => (
              <ServiceRowItem
                key={s.name}
                service={s}
                isLast={idx === filteredServices.length - 1}
                tokens={tokens}
                onActivate={activateService}
                labelActive={t.services.badgeActive}
                labelInactive={t.services.badgeInactive}
                labelNotInstalled={t.services.badgeNotInstalled}
                activateLabel={t.services.activate}
                installLabel={t.services.install}
              />
            ))
          )}
        </View>

        {/* Procesos */}
        <View style={cardStyle}>
          <Text style={h2}>{t.processes.title}</Text>
          <ServerDataTable
            settingsId="processes" title={t.processes.tableTitle}
            columns={procColumns}
            rows={procs}
            rowKey={procRowKey}
            filters={procFilters}
            rowActions={procActions}
            loading={loading}
            onRowAction={onProcRowAction}
          />
        </View>

        {/* Watchdog */}
        <View style={cardStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TablerRefreshAlert size={18} color={tokens.warning} />
            <Text style={[h2, { flex: 1 }]}>{t.watchdog.title}</Text>
            <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: withAlpha(wdEnabled ? tokens.success : tokens.textMuted, 0.12) }}>
              <Text style={{ color: wdEnabled ? tokens.success : tokens.textMuted, fontSize: 11 }}>{wdEnabled ? t.watchdog.badgeActive : t.watchdog.badgeInactive}</Text>
            </View>
          </View>
          <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.watchdog.subtitle}</Text>
          <Checkbox value={wdEnabled} onChange={setWdEnabled} label={t.watchdog.enableLabel} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label={t.watchdog.cpuLabel} hint={t.watchdog.thresholdHint}>
                <Input value={wdCpu} onChangeText={setWdCpu} keyboardType="number-pad" placeholder="0" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t.watchdog.memLabel} hint={t.watchdog.thresholdHint}>
                <Input value={wdMem} onChangeText={setWdMem} keyboardType="number-pad" placeholder="0" />
              </Field>
            </View>
          </View>
          <Field label={t.watchdog.sustainedLabel}>
            <Select
              value={wdSustained}
              onChange={setWdSustained}
              options={[
                { value: "60", get label() { return nativeText("1 min"); } },
                { value: "120", get label() { return nativeText("2 min"); } },
                { value: "300", get label() { return nativeText("5 min"); } },
                { value: "600", get label() { return nativeText("10 min"); } },
                { value: "1800", get label() { return nativeText("30 min"); } },
              ]}
            />
          </Field>
          <InfoBox tone="warn">{t.watchdog.warning}</InfoBox>
          <Button label={t.watchdog.saveButton} icon={<TablerDeviceFloppy size={16} />} onPress={saveWatchdog} loading={savingWd} />
        </View>
      </ServerModuleScreen>

      {/* Kill confirm */}
      {killProc ? (
        <Modal
          visible
          onClose={() => setKillProc(null)}
          title={t.killDialog.title}
          language={language}
          footer={<DialogFooter onCancel={() => setKillProc(null)} cancelLabel={t.killDialog.cancelButton} onSubmit={confirmKill} submitLabel={t.killDialog.confirmButton} submitting={killBusy} danger />}
        >
          <InfoBox tone="warn">{t.killDialog.warningDetail}</InfoBox>
          <Text style={{ color: tokens.textSecondary, fontSize: 13 }}>
            {t.killDialog.processLabel}: <Text style={{ fontFamily: "monospace" }}>{killProc.name}</Text>
          </Text>
          <Text style={{ color: tokens.textSecondary, fontSize: 13 }}>
            {t.killDialog.pidLabel}: {killProc.pid}
          </Text>
        </Modal>
      ) : null}

      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}

// ── Subcomponentes memoizados (nivel de módulo) ──────────────────────────────
// Estaban declarados DENTRO de `MonitorScreen`, así que cada render creaba un
// tipo nuevo y React desmontaba/remontaba el subárbol entero — incluidos los
// `<Svg>` nativos de los doughnuts — en cada tick del poll de 8 s.

function barColorOf(pct: number, tokens: ThemeTokens): string {
  return pct >= 90 ? tokens.danger : pct >= 70 ? tokens.warning : tokens.success;
}

const StatCard = React.memo(function StatCard({
  icon,
  label,
  value,
  pct,
  detail,
  tokens,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct?: number;
  detail?: string;
  tokens: ThemeTokens;
}) {
  return (
    <View style={{ width: "48%", borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon}
        <Text style={{ color: tokens.textMuted, fontSize: 12, flex: 1 }} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={{ color: tokens.textPrimary, fontSize: 22, fontWeight: "700" }}>{value}</Text>
      {pct != null ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: withAlpha(tokens.textMuted, 0.15), overflow: "hidden" }}>
          <View style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: 6, borderRadius: 3, backgroundColor: barColorOf(pct, tokens) }} />
        </View>
      ) : null}
      {detail ? <Text style={{ color: tokens.textMuted, fontSize: 11 }} numberOfLines={1}>{detail}</Text> : null}
    </View>
  );
});

const DoughnutCard = React.memo(function DoughnutCard({
  icon,
  title,
  center,
  segments,
  legends,
  tokens,
  cardStyle,
  trackColor,
}: {
  icon: React.ReactNode;
  title: string;
  center: string;
  segments: { value: number; color: string }[];
  legends: { color: string; label: string }[];
  tokens: ThemeTokens;
  cardStyle: object;
  trackColor: string;
}) {
  return (
    <View style={{ ...cardStyle, width: "48%" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon}
        <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "700", flex: 1 }} numberOfLines={1}>{title}</Text>
      </View>
      <View style={{ alignItems: "center", justifyContent: "center", height: 124 }}>
        <SvgDoughnut size={116} strokeWidth={15} segments={segments} trackColor={trackColor} />
        <View style={{ position: "absolute", alignItems: "center" }}>
          <Text style={{ color: tokens.textPrimary, fontSize: 15, fontWeight: "700" }} numberOfLines={1}>{center}</Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        {legends.map((l, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: l.color }} />
            <Text style={{ color: tokens.textMuted, fontSize: 11, flex: 1 }} numberOfLines={1}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

/** Fila del widget de servicios (100–300 unidades systemd en un servidor real). */
const ServiceRowItem = React.memo(function ServiceRowItem({
  service,
  isLast,
  tokens,
  onActivate,
  labelActive,
  labelInactive,
  labelNotInstalled,
  activateLabel,
  installLabel,
}: {
  service: ServiceRow;
  isLast: boolean;
  tokens: ThemeTokens;
  onActivate: (s: ServiceRow) => void;
  labelActive: string;
  labelInactive: string;
  labelNotInstalled: string;
  activateLabel: string;
  installLabel: string;
}) {
  const press = useCallback(() => onActivate(service), [onActivate, service]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: tokens.border }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: service.active ? tokens.success : service.installed ? tokens.danger : tokens.warning }} />
      <Text style={{ color: tokens.textPrimary, fontSize: 13, flex: 1 }} numberOfLines={1}>{service.name}</Text>
      <Text style={{ color: tokens.textMuted, fontSize: 11 }}>
        {service.active ? labelActive : service.installed ? labelInactive : labelNotInstalled}
      </Text>
      {!service.active ? (
        <Button label={service.installed ? activateLabel : installLabel} size="sm" variant="secondary" onPress={press} />
      ) : null}
    </View>
  );
});

function Legend({ color, label }: { color: string; label: string }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

/**
 * SvgDoughnut — anillo nativo (react-native-svg) con N segmentos contiguos.
 * Dibuja un aro de fondo (`trackColor`) y, sobre él, cada segmento como un
 * `<Circle>` cuyo `strokeDasharray` cubre su fracción; cada uno va envuelto en un
 * `<G>` rotado a su ángulo de inicio (−90° = arriba), así no dependemos del signo
 * del dashoffset. Si el total es 0 solo se ve el aro de fondo.
 */
function SvgDoughnut({
  size,
  strokeWidth,
  segments,
  trackColor,
}: {
  size: number;
  strokeWidth: number;
  segments: { value: number; color: string }[];
  trackColor: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  let covered = 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      {total > 0
        ? segments.map((s, i) => {
            const frac = Math.max(0, s.value) / total;
            const startFrac = covered;
            covered += frac;
            if (frac <= 0) return null;
            return (
              <G key={i} rotation={-90 + startFrac * 360} originX={c} originY={c}>
                <Circle
                  cx={c}
                  cy={c}
                  r={r}
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={[frac * circ, circ]}
                  strokeLinecap="butt"
                />
              </G>
            );
          })
        : null}
    </Svg>
  );
}
