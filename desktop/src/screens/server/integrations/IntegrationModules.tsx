/* eslint-disable react-hooks/set-state-in-effect -- lectura inicial de configuración remota */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, KeyRound, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type OpenClawConfig = { endpoint: string; defaultModel: string; apiKeySet: boolean; apiKeyPreview: string };
type BitNinjaStatus = { installed: boolean; running: boolean; licenseValid: boolean; version: string | null; components: Array<{ name: string; active: boolean }> };
type BitNinjaConfig = { tokenSet: boolean; tokenPreview: string };

export function OpenClawModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const res = await callServerApi(serverId, "", "GET", "/api/openclaw/config");
    const data = unwrap<OpenClawConfig>(res);
    if (data) { setConfig(data); setEndpoint(data.endpoint); setModel(data.defaultModel); }
    else setMessage(es ? "No se pudo leer la configuración." : "Could not read configuration.");
  }, [es, serverId]);
  useEffect(() => { void load(); }, [load]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const res = await callServerApi(serverId, "", "PUT", "/api/openclaw/config", { endpoint, defaultModel: model, ...(key.trim() ? { apiKey: key.trim() } : {}) });
    setBusy(false); setKey("");
    setMessage(res.ok ? (es ? "Configuración guardada." : "Configuration saved.") : (es ? "No se pudo guardar." : "Could not save."));
    if (res.ok) void load();
  };
  const test = async () => {
    setBusy(true); setMessage("");
    const res = await callServerApi(serverId, "", "POST", "/api/openclaw/test");
    const data = unwrap<{ message?: string }>(res);
    setMessage(data?.message || (res.ok ? (es ? "Conexión correcta." : "Connection successful.") : (es ? "La conexión falló." : "Connection failed.")));
    setBusy(false);
  };
  return <div className="mx-auto max-w-3xl space-y-5 pb-8"><div className="flex items-center gap-2"><Activity size={22} className="text-primary" /><div><h2 className="text-xl font-semibold">OpenClaw</h2><p className="text-sm opacity-60">{es ? "Conexión y modelo por defecto" : "Connection and default model"}</p></div></div>{message ? <p role="status" className="rounded-lg bg-base-200 p-3 text-sm">{message}</p> : null}<form onSubmit={(event) => void save(event)} className="space-y-4 rounded-xl border border-base-300 bg-base-100 p-5"><label className="block text-sm font-medium">Endpoint<input type="url" className="input input-bordered mt-1 w-full" required value={endpoint} onChange={(event) => setEndpoint(event.target.value)} /></label><label className="block text-sm font-medium">{es ? "Modelo por defecto" : "Default model"}<input className="input input-bordered mt-1 w-full" value={model} onChange={(event) => setModel(event.target.value)} /></label><label className="block text-sm font-medium">API key {config?.apiKeySet ? <span className="font-mono text-xs opacity-50">({config.apiKeyPreview})</span> : null}<input type="password" autoComplete="off" className="input input-bordered mt-1 w-full" value={key} onChange={(event) => setKey(event.target.value)} placeholder={config?.apiKeySet ? (es ? "Dejar vacío para conservar" : "Leave empty to keep current") : "API key"} /></label><div className="flex flex-wrap gap-2"><button type="submit" className="btn btn-primary btn-sm" disabled={busy}><Save size={15} />{es ? "Guardar" : "Save"}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void test()}><RefreshCw size={15} />{es ? "Probar conexión" : "Test connection"}</button>{config?.apiKeySet ? <button type="button" className="btn btn-ghost btn-sm text-error" disabled={busy} onClick={async () => { if (!window.confirm(es ? "¿Eliminar la API key?" : "Remove API key?")) return; await callServerApi(serverId, "", "DELETE", "/api/openclaw/api-key"); void load(); }}><Trash2 size={15} />{es ? "Eliminar clave" : "Remove key"}</button> : null}</div></form></div>;
}

