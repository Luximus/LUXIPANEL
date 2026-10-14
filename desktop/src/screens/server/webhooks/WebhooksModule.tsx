/* eslint-disable react-hooks/set-state-in-effect -- catálogo remoto al montar */
import { useLiveModuleData } from "../../../lib/use-live-module-data";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Trash2, Webhook } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Hook = { id: number; name: string; url: string; events: string[]; enabled: boolean };
type Delivery = { id?: string | number; status?: string; statusCode?: number; createdAt?: string; error?: string };
export function WebhooksModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [secret, setSecret] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const [hooksRes, eventsRes] = await Promise.all([callServerApi(serverId, "", "GET", "/api/webhooks"), callServerApi(serverId, "", "GET", "/api/webhooks/events")]);
    const rows = unwrap<Hook[]>(hooksRes), eventRows = unwrap<string[]>(eventsRes);
    if (Array.isArray(rows)) setHooks(rows); else setError(hooksRes.error || (es ? "No se pudieron cargar los webhooks." : "Could not load webhooks."));
    if (Array.isArray(eventRows)) setEvents(eventRows);
  }, [es, serverId]);
  useLiveModuleData(serverId, ["webhooks/webhooks"], load);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (events.length && !chosen.length) setChosen([events[0]]); }, [events, chosen.length]);
  const run = async (method: "POST" | "PUT" | "DELETE", path: string, body?: unknown) => {
    setBusy(true); setError(""); setNotice("");
    const response = await callServerApi(serverId, "", method, path, body);
    if (!response.ok) setError(response.error || (es ? "La operación falló." : "Operation failed."));
    else { setNotice(es ? "Operación completada." : "Operation completed."); void load(); }
    setBusy(false);
    return response;
  };
  const create = async (event: FormEvent) => {
    event.preventDefault(); if (!chosen.length) return;
    const response = await run("POST", "/api/webhooks", { name: name.trim(), url: url.trim(), events: chosen, enabled: true });
    const created = unwrap<{ secret?: string }>(response);
    if (response.ok) { setName(""); setUrl(""); setSecret(created?.secret ?? ""); }
  };
  const showDeliveries = async (id: number) => {
    setSelected(id); setError("");
    const response = await callServerApi(serverId, "", "GET", `/api/webhooks/${id}/deliveries`);
    const data = unwrap<Delivery[]>(response);
    if (Array.isArray(data)) setDeliveries(data); else setError(response.error || (es ? "No se pudieron cargar las entregas." : "Could not load deliveries."));
  };
  return <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8"><div className="flex items-center gap-2"><Webhook size={20} className="text-primary" /><h2 className="flex-1 text-xl font-semibold">Webhooks</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}><RefreshCw size={15} />{es ? "Actualizar" : "Refresh"}</button></div>
    {error && <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}{notice && <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">{notice}</p>}{secret && <div className="rounded-lg border border-warning bg-warning/10 p-3 text-sm"><p className="font-medium">{es ? "Guarda este secreto ahora; solo se muestra una vez." : "Save this secret now; it is shown once."}</p><code className="mt-1 block break-all select-all">{secret}</code><button type="button" className="btn btn-ghost btn-xs mt-2" onClick={() => setSecret("")}>{es ? "Ocultar" : "Hide"}</button></div>}
    <form onSubmit={(event) => void create(event)} className="space-y-3 rounded-xl border border-base-300 p-4"><h3 className="text-sm font-semibold">{es ? "Nuevo webhook" : "New webhook"}</h3><div className="flex flex-wrap gap-2"><input className="input input-bordered input-sm min-w-36 flex-1" required minLength={2} maxLength={128} placeholder={es ? "Nombre" : "Name"} value={name} onChange={(event) => setName(event.target.value)} /><input className="input input-bordered input-sm min-w-60 flex-[2]" required type="url" placeholder="https://..." value={url} onChange={(event) => setUrl(event.target.value)} /></div><div className="flex max-h-36 flex-wrap gap-2 overflow-auto">{events.map((item) => <label key={item} className="flex items-center gap-1 rounded border border-base-300 px-2 py-1 text-xs"><input type="checkbox" className="checkbox checkbox-xs" checked={chosen.includes(item)} onChange={(event) => setChosen((old) => event.target.checked ? [...old, item] : old.filter((v) => v !== item))} />{item}</label>)}</div><button className="btn btn-primary btn-sm" disabled={busy || !chosen.length}>{es ? "Crear" : "Create"}</button></form>
    <div className="overflow-auto rounded-xl border border-base-300"><table className="table table-sm"><thead><tr><th>{es ? "Nombre" : "Name"}</th><th>URL</th><th>{es ? "Eventos" : "Events"}</th><th>{es ? "Estado" : "Status"}</th><th></th></tr></thead><tbody>{hooks.map((hook) => <tr key={hook.id}><td className="font-medium">{hook.name}</td><td className="max-w-52 truncate font-mono text-xs" title={hook.url}>{hook.url}</td><td className="text-xs">{hook.events.join(", ")}</td><td>{hook.enabled ? (es ? "Activo" : "Enabled") : (es ? "Pausado" : "Paused")}</td><td className="whitespace-nowrap"><button type="button" className="btn btn-ghost btn-xs" onClick={() => void showDeliveries(hook.id)}>{es ? "Entregas" : "Deliveries"}</button><button type="button" className="btn btn-ghost btn-xs" disabled={busy} onClick={() => void run("POST", `/api/webhooks/${hook.id}/test`)}>{es ? "Probar" : "Test"}</button><button type="button" className="btn btn-ghost btn-xs text-error" disabled={busy} aria-label={es ? "Eliminar" : "Delete"} onClick={() => { if (window.confirm(es ? `¿Eliminar ${hook.name}?` : `Delete ${hook.name}?`)) void run("DELETE", `/api/webhooks/${hook.id}`); }}><Trash2 size={14} /></button></td></tr>)}</tbody></table>{!hooks.length && <p className="p-4 text-sm opacity-60">{es ? "Sin webhooks." : "No webhooks."}</p>}</div>
    {selected !== null && <section className="rounded-xl border border-base-300 p-4"><h3 className="mb-2 text-sm font-semibold">{es ? "Entregas recientes" : "Recent deliveries"}</h3>{deliveries.length ? deliveries.map((delivery, index) => <div key={delivery.id ?? index} className="flex gap-3 border-t border-base-300 py-2 text-xs"><span>{delivery.status ?? delivery.statusCode ?? "—"}</span><span>{delivery.createdAt ? new Date(delivery.createdAt).toLocaleString() : "—"}</span><span className="text-error">{delivery.error}</span></div>) : <p className="text-sm opacity-60">{es ? "Sin entregas." : "No deliveries."}</p>}</section>}
  </div>;
}
