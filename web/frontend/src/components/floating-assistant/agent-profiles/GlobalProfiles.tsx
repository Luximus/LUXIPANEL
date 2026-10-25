import { useEffect, useRef, useState } from "react";
import { Search, Globe2, LockKeyhole } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { scopeHeaders, resolveTargetScope } from "@/lib/api-client";
import { assistantProjectsApi, type AssistantProject, type ResolvedModule } from "../assistant-api";
import { AgentAvatar } from "../AgentAvatar";
import { AgentProfileDialog } from "../AgentProfileDialog";
import { useModuleCatalog } from "../use-module-catalog";
import { profilesApi } from "./api";
import { profileCopy, profileStatus } from "./copy";
import { emptyGlobalManifest, type GlobalDraft, type GlobalManifest, type PublishedProfile, type ProfileHistory } from "./types";

export const profileControl = "min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const scopeKey = () => JSON.stringify([resolveTargetScope(), scopeHeaders(true)]);
export function GlobalProfiles({ mode, locale, projectId }: { mode: "bazaar" | "mine"; locale?: string; projectId?: string }) {
  const t = profileCopy(locale);
  const [rows, setRows] = useState<(GlobalDraft | PublishedProfile)[]>([]);
  const [projects, setProjects] = useState<AssistantProject[]>([]);
  const [selected, setSelected] = useState(projectId ?? "");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<GlobalDraft | null>(null);
  const [preview, setPreview] = useState<GlobalDraft | null>(null);
  const [version, setVersion] = useState("1.0.0");
  const [history, setHistory] = useState<ProfileHistory | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [imported, setImported] = useState<string>();
  const requests = useRef(new Map<string, string>()), inFlight = useRef(false), generation = useRef(0);
  const initialScope = useRef(scopeKey()), mounted = useRef(true);
  const current = () => mounted.current && scopeKey() === initialScope.current;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  async function load() {
    const gen = ++generation.current; setLoading(true); setError("");
    try {
      const [data, projectList] = await Promise.all([mode === "bazaar" ? profilesApi.catalog() : profilesApi.list(), assistantProjectsApi.list()]);
      if (!current() || gen !== generation.current) return;
      setRows(Array.isArray(data) ? data : data.profiles);
      setCanPublish(!Array.isArray(data) && data.capabilities.canPublish); setProjects(projectList);
    } catch (e) { if (current() && gen === generation.current) setError((e as Error).message); }
    finally { if (current() && gen === generation.current) setLoading(false); }
  }
  useEffect(() => { setRows([]); setDraft(null); setPreview(null); setHistory(null); void load(); }, [mode]);
  async function perform(work: () => Promise<void>) {
    if (!current() || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (e) { if (current()) setError((e as Error).message); }
    finally { inFlight.current = false; if (current()) setBusy(false); }
  }
  async function importProfile(row: GlobalDraft | PublishedProfile) {
    if (!selected) return;
    const version = "revision" in row ? `1.0.${row.revision}` : row.version;
    const key = [mode, row.id, version, selected].join(":");
    const requestId = requests.current.get(key) ?? crypto.randomUUID();
    requests.current.set(key, requestId);
    const agent = await profilesApi.import({ source: mode === "mine" ? "local" : "bazaar", id: row.id, version, projectId: selected, requestId });
    if (!current()) return;
    setImported(agent.id); setNotice(t.imported);
    window.dispatchEvent(new Event("lxp:assistant:agents-updated"));
  }
  const visible = rows.filter(row => [row.manifest.name, row.manifest.specialty, ...row.manifest.technologies].join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6" aria-busy={busy || loading}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{mode === "mine" ? t.mine : t.bazaar}</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.intro}</p></div>
      {mode === "mine" && <button className={profileControl} disabled={busy} onClick={() => setDraft({ id: crypto.randomUUID(), revision: 0, manifest: emptyGlobalManifest() })}>{t.new}</button>}
    </header>
    <div className="flex flex-wrap gap-2">
      <label className="relative min-w-52 flex-1"><Search size={18} className="absolute start-3 top-3 text-muted-foreground" aria-hidden /><input aria-label={t.search} className={`${profileControl} w-full ps-10`} placeholder={t.search} value={query} onChange={e => setQuery(e.target.value)} /></label>
      <select aria-label={t.choose} className={`${profileControl} max-w-full pe-9`} disabled={busy || !!projectId} value={selected} onChange={e => { setSelected(e.target.value); setImported(undefined); }}><option value="">{t.choose}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
      <button className={profileControl} disabled={busy || loading} onClick={() => void load()}>{t.retry}</button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {loading ? <p role="status">{t.loading}</p> : !visible.length && !error ? <p className="py-8 text-muted-foreground">{t.empty}</p> : <div className="grid gap-3 lg:grid-cols-2">
      {visible.map(row => <article key={row.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3"><AgentAvatar agent={{ ...row.manifest, id: row.id }} size={44} /><div className="min-w-0 flex-1"><h3 className="font-semibold">{row.manifest.name}</h3><p className="text-sm text-muted-foreground">{row.manifest.specialty}</p></div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">{mode === "bazaar" ? <Globe2 size={14} /> : <LockKeyhole size={14} />}{mode === "bazaar" ? t.public : t.private}</span></div>
        <p className="whitespace-pre-wrap text-sm">{row.manifest.description}</p>
        <p className="text-xs text-muted-foreground">{"author" in row ? `${row.author} · v${row.version}` : `r${row.revision}`}</p>
        <div className="flex flex-wrap gap-1">{row.manifest.technologies.map(tag => <span key={tag} className="rounded bg-muted px-2 py-1 text-xs">{tag}</span>)}</div>
        <details className="text-sm"><summary className="cursor-pointer py-2">{t.preview}</summary><ManifestPreview manifest={row.manifest} locale={locale} /></details>
        <div className="mt-auto flex flex-wrap gap-2"><button disabled={busy || !selected} className={profileControl} onClick={() => void perform(() => importProfile(row))}>{t.import}</button>
          {"revision" in row && <><button className={profileControl} disabled={busy} onClick={() => setDraft(row)}>{t.edit}</button>
            {canPublish && <><button className={profileControl} disabled={busy} onClick={() => { setPreview(row); setVersion("1.0.0"); }}>{t.submit}</button>
              <button className={profileControl} disabled={busy} onClick={() => void perform(async () => { const data = await profilesApi.history(row.id); if (current()) setHistory(data); })}>{t.history}</button></>}</>}
        </div>
      </article>)}
    </div>}
    {draft && <ModalShell title={t.mine} description={t.globalHint} closeLabel={t.cancel} closeDisabled={busy} onClose={() => setDraft(null)}>
      <GlobalProfileEditor value={draft.manifest} locale={locale} busy={busy} error={error} onSave={manifest => void perform(async () => {
        await profilesApi.save({ id: draft.id, revision: draft.revision, manifest }); if (!current()) return; setDraft(null); setNotice(t.saved); await load();
      })} />
    </ModalShell>}
    {preview && <ModalShell title={t.preview} description={t.publishHint} closeLabel={t.cancel} closeDisabled={busy} onClose={() => setPreview(null)}>
      <div className="flex flex-col gap-4 p-4"><ManifestPreview manifest={preview.manifest} locale={locale} />
        <label>{t.version}<input className={`${profileControl} ms-2`} value={version} onChange={e => setVersion(e.target.value)} pattern="\d+\.\d+\.\d+" /></label>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <button className={profileControl} disabled={busy || !/^\d+\.\d+\.\d+$/.test(version)} onClick={() => void perform(async () => { await profilesApi.publish(preview, version); if (current()) { setPreview(null); setNotice(t.sent); } })}>{t.submit}</button>
      </div>
    </ModalShell>}
    {history && <ModalShell title={t.history} closeLabel={t.cancel} closeDisabled={busy} onClose={() => setHistory(null)}>
      <div className="space-y-4 p-4"><p>{profileStatus(history.profile.visibility, locale)}</p>{history.versions.map(v => <p key={v.version}>v{v.version} · {profileStatus(v.status, locale)}</p>)}
        {history.events.map((e, i) => <p key={i} className="whitespace-pre-wrap text-sm">{profileStatus(e.action, locale)} · {e.message}</p>)}
        {error && <p role="alert">{error}</p>}<button disabled={busy || history.profile.visibility === "suspended" || !history.profile.publishedVersion} className={profileControl} onClick={() => void perform(async () => {
          await profilesApi.visibility(history.profile.id, history.profile.visibility === "published" ? "unpublished" : "published");
          const next = await profilesApi.history(history.profile.id); if (current()) setHistory(next);
        })}>{history.profile.visibility === "published" ? t.unpublish : t.republish}</button>
      </div>
    </ModalShell>}
    {imported && <AgentProfileDialog agentId={imported} projectId={selected} locale={locale} onClose={() => setImported(undefined)} />}
  </section>;
}
export function ManifestPreview({ manifest, locale }: { manifest: GlobalManifest; locale?: string }) {
  const t = profileCopy(locale);
  return <dl className="space-y-3 text-sm">{(["name", "description", "specialty", "technologies", "knowledge", "systemPrompt", "allowedTools"] as const).map(key =>
    <div key={key}><dt className="font-medium">{t[key]}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{Array.isArray(manifest[key]) ? manifest[key].join(", ") || "—" : manifest[key] ?? t.allTools}</dd></div>)}</dl>;
}
export function GlobalProfileEditor({ value, onSave, locale, busy, error }: { value: GlobalManifest; onSave(v: GlobalManifest): void; locale?: string; busy: boolean; error?: string }) {
  const t = profileCopy(locale), [draft, setDraft] = useState(value), [tab, setTab] = useState("general");
  const [modules, setModules] = useState<ResolvedModule[]>([]);
  const [technologyText, setTechnologyText] = useState(value.technologies.join(", "));
  useModuleCatalog(setModules);
  const known = new Set(modules.flatMap(m => m.tools.map(tool => tool.name)));
  return <form className="flex flex-col gap-4 p-4" onSubmit={e => { e.preventDefault(); onSave({ ...draft, technologies: [...new Set(technologyText.split(",").map(s => s.trim()).filter(Boolean))] }); }}>
    <div className="flex gap-2 border-b border-border pb-3">{["general", "tools"].map(key => <button key={key} type="button" aria-pressed={tab === key} className={profileControl} onClick={() => setTab(key)}>{key === "general" ? t.general : t.tools}</button>)}</div>
    {tab === "general" ? <>
      <div className="flex items-center gap-3"><AgentAvatar agent={draft} size={56} /><button type="button" className={profileControl} onClick={() => setDraft({ ...draft, avatarConfig: { seed: crypto.randomUUID() } })}>{t.avatar}</button></div>
      {(["name", "description", "specialty", "knowledge", "systemPrompt"] as const).map(key => <label key={key} className="flex flex-col gap-1 text-sm">{t[key]}
        {key === "name" || key === "specialty" ? <input required={key === "name"} maxLength={key === "name" ? 120 : 200} className={profileControl} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /> :
          <textarea rows={key === "description" ? 2 : 6} maxLength={key === "description" ? 500 : key === "knowledge" ? 12000 : 20000} className={profileControl} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />}</label>)}
      <label className="flex flex-col gap-1 text-sm">{t.technologies}<input className={profileControl} value={technologyText} onChange={e => setTechnologyText(e.target.value)} /></label>
    </> : <>
      <p className="text-sm text-muted-foreground">{t.toolHint}</p>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={draft.allowedTools === null} onChange={e => setDraft({ ...draft, allowedTools: e.target.checked ? null : [] })} />{t.allTools}</label>
      {draft.allowedTools !== null && <><div className="grid gap-1 sm:grid-cols-2">{[...new Set([...known, ...draft.allowedTools])].sort().map(name =>
        <label key={name} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.allowedTools!.includes(name)} onChange={e => setDraft({ ...draft, allowedTools: e.target.checked ? [...draft.allowedTools!, name] : draft.allowedTools!.filter(n => n !== name) })} /><span>{name}{!known.has(name) ? " · ⚠" : ""}</span></label>)}</div></>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <button type="submit" disabled={busy || !draft.name.trim()} className={`${profileControl} self-end`}>{busy ? t.loading : t.save}</button>
  </form>;
}
