import { GlobalProfiles } from "./agent-profiles/GlobalProfiles";
import { profileCopy } from "./agent-profiles/copy";
import { ProfileUpdate } from "./agent-profiles/ProfileUpdate";
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Search, Store, RefreshCw } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { openConfirm } from "@/lib/confirm";
import { resolveTargetScope, scopeHeaders } from "@/lib/api-client";
import { assistantAgentsApi, assistantProjectsApi, assistantAgentRolesApi, PROVIDER_META,
  type AssistantAgent, type AssistantProject, type AssistantAgentRole } from "./assistant-api";
import { AgentRequestError } from "./assistant-api/agents";
import { AgentAvatar } from "./AgentAvatar";
import { formatAssistantMessage, useAssistantI18n } from "./i18n";
import { assignedInProject, emptyMarketFilters, filterMarket } from "./agent-market-state";
import { AgentAssignmentEditor } from "./AgentAssignmentEditor";
import { AgentProfileDialog } from "./AgentProfileDialog";

export const marketControl = "min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const scopeKey = () => JSON.stringify([resolveTargetScope(), scopeHeaders(true)]);
const resetEvents = ["luxipanel:target-changed", "luxipanel:logout", "luxipanel:session-ended", "luxipanel:session-started", "luxipanel:permissions-changed"];

export function AgentMarket(props: { projectId?: string; initialEditAgentId?: string; locale?: string; onBack?: () => void }) {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const reset = () => setEpoch(n => n + 1);
    resetEvents.forEach(event => window.addEventListener(event, reset));
    return () => resetEvents.forEach(event => window.removeEventListener(event, reset));
  }, []);
  return <ProfileWorkspace key={`${scopeKey()}:${epoch}:${props.projectId ?? ""}`} {...props} projectId={epoch ? undefined : props.projectId} initialEditAgentId={epoch ? undefined : props.initialEditAgentId} />;
}

function ProfileWorkspace(props: Parameters<typeof AgentMarket>[0]) {
  const t = profileCopy(props.locale);
  const [tab, setTab] = useState<"project" | "bazaar" | "mine">(props.projectId || props.initialEditAgentId ? "project" : "bazaar");
  return <div className="flex min-h-0 flex-1 flex-col"><nav className="flex flex-wrap gap-2 border-b border-border p-3" aria-label={t.bazaar}>
    {(["bazaar", "mine", "project"] as const).map(key => <button key={key} className={marketControl} aria-pressed={tab === key} onClick={() => setTab(key)}>{t[key]}</button>)}
    {props.onBack && <button className={`${marketControl} ms-auto`} onClick={props.onBack}><ArrowLeft size={16} aria-label={t.cancel} /></button>}
  </nav>{tab === "project" ? <MarketContent {...props} /> : <GlobalProfiles key={tab} mode={tab} locale={props.locale} projectId={props.projectId} />}</div>;
}

