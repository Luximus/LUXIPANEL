/* eslint-disable react-hooks/set-state-in-effect -- lectura de proyectos remotos al montar */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Network, RefreshCw, Search } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Project = { id: string; title: string; path?: string; graphIndex?: { enabled?: boolean } };
type ProjectList = { availability?: { available?: boolean; reason?: string }; projects?: Project[] };
type Tool = "get_architecture" | "search_graph" | "trace_path" | "get_code_snippet" | "index_status" | "detect_changes";

export function CodebaseGraphModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [list, setList] = useState<ProjectList | null>(null);
  const [projectId, setProjectId] = useState("");
  const [tool, setTool] = useState<Tool>("search_graph");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await callServerApi(serverId, "", "GET", "/api/codebase-graph/projects");
    const data = unwrap<ProjectList>(response);
    if (data) setList(data); else setError(response.error || (es ? "No se pudieron cargar los proyectos." : "Could not load projects."));
  }, [es, serverId]);
  useEffect(() => { void load(); }, [load]);
  const run = async (event: FormEvent) => {
    event.preventDefault(); if (!projectId) return;
    setBusy(true); setError(""); setResult(null);
    const args: Record<string, string> = {};
    if (tool === "search_graph") args.query = query.trim();
    if (tool === "trace_path") { args.function_name = query.trim(); args.direction = "inbound"; }
    if (tool === "get_code_snippet") args.qualified_name = query.trim();
    const response = await callServerApi(serverId, "", "POST", `/api/codebase-graph/projects/${encodeURIComponent(projectId)}/query`, { tool, args });
    if (response.ok) setResult(unwrap(response)); else setError(response.error || (es ? "La consulta falló." : "Query failed."));
    setBusy(false);
  };
  return <div className="mx-auto flex max-w-5xl flex-col gap-4 pb-8"><div className="flex items-center gap-2"><Network size={20} className="text-primary" /><h2 className="flex-1 text-xl font-semibold">{es ? "Grafo de código" : "Codebase graph"}</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}><RefreshCw size={15} />{es ? "Actualizar" : "Refresh"}</button></div>
    {error && <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}{list?.availability?.available === false && <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning">{list.availability.reason || (es ? "El índice de grafo no está disponible en este servidor." : "Graph index is unavailable on this server.")}</p>}
    <form onSubmit={(event) => void run(event)} className="space-y-3 rounded-xl border border-base-300 p-4"><div className="flex flex-wrap gap-3"><label className="text-xs">{es ? "Proyecto" : "Project"}<select className="select select-bordered select-sm mt-1 block" required value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{es ? "Seleccionar" : "Select"}</option>{list?.projects?.filter((p) => p.graphIndex?.enabled).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label><label className="text-xs">{es ? "Consulta" : "Query"}<select className="select select-bordered select-sm mt-1 block" value={tool} onChange={(event) => setTool(event.target.value as Tool)}>{(["search_graph", "trace_path", "get_code_snippet", "get_architecture", "index_status", "detect_changes"] as Tool[]).map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>{["search_graph", "trace_path", "get_code_snippet"].includes(tool) && <input className="input input-bordered w-full" required value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tool === "search_graph" ? (es ? "Nombre, función o clase" : "Name, function or class") : tool === "trace_path" ? "function_name" : "qualified_name"} />}<button type="submit" className="btn btn-primary btn-sm" disabled={busy || !projectId}><Search size={15} />{busy ? (es ? "Consultando…" : "Querying…") : (es ? "Consultar" : "Query")}</button></form>
    {result !== null && <section className="min-w-0 rounded-xl border border-base-300"><h3 className="border-b border-base-300 p-3 text-sm font-semibold">{es ? "Resultado" : "Result"}</h3><pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-all p-4 text-xs">{JSON.stringify(result, null, 2)}</pre></section>}
  </div>;
}
