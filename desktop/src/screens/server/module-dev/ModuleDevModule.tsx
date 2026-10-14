/* eslint-disable react-hooks/set-state-in-effect -- carga del catálogo al abrir el drawable */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Send, Wrench } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type DevModule = { id?: string; code?: string; name?: string; version?: string; reviewStatus?: string; status?: string; prUrl?: string };
type DevList = { modules?: DevModule[]; stale?: boolean; marketplaceAvailable?: boolean };
type Link = { projectId?: string; moduleId?: string; id?: string };
type Validation = { valid?: boolean; errors?: Array<{ path: string; message: string }>; warnings?: Array<{ path: string; message: string }> };

/** Native "Mis módulos" drawer, separate from the source explorer. */
export function ModuleDevModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [items, setItems] = useState<DevModule[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [marketplaceAvailable, setMarketplaceAvailable] = useState(true);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [manifestText, setManifestText] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [runOutput, setRunOutput] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    const [modulesResponse, linksResponse] = await Promise.all([
      callServerApi(serverId, "", "GET", "/api/module-dev/modules"),
      callServerApi(serverId, "", "GET", "/api/module-dev/links"),
    ]);
    const moduleData = unwrap<DevList>(modulesResponse);
    const linkData = unwrap<Link[] | { links?: Link[] }>(linksResponse);
    if (!modulesResponse.ok && !linksResponse.ok) setError(es ? "No se pudieron cargar los módulos de este servidor." : "Could not load modules from this server.");
    setItems(Array.isArray(moduleData?.modules) ? moduleData.modules : []);
    setStale(Boolean(moduleData?.stale));
    setMarketplaceAvailable(moduleData?.marketplaceAvailable !== false);
    setLinks(Array.isArray(linkData) ? linkData : Array.isArray(linkData?.links) ? linkData.links : []);
    setBusy(false);
  }, [es, serverId]);
  useEffect(() => { void load(); }, [load]);

  const runAction = async (key: string, path: string, body?: unknown) => {
    setActionBusy(key); setError(""); setNotice("");
    const result = await callServerApi(serverId, "", "POST", path, body);
    setActionBusy("");
    if (!result.ok) { setError(es ? "La operación no se completó. Revisa los permisos y la conexión." : "The action did not complete. Check permissions and connection."); return null; }
    setNotice(es ? "Operación completada." : "Action completed.");
    void load();
    return unwrap<unknown>(result);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!moduleId.trim() || !prUrl.trim()) return;
    void runAction("submit", "/api/module-dev/modules/submit", { moduleId: moduleId.trim(), prUrl: prUrl.trim() });
  };

  const validate = async () => {
    try {
      const manifest: unknown = JSON.parse(manifestText);
      setActionBusy("validate"); setError("");
      const result = await callServerApi(serverId, "", "POST", "/api/module-dev/manifest/validate", { manifest });
      const data = unwrap<Validation>(result);
      if (!data) throw new Error();
      setValidation(data);
    } catch { setError(es ? "El manifest no es JSON válido o no pudo verificarse." : "The manifest is invalid JSON or could not be checked."); }
    finally { setActionBusy(""); }
  };

  const runCheck = async (projectId: string, tests: boolean) => {
    const key = `${tests ? "test" : "check"}:${projectId}`;
    setActionBusy(key); setError(""); setRunOutput("");
    const path = tests ? "/api/module-dev/tests/run" : "/api/module-dev/checks/run";
    const result = await callServerApi(serverId, "", "POST", path, { projectId });
    const data = unwrap<Record<string, unknown>>(result);
    setActionBusy("");
    if (!data) { setError(es ? "No se pudo ejecutar la comprobación." : "Could not run the check."); return; }
    setRunOutput(JSON.stringify(data, null, 2));
  };

  return <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-8">
    <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary">Dev</p><h2 className="text-xl font-semibold">{es ? "Mis módulos" : "My modules"}</h2><p className="text-sm opacity-65">{es ? "Publicación, revisión y pruebas de módulos." : "Module publishing, reviews and checks."}</p></div><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void load()}><RefreshCw size={15} className={busy ? "animate-spin" : ""} />{es ? "Actualizar" : "Refresh"}</button></div>
    {stale ? <p role="status" className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">{es ? "Datos de caché: el marketplace no respondió." : "Cached data: marketplace did not respond."}</p> : null}
    {!marketplaceAvailable ? <p role="status" className="rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-sm">{es ? "Este servidor permite desarrollo local; la publicación requiere vincularlo al portal." : "Local development is available; publishing requires a portal connection."}</p> : null}
    {error ? <p role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{error}</p> : null}{notice ? <p role="status" className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</p> : null}
    <section className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-3 text-sm font-semibold">{es ? "Módulos publicados" : "Published modules"}</h3>{busy ? <Loader2 size={20} className="animate-spin text-primary" /> : items.length ? <div className="divide-y divide-base-300">{items.map((item, i) => { const code = item.code || item.id || ""; const status = item.reviewStatus || item.status || "—"; return <div key={`${code}-${i}`} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-48 flex-1"><div className="text-sm font-medium">{item.name || code}</div><div className="font-mono text-[11px] opacity-60">{code}{item.version ? ` · v${item.version}` : ""}</div></div><span className="badge badge-outline badge-sm">{status}</span>{status === "publico" ? <button type="button" className="btn btn-outline btn-xs" disabled={Boolean(actionBusy)} onClick={() => { if (window.confirm(es ? "¿Despublicar este módulo?" : "Unpublish this module?")) void runAction(code, `/api/module-dev/modules/${encodeURIComponent(code)}/unpublish`); }}>{es ? "Despublicar" : "Unpublish"}</button> : status === "inactivo" ? <button type="button" className="btn btn-outline btn-xs" disabled={Boolean(actionBusy)} onClick={() => void runAction(code, `/api/module-dev/modules/${encodeURIComponent(code)}/republish`)}>{es ? "Republicar" : "Republish"}</button> : null}{item.prUrl ? <button type="button" className="btn btn-ghost btn-xs" onClick={() => void window.electronApi?.openExternal(item.prUrl!)}><ExternalLink size={14} />PR</button> : null}</div>; })}</div> : <p className="text-sm opacity-60">{es ? "Aún no hay módulos publicados." : "No published modules yet."}</p>}</section>
    <section className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-3 text-sm font-semibold">{es ? "Proyectos vinculados" : "Linked projects"}</h3>{links.length ? <div className="space-y-2">{links.map((link, i) => { const projectId = link.projectId || link.id || ""; return <div key={`${projectId}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-base-300 px-3 py-2"><span className="min-w-40 flex-1 truncate font-mono text-xs">{projectId}{link.moduleId ? ` → ${link.moduleId}` : ""}</span><button type="button" className="btn btn-outline btn-xs" disabled={Boolean(actionBusy) || !projectId} onClick={() => void runCheck(projectId, false)}><Wrench size={13} />{es ? "Validar" : "Check"}</button><button type="button" className="btn btn-outline btn-xs" disabled={Boolean(actionBusy) || !projectId} onClick={() => void runCheck(projectId, true)}><CheckCircle2 size={13} />Tests</button></div>; })}</div> : <p className="text-sm opacity-60">{es ? "Sin proyectos vinculados." : "No linked projects."}</p>}{runOutput ? <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-base-200 p-3 text-xs">{runOutput}</pre> : null}</section>
    <div className="grid gap-4 lg:grid-cols-2"><form onSubmit={submit} className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-3 text-sm font-semibold">{es ? "Enviar a revisión" : "Submit for review"}</h3><label className="mb-2 block text-xs">ID del módulo<input className="input input-bordered input-sm mt-1 w-full" required value={moduleId} onChange={(event) => setModuleId(event.target.value)} placeholder="mi-modulo" /></label><label className="mb-3 block text-xs">URL del pull request<input className="input input-bordered input-sm mt-1 w-full" required type="url" value={prUrl} onChange={(event) => setPrUrl(event.target.value)} placeholder="https://github.com/…" /></label><button type="submit" className="btn btn-primary btn-sm" disabled={Boolean(actionBusy) || !marketplaceAvailable}><Send size={14} />{es ? "Enviar" : "Submit"}</button></form>
      <section className="rounded-xl border border-base-300 bg-base-100 p-4"><h3 className="mb-3 text-sm font-semibold">{es ? "Validar manifest" : "Validate manifest"}</h3><textarea className="textarea textarea-bordered h-28 w-full font-mono text-xs" value={manifestText} onChange={(event) => setManifestText(event.target.value)} placeholder="{ … }" /><button type="button" className="btn btn-outline btn-sm mt-2" disabled={Boolean(actionBusy) || !manifestText.trim()} onClick={() => void validate()}><Wrench size={14} />{es ? "Validar" : "Validate"}</button>{validation ? <div className="mt-2 text-xs"><p className={validation.valid ? "text-success" : "text-error"}>{validation.valid ? (es ? "Manifest válido" : "Valid manifest") : (es ? "Manifest inválido" : "Invalid manifest")}</p>{[...(validation.errors ?? []), ...(validation.warnings ?? [])].map((issue, i) => <p key={i} className="mt-1 font-mono">{issue.path}: {issue.message}</p>)}</div> : null}</section></div>
  </div>;
}
