/* eslint-disable react-hooks/set-state-in-effect -- exploración remota y búsqueda */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, FileCode2, FileText, Folder, RefreshCw, Search } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Entry = { name: string; path: string; kind: "directory" | "file" };
type Listing = { path: string; entries: Entry[]; truncated: boolean };
type ProjectFile = { path: string; name: string; size: number; content: string | null; truncated: boolean; language: string; binary: boolean };
type SearchResult = { query: string; results: Entry[]; truncated: boolean };

const pathFor = (action: string, params: Record<string, string>) => `/api/module-dev/project/${action}?${new URLSearchParams(params)}`;

/** Read-only source explorer; all filesystem authorization remains in LUXIPANEL. */
export function ProjectMapModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [currentPath, setCurrentPath] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const cache = useRef(new Map<string, Listing>());

  const open = useCallback(async (entry: Entry) => {
    const id = ++requestId.current;
    setCurrentPath(entry.path);
    setBusy(true);
    setError("");
    try {
      if (entry.kind === "directory") {
        const hit = cache.current.get(entry.path);
        const response = hit ? null : await callServerApi(serverId, "", "GET", pathFor("tree", { path: entry.path }));
        const data = hit ?? (response ? unwrap<Listing>(response) : null);
        if (!data) throw new Error(es ? "No se pudo abrir la carpeta." : "Could not open the folder.");
        cache.current.set(entry.path, data);
        if (id === requestId.current) { setListing(data); setFile(null); }
      } else {
        const response = await callServerApi(serverId, "", "GET", pathFor("file", { path: entry.path }));
        const data = unwrap<ProjectFile>(response);
        if (!data) throw new Error(es ? "No se pudo abrir el archivo." : "Could not open the file.");
        if (id === requestId.current) { setFile(data); setListing(null); }
      }
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (id === requestId.current) setBusy(false); }
  }, [es, serverId]);

  useEffect(() => { void open({ name: "LUXIPANEL", path: "", kind: "directory" }); }, [open]);
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) { setResults(null); return; }
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      void (async () => {
        const response = await callServerApi(serverId, "", "GET", pathFor("search", { q: query }));
        if (id !== requestId.current) return;
        const data = unwrap<SearchResult>(response);
        setResults(data?.results ?? []);
        if (!data) setError(es ? "No se pudo buscar en el proyecto." : "Could not search the project.");
      })();
    }, 250);
    return () => clearTimeout(timer);
  }, [es, search, serverId]);

  const refresh = async () => {
    setBusy(true);
    const response = await callServerApi(serverId, "", "POST", "/api/module-dev/project/refresh");
    cache.current.clear();
    setBusy(false);
    if (!response.ok) { setError(es ? "No se pudo actualizar el árbol." : "Could not refresh the tree."); return; }
    void open({ name: currentPath.split("/").pop() || "LUXIPANEL", path: file ? currentPath.split("/").slice(0, -1).join("/") : currentPath, kind: "directory" });
  };

  const parts = currentPath ? currentPath.split("/").filter(Boolean) : [];
  const entries = results ?? listing?.entries ?? [];
  return <div className="flex min-h-[32rem] flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary">LUXIPANEL / {es ? "código fuente" : "source code"}</p><h2 className="mt-1 text-xl font-semibold">{es ? "Mapa proyecto" : "Project map"}</h2><p className="text-sm opacity-65">{es ? "Explora los archivos reales de este servidor." : "Explore the real files on this server."}</p></div><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void refresh()}><RefreshCw size={15} className={busy ? "animate-spin" : ""} />{es ? "Actualizar" : "Refresh"}</button></div>
    <div className="flex flex-wrap gap-2">{[["backend/src/modules", es ? "Backend" : "Backend"], ["frontend/src/pages/panel", "Frontend"], ["backend/src/shared", es ? "Servicios" : "Services"], ["scripts", "Scripts"]].map(([path, label]) => <button key={path} type="button" className="btn btn-outline btn-xs font-mono" onClick={() => { setSearch(""); void open({ name: label, path, kind: "directory" }); }}>{label}</button>)}</div>
    <div className="grid min-h-[28rem] flex-1 overflow-hidden rounded-xl border border-base-300 bg-base-100 md:grid-cols-[minmax(14rem,17rem)_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-base-300 md:border-b-0 md:border-r"><label className="border-b border-base-300 p-3"><span className="mb-1 block text-xs font-semibold">{es ? "Buscar archivo o carpeta" : "Search files or folders"}</span><span className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-2.5 opacity-50" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={es ? "Nombre o ruta…" : "Name or path…"} className="input input-bordered input-sm w-full pl-9" /></span></label><div className="min-h-0 flex-1 overflow-auto p-2" role="listbox" aria-label={results ? (es ? "Resultados" : "Results") : (es ? "Archivos" : "Files")}>{entries.length ? entries.map((entry) => { const Icon = entry.kind === "directory" ? Folder : /\.(tsx?|jsx?|astro|py|css|html|sh)$/.test(entry.name) ? FileCode2 : FileText; return <button key={entry.path} type="button" onClick={() => { setSearch(""); void open(entry); }} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-base-200 ${currentPath === entry.path ? "bg-primary/10 text-primary" : ""}`} title={entry.path}><Icon size={15} className="shrink-0" /><span className="truncate">{entry.name}</span>{entry.kind === "directory" ? <ChevronRight size={13} className="ml-auto shrink-0" /> : null}</button>; }) : <p className="p-3 text-xs opacity-60">{results ? (es ? "Sin resultados" : "No results") : (es ? "Carpeta vacía" : "Empty folder")}</p>}</div></aside>
      <section className="flex min-h-0 min-w-0 flex-col"><nav className="flex flex-wrap items-center gap-1 border-b border-base-300 px-3 py-2 font-mono text-[11px]" aria-label={es ? "Ruta actual" : "Current path"}><button type="button" className="text-primary hover:underline" onClick={() => { setSearch(""); void open({ name: "LUXIPANEL", path: "", kind: "directory" }); }}>LUXIPANEL</button>{parts.map((part, i) => { const path = parts.slice(0, i + 1).join("/"); return <span key={path} className="flex items-center gap-1"><ChevronRight size={11} /><button type="button" className="max-w-32 truncate hover:text-primary" onClick={() => { setSearch(""); void open({ name: part, path, kind: i === parts.length - 1 && file ? "file" : "directory" }); }}>{part}</button></span>; })}</nav>
        {error ? <p role="alert" className="p-4 text-sm text-error">{error}</p> : null}{busy ? <div className="m-auto loading loading-spinner text-primary" /> : file ? file.binary || file.content === null ? <p className="p-5 text-sm opacity-65">{es ? "Este archivo no tiene vista previa de texto." : "This file has no text preview."}</p> : <div className="min-h-0 flex-1 overflow-auto"><div className="sticky top-0 border-b border-base-300 bg-base-100 px-4 py-2 text-xs opacity-65">{file.language} · {file.size.toLocaleString()} bytes{file.truncated ? ` · ${es ? "Vista limitada" : "Preview limited"}` : ""}</div><div className="flex min-w-max font-mono text-xs leading-5"><pre aria-hidden className="sticky left-0 m-0 select-none border-r border-base-300 bg-base-200 px-3 py-3 text-right opacity-55">{file.content.split("\n").map((_, i) => i + 1).join("\n")}</pre><pre className="m-0 px-4 py-3"><code>{file.content}</code></pre></div></div> : <div className="min-h-0 flex-1 overflow-auto p-3">{listing?.entries.map((entry) => <button type="button" key={entry.path} onClick={() => void open(entry)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-base-200">{entry.kind === "directory" ? <Folder size={17} className="text-primary" /> : <FileText size={17} className="opacity-60" />}<span className="min-w-0 flex-1 truncate">{entry.name}</span>{entry.kind === "directory" ? <ChevronRight size={14} /> : <span className="max-w-[40%] truncate font-mono text-[10px] opacity-50">{entry.path}</span>}</button>)}{listing?.truncated ? <p className="p-3 text-xs opacity-60">{es ? "Se muestran los primeros 500 elementos; usa la búsqueda." : "Showing the first 500 entries; use search."}</p> : null}</div>}
      </section>
    </div>
  </div>;
}
