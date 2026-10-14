/* eslint-disable react-hooks/set-state-in-effect -- carga remota al seleccionar */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Cloud, RefreshCw, Trash2 } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Zone = { id: string; name: string; status: string; planName?: string };
type RecordRow = { id: string; type: string; name: string; content: string; ttl: number; proxied: boolean; pointsToServer?: boolean };
type Config = { tokenSet: boolean; tokenPreview: string };

export function CloudflareModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [config, setConfig] = useState<Config | null>(null);
  const [token, setToken] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [recordType, setRecordType] = useState("A");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [proxied, setProxied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const [configRes, zonesRes] = await Promise.all([callServerApi(serverId, "", "GET", "/api/cloudflare/config"), callServerApi(serverId, "", "GET", "/api/cloudflare/zones")]);
    const nextConfig = unwrap<Config>(configRes), nextZones = unwrap<Zone[]>(zonesRes);
    if (nextConfig) setConfig(nextConfig);
    if (Array.isArray(nextZones)) setZones(nextZones);
    else if (nextConfig?.tokenSet) setError(zonesRes.error || (es ? "No se pudieron cargar las zonas." : "Could not load zones."));
  }, [es, serverId]);
  useEffect(() => { void load(); }, [load]);
  const loadRecords = useCallback(async () => {
    if (!zoneId) { setRecords([]); return; }
    const result = await callServerApi(serverId, "", "GET", `/api/cloudflare/zones/${encodeURIComponent(zoneId)}/dns`);
    const data = unwrap<RecordRow[] | { records?: RecordRow[] }>(result);
    const rows = Array.isArray(data) ? data : data?.records;
    if (Array.isArray(rows)) setRecords(rows);
    else setError(result.error || (es ? "No se pudieron cargar los registros DNS." : "Could not load DNS records."));
  }, [es, serverId, zoneId]);
  useEffect(() => { void loadRecords(); }, [loadRecords]);
  const run = async (method: "POST" | "PUT" | "DELETE", path: string, body?: unknown) => {
    setBusy(true); setError(""); setNotice("");
    const result = await callServerApi(serverId, "", method, path, body);
    if (!result.ok) setError(result.error || (es ? "La operación falló." : "Operation failed."));
    else setNotice(es ? "Operación completada." : "Operation completed.");
    setBusy(false);
    return result.ok;
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!zoneId) return;
    const body = { type: recordType, name: name.trim(), content: content.trim(), ttl: 1, ...(recordType === "A" || recordType === "AAAA" || recordType === "CNAME" ? { proxied } : {}) };
    if (await run("POST", `/api/cloudflare/zones/${encodeURIComponent(zoneId)}/dns`, body)) { setName(""); setContent(""); void loadRecords(); }
  };
  const saveToken = async (event: FormEvent) => {
    event.preventDefault();
    if (await run("PUT", "/api/cloudflare/config", { apiToken: token.trim() })) { setToken(""); void load(); }
  };
  return <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8"><div className="flex items-center gap-2"><Cloud size={20} className="text-primary" /><h2 className="flex-1 text-xl font-semibold">Cloudflare</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => { void load(); void loadRecords(); }}><RefreshCw size={15} />{es ? "Actualizar" : "Refresh"}</button></div>
    {error && <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}{notice && <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">{notice}</p>}
    <form onSubmit={(event) => void saveToken(event)} className="flex flex-wrap items-end gap-3 rounded-xl border border-base-300 p-4"><div className="min-w-48 flex-1"><h3 className="text-sm font-semibold">API token</h3><p className="text-xs opacity-60">{config?.tokenSet ? (es ? `Configurado ${config.tokenPreview}` : `Configured ${config.tokenPreview}`) : (es ? "Sin configurar" : "Not configured")}</p><input type="password" className="input input-bordered input-sm mt-2 w-full" value={token} onChange={(event) => setToken(event.target.value)} minLength={20} placeholder={es ? "Nuevo token" : "New token"} autoComplete="off" /></div><button type="submit" className="btn btn-primary btn-sm" disabled={busy || token.trim().length < 20}>{es ? "Guardar token" : "Save token"}</button>{config?.tokenSet ? <button type="button" className="btn btn-outline btn-sm text-error" disabled={busy} onClick={() => { if (window.confirm(es ? "¿Eliminar el token de Cloudflare?" : "Remove Cloudflare token?")) void run("DELETE", "/api/cloudflare/config").then(() => void load()); }}>{es ? "Quitar" : "Remove"}</button> : null}</form>
    <div className="flex flex-wrap items-center gap-3"><label className="text-xs">{es ? "Zona" : "Zone"}<select className="select select-bordered select-sm ml-2" value={zoneId} onChange={(event) => setZoneId(event.target.value)}><option value="">{es ? "Seleccionar zona" : "Select zone"}</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.status}</option>)}</select></label>{zoneId && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { if (window.confirm(es ? "¿Purgar toda la caché de esta zona?" : "Purge all cache for this zone?")) void run("POST", `/api/cloudflare/zones/${encodeURIComponent(zoneId)}/purge`, { everything: true }); }}>{es ? "Purgar caché" : "Purge cache"}</button>}</div>
    {zoneId && <><form onSubmit={(event) => void create(event)} className="flex flex-wrap items-end gap-2 rounded-xl border border-base-300 p-4"><label className="text-xs">Tipo<select className="select select-bordered select-sm mt-1 block" value={recordType} onChange={(event) => setRecordType(event.target.value)}>{["A", "AAAA", "CNAME", "TXT", "MX", "NS"].map((type) => <option key={type}>{type}</option>)}</select></label><label className="text-xs">Nombre<input className="input input-bordered input-sm mt-1 block" required value={name} onChange={(event) => setName(event.target.value)} /></label><label className="min-w-44 flex-1 text-xs">{es ? "Contenido" : "Content"}<input className="input input-bordered input-sm mt-1 w-full" required value={content} onChange={(event) => setContent(event.target.value)} /></label>{["A", "AAAA", "CNAME"].includes(recordType) && <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="checkbox checkbox-xs" checked={proxied} onChange={(event) => setProxied(event.target.checked)} />Proxy</label>}<button className="btn btn-primary btn-sm" disabled={busy}>{es ? "Agregar DNS" : "Add DNS"}</button></form><div className="overflow-auto rounded-xl border border-base-300"><table className="table table-sm"><thead><tr><th>Tipo</th><th>Nombre</th><th>{es ? "Contenido" : "Content"}</th><th>Proxy</th><th></th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{record.type}</td><td className="max-w-40 truncate">{record.name}</td><td className="max-w-64 truncate font-mono text-xs">{record.content}</td><td>{record.proxied ? "✓" : "—"}</td><td><button type="button" className="btn btn-ghost btn-xs text-error" disabled={busy} aria-label={es ? "Eliminar" : "Delete"} onClick={() => { if (window.confirm(es ? `¿Eliminar ${record.name}?` : `Delete ${record.name}?`)) void run("DELETE", `/api/cloudflare/zones/${encodeURIComponent(zoneId)}/dns/${encodeURIComponent(record.id)}`).then(() => void loadRecords()); }}><Trash2 size={14} /></button></td></tr>)}</tbody></table>{!records.length && <p className="p-4 text-sm opacity-60">{es ? "Sin registros." : "No records."}</p>}</div></>}
  </div>;
}