function MarketContent({ projectId, initialEditAgentId, locale, onBack }: Parameters<typeof AgentMarket>[0]) {
  const i18n = useAssistantI18n(), t = i18n.agentMarket;
  const [selected, setSelected] = useState(projectId ?? "");
  const [filters, setFilters] = useState(emptyMarketFilters);
  const projectView = !!projectId && !onBack;
  const [source, setSource] = useState<"project" | "market">("project");
  const [agents, setAgents] = useState<AssistantAgent[]>([]);
  const [projects, setProjects] = useState<AssistantProject[]>([]);
  const [roles, setRoles] = useState<AssistantAgentRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [editor, setEditor] = useState<AssistantAgent | null>(null);
  const [profile, setProfile] = useState<string | null>(initialEditAgentId ?? null);
  const mounted = useRef(true), sequence = useRef(0), busy = useRef(false);
  const scope = useRef(scopeKey());
  const current = () => mounted.current && scope.current === scopeKey();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++sequence.current; }; }, []);
  const errorText = (err: unknown) => {
    if (err instanceof AgentRequestError) {
      if (!err.status) return t.uncertain;
      if (err.code === "ASSISTANT_ASSIGNMENT_BUSY") return t.busy;
      if (err.status === 403) return t.forbidden;
      if (err.code === "TARGET_SCOPE_CHANGED") return t.contextChanged;
      if (err.code === "ASSISTANT_ASSIGNMENT_INHERITED") return t.inheritedHint.replace("{project}", projects.find(p => p.id === editor?.context?.effectiveAssignment?.inheritedFrom)?.title ?? t.project);
    }
    return t.error;
  };
  const reload = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true); setError(null);
    try {
      const [items, projectList, roleList] = await Promise.all([
        assistantAgentsApi.list(selected ? { contextProjectId: selected } : {}),
        assistantProjectsApi.list(), assistantAgentRolesApi.list(),
      ]);
      if (!current() || id !== sequence.current) return;
      setAgents(items); setProjects(projectList); setRoles(roleList);
    } catch { if (current() && id === sequence.current) setError(t.error); }
    finally { if (current() && id === sequence.current) setLoading(false); }
  }, [selected, t.error]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const refresh = () => { if (!busy.current) void reload(); };
    window.addEventListener("lxp:assistant:agents-updated", refresh);
    return () => window.removeEventListener("lxp:assistant:agents-updated", refresh);
  }, [reload]);

  async function mutate(agent: AssistantAgent, action: "add" | "remove" | "configure", data = {}) {
    if (!current() || !selected || busy.current || error) return;
    const requestProject = selected, requestSequence = sequence.current;
    busy.current = true; setPending(agent.id); setError(null); setNotice("");
    try {
      if (action === "remove" && !await openConfirm(formatAssistantMessage(t.removeConfirm, { name: agent.name }), { variant: "danger" })) return;
      if (!current() || sequence.current !== requestSequence) return;
      // Revalidate the server's context and capabilities after any confirmation.
      const fresh = (await assistantAgentsApi.list({ contextProjectId: requestProject })).find(a => a.id === agent.id);
      if (!current() || sequence.current !== requestSequence) return;
      const capability = action === "remove" ? "canRemoveAssignment" : action === "add" ? "canAssign" : "canUpdateAssignment";
      if (fresh?.context?.projectId !== requestProject || !fresh.capabilities?.[capability]) throw new AgentRequestError(403, undefined, "");
      if (action === "remove") await assistantAgentsApi.removeAssignment(agent.id, requestProject);
      else await assistantAgentsApi.updateAssignment(agent.id, requestProject, data);
      if (!current()) return;
      setEditor(null); setNotice(t.saved);
      window.dispatchEvent(new Event("lxp:assistant:agents-updated"));
      await reload();
    } catch (err) {
      if (current()) { setError(errorText(err)); setNotice(""); }
    } finally { busy.current = false; if (current()) setPending(null); }
  }
  const visible = filterMarket(agents, projectView ? { ...filters, assignment: source === "project" ? "assigned" : "unassigned" } : filters, selected);
  const viewTitle = profileCopy(locale).project;
  const projectTitle = (id: string) => projects.find(project => project.id === id)?.title ?? t.project;
  return <section aria-label={viewTitle} aria-busy={loading || !!pending} className={`flex min-h-0 flex-1 flex-col overflow-y-auto text-foreground ${projectView ? "" : "p-4 sm:p-6"}`}>
    {!projectView && <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Store size={22} aria-hidden />{profileCopy(locale).project}</h2><p className="mt-1 text-sm text-muted-foreground">{profileCopy(locale).privateHint}</p></div>
      {onBack && <button type="button" className={marketControl} onClick={onBack}><ArrowLeft className="me-2 inline" size={16} aria-hidden />{t.back}</button>}
    </header>}
    <div data-agent-filters className="mb-4 flex shrink-0 items-center gap-2 overflow-x-auto pb-1">
      <div className="relative min-w-40 flex-1">
        <Search className="pointer-events-none absolute start-3 top-3 text-muted-foreground" size={18} aria-hidden />
        <input type="search" aria-label={t.search} title={t.search} placeholder={t.search} value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} className={`${marketControl} w-full ps-10`} />
      </div>
      {projectView ? <select aria-label={t.agentSource} className={`${marketControl} w-44 shrink-0`} value={source} disabled={!!pending} onChange={event => { setSource(event.target.value as "project" | "market"); setEditor(null); setNotice(""); }}>
        <option value="project">{t.projectAgents}</option><option value="market">{profileCopy(locale).otherPrivate}</option>
      </select> : <select aria-label={t.project} className={`${marketControl} w-44 shrink-0`} value={selected} disabled={!!pending} onChange={event => { setSelected(event.target.value); setEditor(null); setNotice(""); setAgents([]); }}>
        <option value="">{t.chooseProject}</option>{projects.map(project => <option key={project.id} value={project.id}>{project.parentId ? `${projectTitle(project.parentId)} / ` : ""}{project.title}</option>)}
      </select>}
      <select aria-label={i18n.agentInfo.providerLabel} className={`${marketControl} w-48 shrink-0`} value={filters.provider} onChange={event => setFilters({ ...filters, provider: event.target.value })}>
        <option value="">{t.allProviders}</option>{[...new Set(agents.map(a => a.providerId))].sort().map(id => <option key={id} value={id}>{PROVIDER_META[id]?.label ?? id}</option>)}
      </select>
      <select aria-label={i18n.agentInfo.roleLabel} className={`${marketControl} w-36 shrink-0`} value={filters.role} onChange={event => setFilters({ ...filters, role: event.target.value })}>
        <option value="">{t.allRoles}</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
      </select>
      {!projectView && <select aria-label={t.allAssignments} className={`${marketControl} w-44 shrink-0`} disabled={!selected} value={filters.assignment} onChange={event => setFilters({ ...filters, assignment: event.target.value })}>
        <option value="">{t.allAssignments}</option><option value="assigned">{t.assigned}</option><option value="unassigned">{t.unassigned}</option>
      </select>}
      <button type="button" className={`${marketControl} shrink-0 whitespace-nowrap`} disabled={!!pending || loading || !selected} onClick={() => setProfile("new")}>{profileCopy(locale).createPrivate}</button>
    </div>
    {!selected && <p className="mb-4 text-sm text-muted-foreground">{t.chooseProject}</p>}
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-destructive p-3 text-sm"><p>{error}</p><button className={marketControl} disabled={!!pending} onClick={() => void reload()}><RefreshCw size={16} className="me-2 inline" aria-hidden />{t.retry}</button></div>}
    {(notice || pending) && <p role="status" className="mb-3 text-sm">{pending ? t.pending : notice}</p>}
    {loading ? <p role="status" className="py-8 text-sm text-muted-foreground">{t.loading}</p> : !error && !visible.length ? <p className="py-8 text-sm text-muted-foreground">{agents.length ? t.noMatches : t.empty}</p> : !loading && <div className="grid gap-3 xl:grid-cols-2">
      {visible.map(agent => {
        const assigned = assignedInProject(agent, selected), context = agent.context?.projectId === selected ? agent.context : null;
        const inheritedFrom = context?.effectiveAssignment?.inheritedFrom;
        return <article key={agent.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3"><AgentAvatar agent={agent} size={44} /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{agent.name}</h3><p className="text-sm text-muted-foreground">{agent.specialty || roles.find(role => role.id === agent.roleId)?.name || PROVIDER_META[agent.providerId]?.label}</p></div><span className="rounded-md bg-muted px-2 py-1 text-xs">{context?.membership === "inherited" ? t.inherited : assigned ? t.assigned : context?.membership === "removed" ? t.removed : t.unassigned}</span></div>
          {agent.description && <p className="whitespace-pre-wrap break-words text-sm">{agent.description}</p>}
          {!!agent.technologies?.length && <ul className="flex flex-wrap gap-1" aria-label={t.technologies}>{agent.technologies.map((tag, index) => <li key={`${tag}:${index}`} className="rounded bg-muted px-2 py-1 text-xs">{tag}</li>)}</ul>}
          {inheritedFrom && <div className="text-sm text-muted-foreground"><p>{formatAssistantMessage(t.inheritedHint, { project: projectTitle(inheritedFrom) })}</p>{onBack && <button type="button" className={marketControl} disabled={!!pending} onClick={() => { setSelected(inheritedFrom); setAgents([]); setNotice(""); }}>{projectTitle(inheritedFrom)}</button>}</div>}
          <div className="mt-auto flex flex-wrap gap-2">
            {context && agent.capabilities?.canAssign && <button className={marketControl} disabled={!!pending || !!error} onClick={() => assigned ? setEditor(agent) : void mutate(agent, "add")}>{assigned ? t.configure : t.add}</button>}
            {selected && agent.capabilities?.canUpdateAssignment && <button className={marketControl} disabled={!!pending || !!error} onClick={() => setEditor(agent)}>{t.configure}</button>}
            {selected && agent.capabilities?.canRemoveAssignment && <button className={marketControl} disabled={!!pending || !!error} onClick={() => void mutate(agent, "remove")}>{t.remove}</button>}
            {selected && context?.effectiveAssignment?.sourceProfile && <ProfileUpdate agentId={agent.id} projectId={selected} locale={locale} onUpdated={() => void reload()} />}
            {agent.capabilities?.canEditProfile ? <button className={marketControl} disabled={!!pending || !!error} onClick={() => setProfile(agent.id)}>{profileCopy(locale).editPrivate}</button> : <span className="self-center text-sm text-muted-foreground">{t.readOnly}</span>}
          </div>
        </article>;
      })}
    </div>}
    {editor && <ModalShell closeDisabled={!!pending} onClose={() => { if (!busy.current) setEditor(null); }} title={`${t.configure} · ${editor.name}`} description={t.assignmentHint} closeLabel={i18n.drawer.close}>
      {error && <div role="alert" className="flex flex-wrap items-center gap-2 px-4 pt-4 text-sm text-destructive"><p>{error}</p><button type="button" className={marketControl} disabled={!!pending} onClick={() => { setEditor(null); void reload(); }}>{t.retry}</button></div>}
      <AgentAssignmentEditor agent={editor} agents={agents} projects={projects} roles={roles} pending={!!pending} blocked={!!error} onSave={data => void mutate(editor, editor.capabilities?.canUpdateAssignment ? "configure" : "add", data)} />
    </ModalShell>}
    {profile && <AgentProfileDialog agentId={profile === "new" ? undefined : profile} projectId={selected || undefined} locale={locale} onClose={() => setProfile(null)} onSaved={() => void reload()} />}
  </section>;
}
