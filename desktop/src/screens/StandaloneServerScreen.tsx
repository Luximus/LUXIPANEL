import { LiveDataStatus } from "../components/LiveDataStatus";
import {serverUserModuleLabel} from "../i18n/server-user-messages";
/* eslint-disable react-hooks/set-state-in-effect -- carga catálogo/uso al conectar */
import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bot, ChevronDown, ChevronRight, Code2, FolderTree, LayoutGrid, RadioTower, RefreshCw, X } from "lucide-react";
import type { ThemeMode } from "../features/app/types";
import { ensureTarget, serverModulesViewApi, serverMonitorApi, unregisterDirectServer, unwrap } from "../api/serverApi";
import type { DirectSession } from "../api/directAuth";
import { registerStandaloneTarget } from "../lib/standalone-connect";
import type { StandaloneServer } from "../lib/standalone-servers";
import { getMessages } from "../i18n";
import { NativeModuleVisibility } from "./server/module-visibility";
import { MODULE_COMPONENTS, NativePendingPanel } from "./server/module-host";

const PersistentDesktopModule=memo(function PersistentDesktopModule({id,visible,serverId,title,language,theme}:{id:string;visible:boolean;serverId:string;title:string;language?:string;theme:ThemeMode}) {
 const Module=MODULE_COMPONENTS[id];return <NativeModuleVisibility.Provider value={visible}><div data-native-module={id} hidden={!visible} inert={!visible} aria-hidden={!visible} style={{display:visible?undefined:'none'}}><LiveDataStatus serverId={serverId} moduleId={id} language={language}/>{Module?<Module serverId={serverId} moduleLabel={title} language={language} theme={theme}/>:<NativePendingPanel title={title} language={language}/>}</div></NativeModuleVisibility.Provider>;
});
type ModuleRow = { id: string; name?: string; title?: string; label?: string; enabled?: boolean; showInSidebar?: boolean };
type Usage = { cpu?: { usagePercent?: number }; memory?: { usagePercent?: number }; disk?: { usagePercent?: number } };
const labelOf = (m: ModuleRow) => m.title?.trim() || m.label?.trim() || m.name?.trim() || m.id;
const pct = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Math.round(Number(value)))) : null;

function Meter({ label, value }: { label: string; value: number | null }) {
  return <div className="space-y-1 text-[11px]"><div className="flex justify-between"><span>{label}</span><span className="font-mono">{value === null ? "—" : `${value}%`}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-base-300"><div className="h-full rounded-full bg-primary" style={{ width: `${value ?? 0}%` }} /></div></div>;
}

