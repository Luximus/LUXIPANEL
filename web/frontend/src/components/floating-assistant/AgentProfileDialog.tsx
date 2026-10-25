import { profilesApi } from "./agent-profiles/api";
import { profileCopy } from "./agent-profiles/copy";
// SPDX-License-Identifier: AGPL-3.0-only
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { resolveTargetScope, scopeHeaders } from "@/lib/api-client";
import { assistantAgentsApi, type AssistantAgent } from "./assistant-api";
import { useAssistantI18n } from "./i18n";
import { SettingsFooterContext, SettingsHeaderContext } from "./settings-footer";
const AgentsTab = lazy(() => import("./AgentsTab").then(module => ({ default: module.AgentsTab })));

export function AgentProfileDialog({ agentId, projectId, locale, onClose, onSaved }: {
  agentId?: string; projectId?: string; locale?: string; onClose(): void; onSaved?(): void;
}) {
  const i18n = useAssistantI18n(), t = i18n.agentMarket;
  const [selectedProject, setSelectedProject] = useState(projectId ?? "");
  const [choices, setChoices] = useState<{ id: string; title: string }[]>([]);
  const [revision, setRevision] = useState(1);
  const [agent, setAgent] = useState<AssistantAgent | undefined>();
  const [loading, setLoading] = useState(!!agentId);
  const [error, setError] = useState<string | null>(null), [retry, setRetry] = useState(0);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    let current = true;
    const scope = () => JSON.stringify([resolveTargetScope(), scopeHeaders(true)]);
    const initial = scope();
    const invalidate = () => { current = false; close.current(); };
    const events = ["luxipanel:target-changed", "luxipanel:logout", "luxipanel:session-ended", "luxipanel:session-started", "luxipanel:permissions-changed"];
    events.forEach(event => window.addEventListener(event, invalidate));
    if (agentId) {
      setLoading(true); setError(null);
      void assistantAgentsApi.list().then(async items => {
        if (!current || initial !== scope()) return;
        const found = items.find(item => item.id === agentId);
        if (!found?.capabilities?.canEditProfile) { setError(t.forbidden); return; }
        const links = (found.assignments ?? (found.projectIds ?? []).map(projectId => ({ projectId, status: "active" }))).filter(a => a.status === "active");
        const pid = selectedProject || (links.length === 1 ? links[0].projectId : "");
        if (!pid && links.length > 1) {
          const { assistantProjectsApi } = await import("./assistant-api");
          const projects = await assistantProjectsApi.list();
          if (current && initial === scope()) setChoices(projects.filter(p => links.some(a => a.projectId === p.id)));
          return;
        }
        if (pid) {
          const data = await profilesApi.privateGet(agentId, pid);
          if (!current || initial !== scope()) return;
          if (data.assignment.inheritedFrom) { setSelectedProject(data.assignment.inheritedFrom); return; }
          setSelectedProject(pid); setRevision(data.assignment.revision ?? 1); setAgent(data.agent); setChoices([]);
        } else setAgent(found);
      }).catch(() => { if (current && initial === scope()) setError(t.error); })
        .finally(() => { if (current && initial === scope()) setLoading(false); });
    }
    return () => { current = false; events.forEach(event => window.removeEventListener(event, invalidate)); };
  }, [agentId, selectedProject, retry, t.forbidden, t.error]);
  useEscapeToClose(onClose, loading);
  if (loading) return <div className="fixed bottom-4 end-4 z-[10001] flex items-center gap-2 rounded-md border border-border bg-card p-2 text-foreground shadow-lg">
    <p role="status" className="px-2 text-sm">{t.loading}</p><button type="button" aria-label={i18n.drawer.close} className="flex size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring" onClick={onClose}><X size={18} aria-hidden /></button>
  </div>;
  return <SettingsFooterContext.Provider value={null}><SettingsHeaderContext.Provider value={null}>
    <ModalShell onClose={onClose} title={agentId ? profileCopy(locale).editPrivate : profileCopy(locale).createPrivate} description={profileCopy(locale).privateHint} closeLabel={i18n.drawer.close}>
      <p className="px-4 pt-4 text-sm text-muted-foreground">{profileCopy(locale).privateHint}</p>
      {choices.length > 0 ? <div className="p-4"><label>{profileCopy(locale).choose}<select className="ms-2 min-h-11 rounded border border-border bg-background px-3" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}><option value="">{profileCopy(locale).choose}</option>{choices.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label></div> : error ? <div role="alert" className="p-4 text-sm">{error}<button type="button" className="ms-2 min-h-11 rounded border border-border px-3 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setRetry(value => value + 1)}>{t.retry}</button></div>
        : <Suspense fallback={<p role="status" className="p-4">{t.loading}</p>}><AgentsTab editorOnly privateProjectId={selectedProject || undefined} privateRevision={revision} initialAgent={agent} initialEditAgentId={agentId} locale={locale} onEditorDone={() => { onSaved?.(); onClose(); }} onLaunchAgent={() => undefined} /></Suspense>}
    </ModalShell>
  </SettingsHeaderContext.Provider></SettingsFooterContext.Provider>;
}
