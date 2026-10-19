// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ProjectModalView — presentational drawer for the project create/edit modal.
 * All state/effects/handlers live in `./use-project-modal-view`; this component
 * renders the sectioned form from that VM.
 *
 * Chrome = `ModalShell` with the SAME navigation/loading UI as the Agentes IA
 * settings drawer (`AssistantSettingsModal`): structured header (back chevron
 * for in-place parent/child navigation, title, ✕), left `DrawerSectionNav`
 * rail, `@container` content column with the panel's view transition, fixed
 * footer (primary Save/Create, danger Delete) and an INLINE loading
 * state inside the content column while the drawer swaps to another project
 * (nav + header stay put — no opaque full-card spinner).
 */
import { lazy, Suspense, useState } from "react";
import { SettingsFooterContext, SettingsHeaderContext, type SettingsFooterAction, type SettingsHeaderOverride } from "../settings-footer";
const AgentMarket = lazy(() => import("../AgentMarket").then((module) => ({ default: module.AgentMarket })));
import { ModalShell } from "@/components/ui/ModalShell";
import { DrawerSectionNav, type DrawerSectionItem } from "@/components/ui/DrawerSectionNav";
import { cn } from "@/lib/utils";
import { ViewTransition, useViewDirection } from "@/components/ui/ViewTransition";

const PROJECT_TAB_ORDER = ["general", "context", "skills", "structure", "agents"] as const;
type ProjectTab = (typeof PROJECT_TAB_ORDER)[number];
import { STRUCTURE_PROVIDERS, type StructureProviderId } from "../assistant-api";
import { LucideIcon } from "../LucideIcon";
import { StructurePanel } from "../StructurePanel";
import { DirectoryPicker } from "../DirectoryPicker";
import { SkillsPicker } from "../SkillsPicker";
import { formatAssistantMessage } from "../i18n";
import { useProjectModalView, type ProjectModalViewVM } from "./use-project-modal-view";
import { ProjectIconSelect } from "./ProjectIconSelect";
import { type ProjectModalViewProps } from "./types";