/** Local React workspace shared by directory servers and independent servers. */
export function StandaloneServerScreen({ server, session, theme, language, onBack }: {
  server: StandaloneServer;
  /** In-memory SSO or manual login from the portal directory. */
  session?: DirectSession;
  theme: ThemeMode;
  language?: string;
  onBack: () => void;
}) {
  const t = getMessages(language).serverStandalone;
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [modulesError, setModulesError] = useState(false);
  const [selected, setSelected] = useState<string>("assistant");
  const owner=`${server.id}:${session?.jwt??server.username}`;
  const [visitedState,setVisitedState]=useState<{owner:string;ids:Set<string>}>({owner,ids:new Set()});
  const visited=visitedState.owner===owner?visitedState.ids:new Set<string>();
  const opener=useRef<HTMLElement|null>(null);
  const closeModule=useCallback(()=>{setSelected("assistant");if(opener.current?.isConnected)opener.current.focus();},[]);
  useEffect(()=>{setVisitedState({owner,ids:new Set()});setSelected("assistant");},[owner]);
  useEffect(()=>{if(selected!=="assistant")setVisitedState(previous=>({owner,ids:new Set(previous.owner===owner?previous.ids:[]).add(selected)}));},[selected,owner]);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key!=="Escape"||event.defaultPrevented||selected==="assistant")return;const visibleModal=[...document.querySelectorAll<HTMLElement>(".lp-modal-overlay,dialog[open],[role='dialog']:not([data-module-host])")].some(node=>node.getClientRects().length>0);if(visibleModal)return;event.preventDefault();closeModule();};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[selected,closeModule]);
  const [devOpen, setDevOpen] = useState(true);
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let alive = true;
    setReady(false);
    setAuthError(false);
    void (async () => {
      const ok = session?.jwt
        ? Boolean(ensureTarget(server.id, { baseUrl: server.baseUrl, username: server.username, session }))
        : await registerStandaloneTarget(server);
      if (!alive) return;
      if (ok) setReady(true);
      else setAuthError(true);
    })();
    return () => { alive = false; unregisterDirectServer(server.id); };
  }, [server.id,server.baseUrl,server.username,session?.jwt]);

  const loadModules = useCallback(async () => {
    setLoadingModules(true);
    const response = await serverModulesViewApi.installed(server.id, "");
    if (response.status === 401) { setAuthError(true); setLoadingModules(false); return; }
    const rows = unwrap<ModuleRow[]>(response);
    setModulesError(!response.ok || !Array.isArray(rows));
    setModules((Array.isArray(rows) ? rows : []).filter((m): m is ModuleRow => Boolean(m?.id) && m.enabled !== false));
    setLoadingModules(false);
  }, [server.id]);

  useEffect(() => { if (ready) void loadModules(); }, [ready, loadModules]);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const refresh = async () => {
      const result = await serverMonitorApi.snapshot(server.id, "");
      if (alive && result.status === 401) { setAuthError(true); return; }
      if (alive && result.ok) setUsage(unwrap<Usage>(result));
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 15_000);
    return () => { alive = false; clearInterval(timer); };
  }, [ready, server.id]);

  const moduleRows = useMemo(() => modules.filter((m) => !["assistant", "terminal", "module-dev", "project-map", "chat", "preferences"].includes(m.id) && m.showInSidebar !== false), [modules]);
  const hasDev = modules.some((m) => m.id === "module-dev");
  const allRows = useMemo<ModuleRow[]>(() => [
    { id: "assistant", title: t.assistantLabel },
    { id: "terminal", title: t.terminalLabel },
    {id:"chat",title:serverUserModuleLabel("chat",language)},
    {id:"preferences",title:serverUserModuleLabel("preferences",language)},
    ...moduleRows,
    ...(hasDev ? [{ id: "module-dev", title: es ? "Mis módulos" : "My modules" }, { id: "project-map", title: es ? "Mapa proyecto" : "Project map" }] : []),
  ], [es, hasDev, moduleRows, t.assistantLabel, t.terminalLabel]);
  const active = allRows.find((m) => m.id === selected);
    const Assistant = MODULE_COMPONENTS.assistant;
  const openModule = (id: string) => {opener.current=document.activeElement as HTMLElement;setSelected(id);};
  const moduleButton = (m: ModuleRow, nested = false) => {
    const Icon = m.id === "terminal" ? Code2 : m.id === "project-map" ? FolderTree : LayoutGrid;
    return <button key={m.id} type="button" onClick={() => openModule(m.id)} aria-current={selected === m.id ? "page" : undefined} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${nested ? "pl-7" : ""} ${selected === m.id ? "bg-primary/10 font-semibold text-primary" : "text-base-content/75 hover:bg-base-200 hover:text-base-content"}`}><Icon size={15} className="shrink-0" /><span className="min-w-0 truncate">{labelOf(m)}</span></button>;
  };

  return <div data-theme={theme} className="relative flex h-full w-full flex-col overflow-hidden bg-base-100 text-base-content">
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-base-300 px-3">
      <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onBack} aria-label={t.back}><ArrowLeft size={18} /></button>
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{server.name}</div><div className="truncate text-[11px] opacity-55">{server.baseUrl}</div></div>
      <span className="hidden items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success sm:inline-flex"><RadioTower size={12} />{t.directBadge}</span>
    </header>
    {authError ? <div className="m-auto flex flex-col items-center gap-3 p-8 text-center"><p className="text-sm">{t.sessionExpired}</p><button type="button" className="btn btn-primary btn-sm" onClick={onBack}>{t.back}</button></div> : !ready ? <div className="m-auto loading loading-spinner loading-lg text-primary" /> : <div className="flex min-h-0 flex-1">
      <main className="min-w-0 flex-1 overflow-hidden"><Suspense fallback={<div className="flex h-full items-center justify-center"><span className="loading loading-spinner text-primary" /></div>}><Assistant serverId={server.id} moduleLabel={t.assistantLabel} language={language} theme={theme} /></Suspense></main>
      <aside className="flex w-56 shrink-0 flex-col border-l border-base-300 bg-base-100 md:w-64" aria-label={es ? "Módulos del servidor" : "Server modules"}>
        <div className="flex h-12 items-center justify-between border-b border-base-300 px-3"><span className="text-xs font-semibold uppercase tracking-wider">{es ? "Módulos" : "Modules"}</span><button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => void loadModules()} aria-label={es ? "Actualizar módulos" : "Refresh modules"}><RefreshCw size={14} className={loadingModules ? "animate-spin" : ""} /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <button type="button" onClick={() => setSelected("assistant")} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${selected === "assistant" ? "bg-primary/10 font-semibold text-primary" : "hover:bg-base-200"}`}><Bot size={15} />{t.assistantLabel}</button>
          {moduleButton({ id: "terminal", title: t.terminalLabel })}
          {moduleButton({id:"chat",title:serverUserModuleLabel("chat",language)})}
          {moduleButton({id:"preferences",title:serverUserModuleLabel("preferences",language)})}
          {moduleRows.map((m) => moduleButton(m))}
          {hasDev ? <div className="mt-2 border-t border-base-300 pt-2"><button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-semibold hover:bg-base-200" onClick={() => setDevOpen((v) => !v)} aria-expanded={devOpen}><span className="flex items-center gap-2"><Code2 size={15} />Dev</span>{devOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>{devOpen ? <div>{moduleButton({ id: "module-dev", title: es ? "Mis módulos" : "My modules" }, true)}{moduleButton({ id: "project-map", title: es ? "Mapa proyecto" : "Project map" }, true)}</div> : null}</div> : null}
          {modulesError ? <p role="alert" className="px-2 py-3 text-xs text-error">{es ? "No se pudo cargar el catálogo del servidor." : "Could not load the server catalog."}</p> : loadingModules ? <p className="px-2 py-3 text-xs opacity-60">{t.moduleLoading}</p> : null}
        </div>
        <div className="space-y-2 border-t border-base-300 p-3"><span className="text-[11px] font-semibold uppercase tracking-wider opacity-60">{es ? "Uso del servidor" : "Server usage"}</span><Meter label="CPU" value={pct(usage?.cpu?.usagePercent)} /><Meter label="RAM" value={pct(usage?.memory?.usagePercent)} /><Meter label={es ? "Disco" : "Disk"} value={pct(usage?.disk?.usagePercent)} /></div>
      </aside>
    </div>}
    {ready ? <div style={{display:selected === "assistant"?"none":undefined}} aria-hidden={selected === "assistant"} inert={selected === "assistant"} className="absolute inset-0 z-30 bg-black/50" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModule(); }}>
      <section data-module-host role="dialog" aria-modal="true" aria-label={active?labelOf(active):t.moduleLoading} className="flex h-full w-[90%] flex-col border-r border-base-300 bg-base-100 shadow-2xl">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-base-300 px-4"><h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{active?labelOf(active):t.moduleLoading}</h2><button type="button" className="btn btn-ghost btn-sm btn-square" onClick={closeModule} aria-label={es ? "Cerrar módulo" : "Close module"}><X size={18} /></button></header>
        <div className="min-h-0 flex-1 overflow-auto p-4"><Suspense fallback={<div className="flex h-full items-center justify-center"><span className="loading loading-spinner text-primary" /></div>}>{[...visited].map(id=>{const row=allRows.find(item=>item.id===id);const title=row?labelOf(row):id;return <PersistentDesktopModule key={`${owner}:${id}`} id={id} visible={id===selected} serverId={server.id} title={title} language={language} theme={theme}/>;})}</Suspense></div>
      </section>
    </div> : null}
  </div>;
}
