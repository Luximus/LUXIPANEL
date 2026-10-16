// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { assistantAgentsApi, assistantProjectsApi, type AssistantAgent, type AssistantProject } from "./assistant-api";
import { ProjectModal } from "./ProjectModal";
import { mergeNamespaces, useAssistantI18n } from "./i18n";
import { projectModalFallback, type ProjectModalMessages } from "./project-modal/messages";
import { projectForAgent } from "./project-modal/agent-scope";

/** Compatibility for agent chips and existing deep links: open the owning
 * project's editor instead of reviving the removed global Agents section. */
export function ProjectAgentsDialog({ projectId, agentId, locale, onClose, onLaunchAgent }: {
  projectId?: string;
  agentId?: string;
  locale: string;
  onClose(): void;
  onLaunchAgent(agent: AssistantAgent, projectId?: string): void;
}) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & { projectModal?: Partial<ProjectModalMessages> };
  const t = mergeNamespaces(projectModalFallback, i18n.projectModal);
  const [projects, setProjects] = useState<AssistantProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([assistantProjectsApi.list(), agentId ? assistantAgentsApi.list() : Promise.resolve([])]).then(([list, agents]) => {
      if (!active) return;
      setProjects(list);
      const agent = agents.find((item) => item.id === agentId);
      const project = agentId
        ? agent && projectForAgent(agent, list, projectId)
        : list.find((item) => item.id === projectId);
      setSelectedId(project?.id ?? null);
      if (agentId && !project) setError(t.agentsMissingTeam);
      setLoading(false);
    }).catch((err: Error) => {
      if (active) { setError(err.message); setLoading(false); }
    });
    return () => { active = false; };
  }, [projectId, agentId, t.agentsMissingTeam]);

  const selected = projects.find((project) => project.id === selectedId);
  if (selected) return <ProjectModal
    project={selected}
    allProjects={projects}
    initialTab="agents"
    initialEditAgentId={agentId}
    locale={locale}
    onClose={onClose}
    onLaunchAgent={onLaunchAgent}
    onSaved={(project) => {
      setProjects((list) => list.map((item) => item.id === project.id ? project : item));
      window.dispatchEvent(new Event("lxp:assistant:projects-updated"));
    }}
    onDeleted={() => { window.dispatchEvent(new Event("lxp:assistant:projects-updated")); onClose(); }}
    onRefresh={() => {
      window.dispatchEvent(new Event("lxp:assistant:projects-updated"));
      void assistantProjectsApi.list().then(setProjects).catch((err: Error) => setError(err.message));
    }}
  />;

  const roots = projects.filter((project) => !project.parentId && project.teamId);
  return <ModalShell onClose={onClose} title={t.tabAgents} description={t.agentsChooseProject} closeLabel={i18n.drawer.close}>
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground">{t.agentsChooseProject}</p>
      {loading && <p role="status" className="text-sm text-muted-foreground">{t.loadingProject}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !error && <div className="grid gap-2 sm:grid-cols-2">
        {roots.map((project) => <button key={project.id} type="button" onClick={() => setSelectedId(project.id)} className="flex items-center gap-2 rounded-lg border border-border p-3 text-left text-sm hover:bg-accent">
          <i className="ti ti-folder" aria-hidden /><span className="truncate">{project.title}</span>
        </button>)}
        {!roots.length && <p className="text-sm text-muted-foreground">{t.noProjectsRegistered}</p>}
      </div>}
    </div>
  </ModalShell>;
}
