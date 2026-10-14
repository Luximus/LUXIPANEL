/* eslint-disable react-hooks/set-state-in-effect -- estado remoto al montar */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { GitFork, RefreshCw, Search, Star } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Repo = { id: number; full_name: string; description?: string | null; html_url: string; stargazers_count: number; updated_at: string };
type Clone = { id: string; fullName: string; path: string; branch: string; dirty?: boolean; behind?: number; statusError?: string };
type StoreState = { saved: string[]; clones: Clone[] };

export function RepositoryStoreModule({ serverId, language }: ModuleProps) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [query, setQuery] = useState("luxipanel");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [state, setState] = useState<StoreState>({ saved: [], clones: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadState = useCallback(async () => {
    const response = await callServerApi(serverId, "", "GET", "/api/repository-store/state");
    const data = unwrap<StoreState>(response);
    if (data) setState(data); else setError(response.error || (es ? "No se pudo cargar tu catálogo." : "Could not load your catalogue."));
  }, [es, serverId]);
  const search = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setBusy(true); setError("");
    const response = await callServerApi(serverId, "", "GET", `/api/repository-store/search?q=${encodeURIComponent(value.trim())}&per_page=36`);
    const data = unwrap<{ items?: Repo[] }>(response);
    if (Array.isArray(data?.items)) setRepos(data.items);
    else setError(response.error || (es ? "No se pudo buscar en GitHub." : "Could not search GitHub."));
    setBusy(false);
  }, [es, serverId]);
  useEffect(() => { void loadState(); void search("luxipanel"); }, [loadState, search]);
  const submit = (event: FormEvent) => { event.preventDefault(); void search(query); };
  const save = async (fullName: string, saved: boolean) => {
    setError("");
    const response = await callServerApi(serverId, "", "POST", "/api/repository-store/saved", { fullNames: [fullName], saved });
    if (response.ok) void loadState(); else setError(response.error || (es ? "No se pudo actualizar el favorito." : "Could not update bookmark."));
  };
  const check = async (clone: Clone, update = false) => {
    setBusy(true); setError(""); setNotice("");
    const response = await callServerApi(serverId, "", "POST", `/api/repository-store/clones/${encodeURIComponent(clone.id)}/${update ? "update" : "check"}`, {});
    if (response.ok) { setNotice(update ? (es ? "Repositorio actualizado." : "Repository updated.") : (es ? "Estado comprobado." : "Status checked.")); void loadState(); }
    else setError(response.error || (es ? "No se pudo comprobar el repositorio." : "Could not check repository."));
    setBusy(false);
  };
  return <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8"><div className="flex items-center gap-2"><GitFork size={20} className="text-primary" /><h2 className="flex-1 text-xl font-semibold">{es ? "Tienda de repositorios" : "Repository store"}</h2><button className="btn btn-ghost btn-sm" type="button" onClick={() => { void loadState(); void search(query); }}><RefreshCw size={15} />{es ? "Actualizar" : "Refresh"}</button></div>
    {error && <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}{notice && <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">{notice}</p>}
    <form className="flex gap-2" onSubmit={submit}><input className="input input-bordered flex-1" required value={query} onChange={(event) => setQuery(event.target.value)} placeholder={es ? "Buscar repositorios públicos" : "Search public repositories"} /><button className="btn btn-primary" disabled={busy}><Search size={16} />{es ? "Buscar" : "Search"}</button></form>
    {state.clones.length > 0 && <section className="rounded-xl border border-base-300 p-4"><h3 className="mb-2 text-sm font-semibold">{es ? "Clones del servidor" : "Server clones"}</h3><div className="divide-y divide-base-300">{state.clones.map((clone) => <div key={clone.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><div className="min-w-40 flex-1"><strong>{clone.fullName}</strong><p className="truncate font-mono text-xs opacity-60">{clone.path} · {clone.branch}</p></div><span className="text-xs">{clone.statusError || (clone.dirty ? (es ? "Cambios locales" : "Local changes") : clone.behind ? `${clone.behind} ${es ? "pendientes" : "behind"}` : "")}</span><button type="button" className="btn btn-outline btn-xs" disabled={busy} onClick={() => void check(clone)}>{es ? "Comprobar" : "Check"}</button>{Boolean(clone.behind) && !clone.dirty && !clone.statusError && <button type="button" className="btn btn-primary btn-xs" disabled={busy} onClick={() => void check(clone, true)}>{es ? "Actualizar" : "Update"}</button>}</div>)}</div></section>}
    <section className="grid gap-3 md:grid-cols-2">{repos.map((repo) => { const saved = state.saved.some((name) => name.toLowerCase() === repo.full_name.toLowerCase()); return <article key={repo.id} className="min-w-0 rounded-xl border border-base-300 p-4"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{repo.full_name}</h3><p className="mt-1 line-clamp-2 text-sm opacity-70">{repo.description || (es ? "Sin descripción" : "No description")}</p></div><button type="button" className={`btn btn-ghost btn-sm btn-square ${saved ? "text-warning" : ""}`} aria-label={saved ? (es ? "Quitar favorito" : "Remove bookmark") : (es ? "Guardar favorito" : "Bookmark")} onClick={() => void save(repo.full_name, !saved)}><Star size={17} fill={saved ? "currentColor" : "none"} /></button></div><div className="mt-3 flex items-center gap-3 text-xs opacity-60"><span>★ {repo.stargazers_count}</span><span>{repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : ""}</span><a className="link link-primary ml-auto" href={repo.html_url} target="_blank" rel="noopener noreferrer">GitHub ↗</a></div></article>; })}</section>
  </div>;
}