export function BitNinjaModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [status, setStatus] = useState<BitNinjaStatus | null>(null);
  const [config, setConfig] = useState<BitNinjaConfig | null>(null);
  const [logs, setLogs] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    const [statusRes, configRes, logsRes] = await Promise.all([
      callServerApi(serverId, "", "GET", "/api/bitninja/status"),
      callServerApi(serverId, "", "GET", "/api/bitninja/config"),
      callServerApi(serverId, "", "GET", "/api/bitninja/logs?lines=50"),
    ]);
    setStatus(unwrap<BitNinjaStatus>(statusRes));
    setConfig(unwrap<BitNinjaConfig>(configRes));
    setLogs(unwrap<{ output?: string }>(logsRes)?.output ?? "");
    if (!statusRes.ok) setMessage(es ? "No se pudo consultar BitNinja." : "Could not load BitNinja.");
    setBusy(false);
  }, [es, serverId]);
  useEffect(() => { void load(); }, [load]);
  const mutate = async (path: string, body?: unknown, method: "POST" | "PUT" | "DELETE" = "POST") => {
    setBusy(true); setMessage("");
    const res = await callServerApi(serverId, "", method, path, body);
    setMessage(res.ok ? (es ? "Cambio aplicado." : "Change applied.") : res.error || (es ? "La operación falló." : "Action failed."));
    setBusy(false); void load();
  };
  return <div className="mx-auto max-w-4xl space-y-5 pb-8"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><ShieldCheck size={22} className="text-primary" /><div><h2 className="text-xl font-semibold">BitNinja</h2><p className="text-xs opacity-60">{status?.version || "—"}</p></div></div><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void load()}><RefreshCw size={15} className={busy ? "animate-spin" : ""} />{es ? "Actualizar" : "Refresh"}</button></div>{message ? <p role="status" className="rounded-lg bg-base-200 p-3 text-sm">{message}</p> : null}<div className="grid gap-3 sm:grid-cols-3">{[[es ? "Instalado" : "Installed", status?.installed], [es ? "Servicio" : "Service", status?.running], [es ? "Licencia" : "License", status?.licenseValid]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-base-300 p-4"><p className="text-xs opacity-60">{label}</p><p className={`mt-1 font-semibold ${value ? "text-success" : "text-warning"}`}>{value ? (es ? "Sí" : "Yes") : (es ? "No" : "No")}</p></div>)}</div><section className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-3 font-semibold">{es ? "Servicio y componentes" : "Service and components"}</h3><div className="mb-4 flex flex-wrap gap-2">{status?.installed ? (["start", "stop", "restart"] as const).map((action) => <button key={action} type="button" className="btn btn-outline btn-xs" disabled={busy} onClick={() => { if (action === "stop" && !window.confirm(es ? "¿Detener BitNinja?" : "Stop BitNinja?")) return; void mutate("/api/bitninja/service", { action }); }}>{action}</button>) : <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void mutate("/api/bitninja/packages", licenseKey ? { licenseKey } : {})}>{es ? "Instalar" : "Install"}</button>}</div><div className="space-y-2">{status?.components?.map((component) => <div key={component.name} className="flex items-center justify-between gap-2 border-t border-base-300 pt-2 text-sm"><span>{component.name}</span><button type="button" className={`btn btn-xs ${component.active ? "btn-outline" : "btn-primary"}`} disabled={busy} onClick={() => void mutate("/api/bitninja/components", { component: component.name, enabled: !component.active })}>{component.active ? (es ? "Desactivar" : "Disable") : (es ? "Activar" : "Enable")}</button></div>)}</div></section><section className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-3 flex items-center gap-2 font-semibold"><KeyRound size={16} />{es ? "Licencia" : "License"}</h3><p className="mb-2 text-xs opacity-60">{config?.tokenSet ? config.tokenPreview || (es ? "Clave guardada" : "Key stored") : (es ? "Sin clave" : "No key")}</p><form className="flex flex-wrap gap-2" onSubmit={(event: FormEvent) => { event.preventDefault(); void mutate(status?.installed ? "/api/bitninja/license" : "/api/bitninja/config", { licenseKey }, status?.installed ? "POST" : "PUT"); setLicenseKey(""); }}><input className="input input-bordered input-sm flex-1" type="password" autoComplete="off" required value={licenseKey} onChange={(event) => setLicenseKey(event.target.value)} placeholder={es ? "Nueva clave de licencia" : "New license key"} /><button type="submit" className="btn btn-primary btn-sm" disabled={busy || !licenseKey}><Save size={14} />{es ? "Guardar" : "Save"}</button></form></section><section className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-2 font-semibold">Logs</h3><pre className="max-h-72 overflow-auto rounded-lg bg-base-200 p-3 font-mono text-xs whitespace-pre-wrap">{logs || "—"}</pre></section></div>;
}
