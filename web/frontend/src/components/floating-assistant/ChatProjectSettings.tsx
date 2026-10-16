// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState } from "react";
import { assistantProjectsApi, type AssistantProject } from "./assistant-api";
import { CollapsibleSection } from "./CollapsibleSection";
import { useChatProjectVisibility } from "./chat-project-visibility";
import { formatAssistantMessage, useAssistantI18n } from "./i18n";

export function ChatProjectSettings() {
  const messages = useAssistantI18n();
  const t = messages.settingsModal.chatProjects;
  const { scope, hiddenIds, setVisible } = useChatProjectVisibility();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [catalog, setCatalog] = useState<{ scope: string; projects: AssistantProject[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCatalog(null);
    setError(null);
    setSaveError(false);
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void assistantProjectsApi.list().then(projects => {
      if (!cancelled) setCatalog({ scope, projects: projects.filter(project => !project.parentId) });
    }).catch(() => {
      if (!cancelled) setError(t.loadError);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, scope, attempt, t.loadError]);

  const projects = catalog?.scope === scope ? catalog.projects : [];
  const needle = query.trim().toLocaleLowerCase();
  const matches = projects.filter(project => [project.title, project.path].some(value => value.toLocaleLowerCase().includes(needle)));
  const visibleCount = projects.filter(project => !hiddenIds.includes(project.id)).length;
  const update = (ids: string[], visible: boolean) => setSaveError(!setVisible(ids, visible));

  return (
    <CollapsibleSection
      icon={<i className="ti ti-folders text-lg" aria-hidden />}
      title={t.title}
      description={t.description}
      open={open}
      onOpenChange={setOpen}
    >
      {loading && <p role="status" className="text-xs text-muted-foreground">{t.loading}</p>}
      {error && <div role="alert" className="space-y-2 text-xs">
        <p className="text-destructive">{error}</p>
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="rounded border border-border px-3 py-1.5 hover:bg-accent">{t.retry}</button>
      </div>}
      {!loading && !error && catalog?.scope === scope && (projects.length === 0
        ? <p className="text-xs text-muted-foreground">{t.empty}</p>
        : <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span role="status" className="text-xs text-muted-foreground">{formatAssistantMessage(t.count, { visible: visibleCount, total: projects.length })}</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => update(projects.map(project => project.id), true)} className="rounded border border-border px-2 py-1 text-xs hover:bg-accent">{t.showAll}</button>
              <button type="button" onClick={() => update(projects.map(project => project.id), false)} className="rounded border border-border px-2 py-1 text-xs hover:bg-accent">{t.hideAll}</button>
            </div>
          </div>
          <input type="search" value={query} onChange={event => setQuery(event.currentTarget.value)}
            aria-label={t.search} placeholder={t.search}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {matches.map(project => <label key={project.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
              <input type="checkbox" checked={!hiddenIds.includes(project.id)}
                onChange={event => update([project.id], event.currentTarget.checked)}
                className="size-4 shrink-0 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-primary/40" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{project.title}</span>
                {project.path && <span className="block truncate text-xs text-muted-foreground" title={project.path}>{project.path}</span>}
              </span>
            </label>)}
            {matches.length === 0 && <p className="text-xs text-muted-foreground">{t.noMatches}</p>}
          </div>
          <p className="text-[11px] text-muted-foreground">{t.hint}</p>
        </div>)}
      {saveError && <p role="alert" className="mt-2 text-xs text-destructive">{t.saveError}</p>}
    </CollapsibleSection>
  );
}
