/* eslint-disable react-hooks/set-state-in-effect -- carga remota al seleccionar */
import { useLiveModuleData } from "../../../lib/use-live-module-data";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Globe2, RefreshCw, Save, Trash2 } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Site = { name: string; domains?: string[]; enabled?: boolean; root?: string | null; kind?: string };
type RawSite = { content: string; revision: string };

export function NginxModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [sites, setSites] = useState<Site[]>([]);
  const [selected, setSelected] = useState("");
  const [content, setContent] = useState("");
  const [revision, setRevision] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newRoot, setNewRoot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const result = await callServerApi(serverId, "", "GET", "/api/nginx/sites");
    const data = unwrap<Site[]>(result);
    if (Array.isArray(data)) setSites(data);
    else setError(result.error || (es ? "No se pudieron cargar los sitios." : "Could not load sites."));
  }, [es, serverId]);
  useLiveModuleData(serverId, ["nginx/sites"], load);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    void callServerApi(serverId, "", "GET", `/api/nginx/sites/${encodeURIComponent(selected)}/raw`).then((result) => {
      if (!alive) return;
      const raw = unwrap<RawSite>(result);
      if (raw) { setContent(raw.content); setRevision(raw.revision); }
      else setError(result.error || (es ? "No se pudo abrir la configuración." : "Could not open configuration."));
    });
    return () => { alive = false; };
  }, [es, selected, serverId]);
  const mutate = async (method: "POST" | "PUT" | "DELETE", path: string, body?: unknown) => {
    setBusy(true); setError(""); setNotice("");
    const result = await callServerApi(serverId, "", method, path, body);
    if (!result.ok) setError(result.error || (es ? "La operación falló." : "Operation failed."));
    else { setNotice(es ? "Cambios guardados." : "Changes saved."); await load(); }
    setBusy(false);
    return result.ok;
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    const domain = newDomain.trim();
    if (!domain) return;
    const ok = await mutate("POST", "/api/nginx/sites", { mode: "form", enabled: true, form: { kind: "static", domain, aliases: [], root: newRoot.trim() || undefined, websocket: false, forceHttps: false } });
    if (ok) { setNewDomain(""); setNewRoot(""); setSelected(domain); }
  };
  const save = async () => {
    if (!selected || !revision) return;
    const ok = await mutate("PUT", `/api/nginx/sites/${encodeURIComponent(selected)}`, { mode: "raw", content, expectedRevision: revision });
    if (ok) {
      const fresh = unwrap<RawSite>(await callServerApi(serverId, "", "GET", `/api/nginx/sites/${encodeURIComponent(selected)}/raw`));
      if (fresh) { setContent(fresh.content); setRevision(fresh.revision); }
    }
  };
  return <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8"><div className="flex items-center gap-2"><Globe2 size={20} className="text-primary" /><h2 className="flex-1 text-xl font-semibold">NGINX / DNS</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}><RefreshCw size={15} />{es ? "Actualizar" : "Refresh"}</button></div>
    {error && <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}{notice && <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">{notice}</p>}
    <form onSubmit={(event) => void create(event)} className="flex flex-wrap items-end gap-3 rounded-xl border border-base-300 p-4"><label className="text-xs">{es ? "Nuevo dominio" : "New domain"}<input className="input input-bordered input-sm mt-1 block" required placeholder="example.com" value={newDomain} onChange={(event) => setNewDomain(event.target.value)} /></label><label className="text-xs">Document root<input className="input input-bordered input-sm mt-1 block" placeholder="/var/www/example.com" value={newRoot} onChange={(event) => setNewRoot(event.target.value)} /></label><button className="btn btn-primary btn-sm" disabled={busy}>{es ? "Crear sitio" : "Create site"}</button></form>
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]"><nav className="max-h-[30rem] overflow-auto rounded-xl border border-base-300 p-2" aria-label={es ? "Sitios" : "Sites"}>{sites.map((site) => <button key={site.name} type="button" className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${selected === site.name ? "bg-primary/10 text-primary" : "hover:bg-base-200"}`} onClick={() => setSelected(site.name)}><span className="block truncate font-medium">{site.name}</span><span className="text-xs opacity-60">{site.enabled ? (es ? "Activo" : "Enabled") : (es ? "Desactivado" : "Disabled")}</span></button>)}{!sites.length && <p className="p-2 text-sm opacity-60">{es ? "Sin sitios." : "No sites."}</p>}</nav>
      <section className="min-w-0 rounded-xl border border-base-300 p-4">{selected ? <><div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="min-w-0 flex-1 truncate font-semibold">{selected}</h3><button className="btn btn-primary btn-sm" type="button" disabled={busy || !revision} onClick={() => void save()}><Save size={14} />{es ? "Guardar" : "Save"}</button><button className="btn btn-outline btn-sm" type="button" disabled={busy} onClick={() => void mutate("POST", `/api/nginx/sites/${encodeURIComponent(selected)}/${sites.find((site) => site.name === selected)?.enabled ? "disable" : "enable"}`)}>{sites.find((site) => site.name === selected)?.enabled ? (es ? "Desactivar" : "Disable") : (es ? "Activar" : "Enable")}</button><button className="btn btn-ghost btn-sm text-error" type="button" disabled={busy} onClick={() => { if (window.confirm(es ? `¿Eliminar ${selected}?` : `Delete ${selected}?`)) void mutate("DELETE", `/api/nginx/sites/${encodeURIComponent(selected)}`).then((ok) => { if (ok) setSelected(""); }); }}><Trash2 size={14} /></button></div><p className="mb-2 text-xs opacity-60">{es ? "Configuración NGINX. Los cambios se validan en el servidor antes de aplicarse." : "NGINX configuration. Changes are validated on the server before applying."}</p><textarea className="textarea textarea-bordered min-h-80 w-full font-mono text-xs" value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} /></> : <p className="text-sm opacity-60">{es ? "Selecciona un sitio para ver su configuración." : "Select a site to view its configuration."}</p>}</section></div>
  </div>;
}