export function ProjectModalView(props: ProjectModalViewProps) {
  const vm: ProjectModalViewVM = useProjectModalView(props);
  const { i18n, project, allProjects, initialParentId, onClose, deferredClose, canGoBack, loading, onBack, onNavigate, t, tab, setTab, title, setTitle, icon, setIcon, path, setPath, fileProjectRef, setFileProjectRef, instructions, setInstructions, provider, setProvider, autoCapture, setAutoCapture, verifyText, setVerifyText, busy, err, pickingDir, setPickingDir, graphAvail, graphEnabled, setGraphEnabled, graphState, graphBusy, indexNow, skills, setSkills, snippetCategory, setSnippetCategory, snippetTags, setSnippetTags, snippetOpts, servers, availableConns, connsLoading, toggleServer, addBusy, removeBusy, selectRef, overlayRef, assignedChildren, parentProject, availableForChild, save, del, doAddChild, doRemoveChild, wide } = vm;
  // Dirección de la transición entre secciones (orden del menú lateral).
  const tabDirection = useViewDirection(tab, PROJECT_TAB_ORDER);
  const rootDoc = STRUCTURE_PROVIDERS.find((item) => item.id === provider)!.rootDoc;
  const canEditRoot = !!project?.id && provider === project.provider;
  const { structurePanel } = i18n as typeof i18n & { structurePanel?: { edit: string } };
  const editRootLabel = `${structurePanel?.edit ?? t.editProject} ${rootDoc}`;
  const [agentFooter, setAgentFooter] = useState<SettingsFooterAction | null>(null);
  const [agentHeader, setAgentHeader] = useState<SettingsHeaderOverride | null>(null);
  const activeAgentHeader = tab === "agents" ? agentHeader : null;

  // Section menu — same shape as the settings drawer (`AssistantSettingsModal`).
  // Structure only exists for saved projects.
  const sections: DrawerSectionItem[] = [
    { id: "general", label: t.tabGeneral, icon: "ti-id-badge-2", description: t.sectionGeneralDesc },
    { id: "context", label: t.tabContext, icon: "ti-file-text", description: t.sectionContextDesc },
    { id: "skills", label: t.tabSkills, icon: "ti-stack-2", description: t.sectionSkillsDesc },
    ...(project ? [{ id: "structure", label: t.tabStructure, icon: "ti-binary-tree", description: t.sectionStructureDesc }] : []),
    ...(project ? [{ id: "agents", label: t.tabAgents, icon: "ti-robot", description: t.sectionAgentsDesc }] : []),
  ];
  const activeSection = sections.find((s) => s.id === tab) ?? sections[0]!;
  const headerTitle = project ? t.editProject : (initialParentId ? t.newSubproject : t.newProject);

  // Footer holds actions; the header closes the drawer. The structure section
  // is read-only, so it has no footer.
  const footer = (
    <>
      {tab !== "structure" && (
        <div className="mr-auto flex min-w-0 items-center gap-3">
          {project && (
            <button
              type="button"
              onClick={del}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-40"
            >
              <i className="ti ti-trash" aria-hidden></i>{t.delete}
            </button>
          )}
          {err && <p className="truncate text-xs text-amber-500" title={err}>⚠ {err}</p>}
        </div>
      )}
      {tab !== "structure" && (
        <button
          type="button"
          onClick={save}
          disabled={busy || loading || vm.contextLoading || (tab === "context" && !!project?.id && !vm.contextDocument)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {busy ? t.saving : t.save}
        </button>
      )}
    </>
  );

  // ModalShell portals to <body> so the overlay escapes the assistant drawer's
  // stacking/clipping context (vaul `will-change: transform` + overflow-hidden
  // wrappers) and covers the whole viewport. It also stops pointer/mouse
  // propagation so vaul's DismissableLayer never reads a click inside as an
  // "outside" interaction, and owns Escape + body pointer-events. `overlayRef`
  // feeds the VM's document-level focus guard (Radix focus trap defeat);
  // `closeController` shares the VM's exit phase (save/delete/backdrop/✕
  // all play the same 200ms ease-out exit, never a double onClose).
  return (
    <SettingsFooterContext.Provider value={setAgentFooter}>
    <SettingsHeaderContext.Provider value={setAgentHeader}>
    <ModalShell
      onClose={props.onClose}
      closeController={deferredClose}
      overlayRef={overlayRef}
      cardClassName="w-[min(96vw,68rem)] max-lg:w-[85vw] max-sm:w-full"
      title={tab === "agents" ? `${activeAgentHeader?.title ?? t.tabAgents} · ${project?.title}` : headerTitle}
      description={tab === "agents" ? `${project?.title} · ${activeAgentHeader?.description ?? activeSection.description}` : activeSection.description}
      onBack={activeAgentHeader?.onBack ?? (canGoBack ? onBack : undefined)}
      backLabel={activeAgentHeader?.backLabel ?? t.back}
      closeLabel={i18n.drawer.close}
      bodyClassName="overflow-hidden p-0"
      footer={tab === "structure" ? undefined : tab === "agents" ? (agentFooter ? (
        <button type="button" onClick={agentFooter.onClick} disabled={agentFooter.disabled} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40">{agentFooter.label}</button>
      ) : undefined) : footer}
    >
      <div className="flex h-full min-h-0">
        <DrawerSectionNav items={sections} activeId={tab} onSelect={(id) => { setTab(id as ProjectTab); }} />

        <div
          className={cn(
            "min-w-0 flex-1 @container",
            wide ? "flex flex-col overflow-hidden px-3 py-4 @xl:px-6" : "overflow-y-auto px-4 py-5 @xl:px-6",
          )}
        >
          {loading ? (
            /* Swapping to another project: inline loading state (same block as
               the settings sections), nav + header stay interactive. */
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center text-sm text-muted-foreground">
              <i className="ti ti-loader-2 animate-spin text-4xl text-primary/70" aria-hidden></i>
              <p className="font-medium text-foreground">{t.loadingProject}</p>
            </div>
          ) : (
          /* Contenido de la sección con la transición de vista del panel
             (motion.css): remontado por sección, entra desde el lado según el
             orden del menú. */
          <ViewTransition viewKey={tab} direction={tabDirection} className={wide ? "flex h-full min-h-0 flex-col" : tab === "context" ? "flex h-full flex-col gap-3" : "space-y-3"}>
          {tab === "general" && (
            <>
              {/* In-place navigation: the parent project button (Back moved to
                  the ModalNavbar chevron). Sits ABOVE the title with a separator.
                  Clicking the parent swaps THIS modal's content (no new modal). */}
              {parentProject && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {parentProject && (
                      <button
                        type="button"
                        onClick={() => onNavigate(parentProject)}
                        title={formatAssistantMessage(t.openParent, { title: parentProject.title })}
                        className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <i className="ti ti-arrow-up text-[12px]" aria-hidden></i>
                        <LucideIcon name={parentProject.icon} size={12} />
                        <span className="max-w-[16rem] truncate">
                          {formatAssistantMessage(t.seeProjectInfo, { title: parentProject.title })}
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="h-px bg-border" />
                </>
              )}

              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-end gap-3 @md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,14rem)_auto]" data-project-identity-row>
                <ProjectIconSelect value={icon} onChange={setIcon} label={t.iconLabel} />
                <label className="col-span-2 block min-w-0 text-xs @md:col-span-1">
                  <span className="text-muted-foreground">{t.titleLabel}</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t.titlePlaceholder}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="col-span-2 block min-w-0 text-xs @md:col-span-1">
                  <span className="text-muted-foreground">{t.providerLabel}</span>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as StructureProviderId)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none"
                  >
                    {STRUCTURE_PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label} · {p.rootDoc}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => { setTab("context"); }}
                  disabled={!canEditRoot || busy || loading}
                  title={canEditRoot ? editRootLabel : `${t.save} · ${rootDoc}`}
                  aria-label={editRootLabel}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="ti ti-pencil text-base" aria-hidden />
                </button>
              </div>

              <div className="block text-xs">
                <span className="text-muted-foreground">{t.workingDirLabel}</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    value={path}
                    readOnly
                    placeholder={t.workingDirPlaceholder}
                    title={path}
                    onClick={() => setPickingDir(true)}
                    className="flex-1 h-9 cursor-pointer rounded-md border border-input bg-muted/40 px-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPickingDir(true)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <i className="ti ti-folder-search" aria-hidden></i>{t.browse}
                  </button>
                  {path && (
                    <button
                      type="button"
                      onClick={() => setPath("")}
                      title={t.clear}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                    >
                      <i className="ti ti-x" aria-hidden></i>
                    </button>
                  )}
                </div>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {t.workingDirHint}
                </span>
                {(vm.contextDocument?.storagePath || project?.storagePath) && <span className="mt-2 block text-xs text-muted-foreground">
                  {t.projectDataLabel}: <code className="break-all">{vm.contextDocument?.storagePath || project?.storagePath}</code>
                </span>}
              </div>

              {fileProjectRef && <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
                <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2"><span className="min-w-0 flex-1 truncate font-mono text-[11px]" title={fileProjectRef.path}>Archivos: {fileProjectRef.path}</span><button type="button" onClick={() => setFileProjectRef(null)} className="text-destructive hover:underline">Desvincular</button></div>
              </div>}

              {/* ── Grafo de código — SOLO si el target tiene codebase-memory-mcp ── */}
              {graphAvail && (
                <div className="block rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                  <label className={`flex items-start gap-2 ${path ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                    <input
                      type="checkbox"
                      checked={graphEnabled}
                      disabled={!path}
                      onChange={(e) => setGraphEnabled(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>
                      <span className="font-medium">{t.graphIndexLabel}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {path ? t.graphIndexHint : t.graphNeedsPath}
                      </span>
                    </span>
                  </label>
                  {graphEnabled && path && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                      {graphState?.status === "indexing" ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <i className="ti ti-loader-2 animate-spin" aria-hidden></i>
                          {t.graphIndexing}
                        </span>
                      ) : graphState?.status === "ready" ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <i className="ti ti-check" aria-hidden></i>
                          {formatAssistantMessage(t.graphIndexedAt, {
                            date: graphState.lastIndexedAt ? new Date(graphState.lastIndexedAt).toLocaleString() : "—",
                            nodes: String(graphState.nodes ?? 0),
                          })}
                        </span>
                      ) : graphState?.status === "error" ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-500">
                          <i className="ti ti-alert-triangle" aria-hidden></i>
                          {formatAssistantMessage(t.graphIndexError, { error: graphState.error ?? "" })}
                        </span>
                      ) : null}
                      {graphState?.status === "ready" && graphState.indexedPath && graphState.indexedPath !== path && (
                        <span className="block w-full text-[10px] text-amber-500">{t.graphPathChanged}</span>
                      )}
                      {project?.id && graphState?.status !== "indexing" && (
                        <button
                          type="button"
                          onClick={indexNow}
                          disabled={graphBusy}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-accent disabled:opacity-50"
                        >
                          <i className="ti ti-topology-star-3" aria-hidden></i>
                          {graphState?.status === "ready" ? t.graphReindex : t.graphIndexNow}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* ── Servidores asociados ────────────────────────────────── */}
              <div className="space-y-1.5 border-t border-border pt-4" data-project-servers>
                <span className="block text-xs font-medium text-muted-foreground">{t.associatedServersLabel}</span>
                <p className="text-[10px] text-muted-foreground">
                  {t.associatedServersHint}{" "}
                  <code className="text-[9px]">servers.*</code>.
                </p>
                {connsLoading ? (
                  <p className="text-[11px] text-muted-foreground">
                    <i className="ti ti-loader-2 animate-spin mr-1" aria-hidden></i>{t.loadingConnections}
                  </p>
                ) : availableConns.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t.noServersToAssociate}
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/50 bg-muted/20 p-1.5">
                    {availableConns.map((conn) => {
                      const checked = servers.some((s) => s.id === conn.id);
                      return (
                        <label
                          key={conn.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleServer(conn)}
                            className="h-3.5 w-3.5 shrink-0 accent-primary"
                          />
                          <i className="ti ti-server text-muted-foreground" aria-hidden></i>
                          <span className="flex-1 truncate font-medium">{conn.name}</span>
                          {conn.host && (
                            <span className="shrink-0 truncate text-[10px] text-muted-foreground">{conn.host}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                {servers.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {formatAssistantMessage(t.associatedServersCount, { count: servers.length })}
                  </p>
                )}
              </div>
              {/* ── Proyectos hijos ─────────────────────────────────────── */}
              <div className="space-y-2 border-t border-border pt-4" data-project-children>
                <span className="block text-xs font-medium text-muted-foreground">{t.childProjectsLabel}</span>

                {/* Selector para añadir */}
                {availableForChild.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <select
                      ref={selectRef}
                      defaultValue=""
                      disabled={addBusy}
                      aria-label={t.selectProject}
                      className="min-w-0 flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
                    >
                      <option value="">{t.selectProject}</option>
                      {availableForChild.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void doAddChild()}
                      disabled={addBusy}
                      className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {addBusy ? t.adding : t.add}
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {allProjects.length === 0
                      ? t.noProjectsRegistered
                      : t.noMoreProjects}
                  </p>
                )}

                {/* Lista de hijos asignados */}
                {assignedChildren.length > 0 && (
                  <div className="space-y-1">
                    {assignedChildren.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2 py-1.5"
                      >
                        {/* Click a child → load its info in a nested modal (with a
                            Back button). Only in edit mode (the project exists). */}
                        {project ? (
                          <button
                            type="button"
                            onClick={() => onNavigate(child)}
                            title={formatAssistantMessage(t.openChild, { title: child.title })}
                            className="flex min-w-0 flex-1 items-center gap-1.5 rounded text-left hover:text-primary"
                          >
                            <LucideIcon name={child.icon} size={12} className="shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate text-[11px]">{child.title}</span>
                            <i className="ti ti-chevron-right shrink-0 text-[11px] opacity-60" aria-hidden></i>
                          </button>
                        ) : (
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <LucideIcon name={child.icon} size={12} className="shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate text-[11px]">{child.title}</span>
                          </div>
                        )}
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {STRUCTURE_PROVIDERS.find((p) => p.id === child.provider)?.label ?? child.provider}
                        </span>
                        <button
                          type="button"
                          onClick={() => void doRemoveChild(child)}
                          disabled={removeBusy === child.id}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                          title={t.removeChild}
                        >
                          {removeBusy === child.id
                            ? <i className="ti ti-loader-2 animate-spin text-[11px]" aria-hidden></i>
                            : <i className="ti ti-x text-[11px]" aria-hidden></i>}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "context" && (
            <>
              <label className="flex flex-1 flex-col text-xs" data-project-context-editor>
                <span className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>{project?.id ? `${t.tabContext} · ${vm.contextDocument?.rel ?? rootDoc}` : t.instructionsLabel}</span>
                  {project?.id && (vm.contextDocument && !vm.contextDocument.needsMigration && instructions === vm.contextDocument.content && canEditRoot
                    ? <a href={`/obsidian?project=${encodeURIComponent(project.id)}`} className="text-primary hover:underline">{t.contextObsidian}</a>
                    : <span aria-disabled="true" title={`${t.save} · ${t.tabContext}`} className="opacity-50">{t.contextObsidian}</span>)}
                </span>
                {project?.id && <span className="mt-1 block text-xs text-muted-foreground">{t.contextDocumentHint}</span>}
                {vm.contextDocument?.storagePath && <code className="mt-1 block break-all text-xs text-muted-foreground">{vm.contextDocument.storagePath}</code>}
                {vm.contextLoading && <span role="status" className="mt-2 block">{t.loadingProject}</span>}
                {vm.contextError && <span role="alert" className="mt-2 block text-destructive">{vm.contextError}</span>}
                <textarea
                  value={instructions}
                  disabled={!!project?.id && (!vm.contextDocument || provider !== project.provider)}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={8}
                  placeholder={t.instructionsPlaceholder}
                  className="mt-1 min-h-48 w-full flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </label>

              {/* Comandos de verificación (definition of done, equipos v2) */}
              <label className="block shrink-0 text-xs">
                <span className="text-muted-foreground">{t.verifyLabel}</span>
                <textarea
                  value={verifyText}
                  onChange={(e) => setVerifyText(e.target.value)}
                  rows={4}
                  placeholder={t.verifyPlaceholder}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none resize-y"
                />
                <span className="mt-1 block text-[10px] text-muted-foreground">{t.verifyHint}</span>
              </label>

              {/* Auto-captura al vault Obsidian (opt-in por proyecto) */}
              <label className="flex shrink-0 items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCapture}
                  onChange={(e) => setAutoCapture(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="font-medium">{t.autoCaptureTitle}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {t.autoCaptureHint}
                  </span>
                </span>
              </label>

              {/* Snippets de terminal: pre-filtro por categoría (+tags) para los
                  chats de este proyecto. Vacío = sin filtro. Sin permiso de
                  terminal → campos deshabilitados con aviso. */}
              <div className="block shrink-0 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs space-y-1.5">
                <span className="font-medium">{t.snippetsSection}</span>
                <p className="text-[10px] text-muted-foreground">{t.snippetsHelp}</p>
                {snippetOpts !== null && !snippetOpts.ok && (
                  <p className="text-[10px] text-amber-500">{t.snippetsNoAccess}</p>
                )}
                <label className="block text-xs">
                  <span className="text-muted-foreground">{t.snippetsCategoryLabel}</span>
                  <select
                    value={snippetCategory}
                    disabled={!snippetOpts?.ok}
                    onChange={(e) => {
                      // Cambiar (o quitar) la categoría resetea también los tags.
                      setSnippetCategory(e.target.value);
                      setSnippetTags([]);
                    }}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
                  >
                    <option value="">{t.snippetsCategoryNone}</option>
                    {/* Categoría guardada que ya no existe en la librería: se conserva visible. */}
                    {snippetCategory && !(snippetOpts?.categories ?? []).some((c) => c.name === snippetCategory) && (
                      <option value={snippetCategory}>{snippetCategory}</option>
                    )}
                    {(snippetOpts?.categories ?? []).map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </label>
                {snippetOpts?.ok && snippetCategory && (() => {
                  const cat = snippetOpts.categories.find((c) => c.name === snippetCategory);
                  const catTags = cat ? snippetOpts.tags.filter((tg) => tg.categoryId === cat.id) : [];
                  // Tags guardados que ya no existen: se conservan como toggle activo.
                  const knownNames = new Set(catTags.map((tg) => tg.name));
                  const orphanTags = snippetTags.filter((n) => !knownNames.has(n));
                  const toggleTag = (name: string) =>
                    setSnippetTags((prev) =>
                      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                    );
                  return (
                    <div className="block text-xs">
                      <span className="text-muted-foreground">{t.snippetsTagsLabel}</span>
                      {catTags.length === 0 && orphanTags.length === 0 ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">{t.snippetsNoTags}</p>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {[...orphanTags.map((name) => ({ key: `orphan:${name}`, name })), ...catTags.map((tg) => ({ key: String(tg.id), name: tg.name }))].map((tg) => {
                            const on = snippetTags.includes(tg.name);
                            return (
                              <button
                                key={tg.key}
                                type="button"
                                onClick={() => toggleTag(tg.name)}
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent"}`}
                              >
                                {tg.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {tab === "skills" && (
            <>
              {/* Skills del proyecto (solo en sus chats) */}
              <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
                <span className="shrink-0 text-xs font-medium text-muted-foreground">{t.skillsLabel}</span>
                <SkillsPicker value={skills} onChange={setSkills} fill />
              </div>
            </>
          )}

          {tab === "agents" && project && (
              <Suspense fallback={<p role="status" className="p-4 text-sm text-muted-foreground">{t.loadingProject}</p>}>
                <AgentMarket
                  key={project.id}
                  projectId={project.id}
                  locale={props.locale}
                  initialEditAgentId={props.initialEditAgentId ?? undefined}
                />
              </Suspense>
          )}

          {tab === "structure" && project && (
            <StructurePanel key={project.id} projectId={project.id} />
          )}
          </ViewTransition>
          )}
        </div>
      </div>

      {/* Folder picker — browses the connected server, stacks above this drawer (z-[10000]) */}
      {pickingDir && (
        <DirectoryPicker
          initialPath={path || "/"}
          onClose={() => setPickingDir(false)}
          onSelect={(p) => {
            setPath(p);
            setPickingDir(false);
          }}
        />
      )}
    </ModalShell>
    </SettingsHeaderContext.Provider>
    </SettingsFooterContext.Provider>
  );
}
