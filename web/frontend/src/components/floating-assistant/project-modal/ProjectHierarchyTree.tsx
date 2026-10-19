// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { openConfirm } from "@/lib/confirm";
import { assistantProjectsApi, type AssistantProject } from "../assistant-api";
import { LucideIcon } from "../LucideIcon";
import { hierarchyIds, hierarchyRoot, mayReparent, rankForInsertion, sortedSiblings } from "./project-hierarchy";
import "./project-hierarchy.css";

type Props = {
  project: AssistantProject;
  allProjects: AssistantProject[];
  onNavigate(project: AssistantProject): void;
  onCreateChild(parent: AssistantProject): void;
  onRefresh?(): void;
};

export function ProjectHierarchyTree({ project, allProjects, onNavigate, onCreateChild, onRefresh }: Props) {
  const [projects, setProjects] = useState(allProjects);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [shreddedId, setShreddedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileActionsId, setMobileActionsId] = useState<string | null>(null);
  useEffect(() => setProjects(allProjects), [allProjects]);
  useEffect(() => {
    let live = true;
    void assistantProjectsApi.list().then((fresh) => { if (live) setProjects(fresh); }).catch(() => undefined);
    return () => { live = false; };
  }, [project.id]);

  const root = useMemo(() => hierarchyRoot(project, projects), [project, projects]);
  const inTree = useMemo(() => hierarchyIds(root, projects), [root, projects]);
  const byId = useMemo(() => new Map(projects.map((item) => [item.id, item])), [projects]);
  const members = projects.filter((item) => inTree.has(item.id));
  const mutable = (node: AssistantProject) => node.relation !== "shared";

  async function refresh() {
    const fresh = await assistantProjectsApi.list();
    setProjects(fresh);
    onRefresh?.();
  }

  async function move(node: AssistantProject, parent: AssistantProject, beforeId: string | null) {
    if (busyId || !mutable(node) || !mutable(parent) || !mayReparent(node, parent, root, projects)) return;
    if (beforeId === node.id) return;
    setError(null);
    setBusyId(node.id);
    try {
      let rank = rankForInsertion(node, parent.id, beforeId, projects);
      if (rank === null) {
        // Extremely dense fractional positions: spread existing siblings once.
        const siblings = sortedSiblings(parent.id, projects).filter((item) => item.id !== node.id);
        for (const [index, sibling] of siblings.entries()) {
          await assistantProjectsApi.update(sibling.id, { sortOrder: (index + 1) * 1024 });
        }
        const fresh = await assistantProjectsApi.list();
        rank = rankForInsertion(node, parent.id, beforeId, fresh);
      }
      if (rank === null) throw new Error("No se pudo calcular la nueva posición.");
      await assistantProjectsApi.update(node.id, {
        ...(node.parentId !== parent.id ? { parentId: parent.id } : {}),
        sortOrder: rank,
      });
      setCollapsed((current) => { const next = new Set(current); next.delete(parent.id); return next; });
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
      draggedIdRef.current = null;
      setDropKey(null);
    }
  }

  async function remove(node: AssistantProject) {
    if (busyId || node.id === root.id || !mutable(node)) return;
    if (projects.some((item) => item.parentId === node.id)) {
      setError("Mueve o elimina los subproyectos de este proyecto antes de borrarlo.");
      return;
    }
    if (!(await openConfirm(
      `¿Eliminar ${node.title}? Los chats quedarán en Chats sueltos; el equipo y sus agentes se conservarán.`,
      { title: "Eliminar proyecto", confirmText: "Eliminar", variant: "danger" },
    ))) return;
    setBusyId(node.id);
    setError(null);
    try {
      await assistantProjectsApi.remove(node.id);
      setShreddedId(node.id);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
      if (project.id === node.id) onNavigate(root);
      await refresh();
      setShreddedId(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusyId(null);
      draggedIdRef.current = null;
      setDropKey(null);
    }
  }

  function direction(node: AssistantProject, delta: -1 | 1) {
    const siblings = sortedSiblings(node.parentId!, projects);
    const index = siblings.findIndex((item) => item.id === node.id);
    const target = delta < 0 ? siblings[index - 1] : siblings[index + 2];
    if (delta < 0 && index <= 0 || delta > 0 && index >= siblings.length - 1) return;
    const parent = byId.get(node.parentId!);
    if (parent) void move(node, parent, target?.id ?? null);
  }

  function indent(node: AssistantProject) {
    const siblings = sortedSiblings(node.parentId!, projects);
    const previous = siblings[siblings.findIndex((item) => item.id === node.id) - 1];
    if (previous) void move(node, previous, null);
  }

  function outdent(node: AssistantProject) {
    const parent = byId.get(node.parentId!);
    const grandparent = parent?.parentId ? byId.get(parent.parentId) : null;
    if (!parent || !grandparent) return;
    const peers = sortedSiblings(grandparent.id, projects);
    void move(node, grandparent, peers[peers.findIndex((item) => item.id === parent.id) + 1]?.id ?? null);
  }

  function acceptDrop(event: DragEvent, node: AssistantProject, parent: AssistantProject, key: string) {
    const source = draggedIdRef.current && byId.get(draggedIdRef.current);
    if (!source || !mayReparent(source, parent, root, projects) || !mutable(source) || !mutable(parent)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropKey(key);
  }

  function renderNode(node: AssistantProject, depth: number): ReactNode {
    const children = sortedSiblings(node.id, projects).filter((item) => inTree.has(item.id));
    const isRoot = node.id === root.id;
    const siblings = isRoot ? [] : sortedSiblings(node.parentId!, projects);
    const index = isRoot ? 0 : siblings.findIndex((item) => item.id === node.id);
    const canIndent = !isRoot && index > 0 && mayReparent(node, siblings[index - 1]!, root, projects);
    const canOutdent = !isRoot && !!byId.get(node.parentId!)?.parentId;
    const parent = !isRoot ? byId.get(node.parentId!) : undefined;
    const beforeKey = `before:${node.id}`;
    return (
      <div key={node.id} className={depth ? "lxp-project-branch" : ""} data-hierarchy-node={node.id}>
        {!isRoot && parent && (
          <div className={`lxp-project-drop-line ${dropKey === beforeKey ? "is-active" : ""}`}
            aria-hidden="true"
            onDragOver={(event) => acceptDrop(event, node, parent, beforeKey)}
            onDragLeave={() => setDropKey(null)}
            onDrop={(event) => { event.preventDefault(); const id = draggedIdRef.current; const source = id && byId.get(id); if (source) void move(source, parent, node.id); }} />
        )}
        <div
          className={`lxp-project-tree-row group flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-1.5 ${isRoot ? "is-root" : ""} ${project.id === node.id ? "border-primary/45 bg-primary/10" : "border-border/60 bg-muted/20"} ${dropKey === `inside:${node.id}` ? "ring-2 ring-primary" : ""} ${shreddedId === node.id ? "is-shredding" : ""}`}
          draggable={!isRoot && mutable(node) && !busyId}
          onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", node.id); draggedIdRef.current = node.id; }}
          onDragEnd={() => { draggedIdRef.current = null; setDropKey(null); }}
          onDragOver={(event) => acceptDrop(event, node, node, `inside:${node.id}`)}
          onDragLeave={() => setDropKey(null)}
          onDrop={(event) => { event.preventDefault(); const id = draggedIdRef.current; const source = id && byId.get(id); if (source) void move(source, node, null); }}
        >
          <button type="button" aria-label={`${collapsed.has(node.id) ? "Expandir" : "Contraer"} ${node.title}`}
            aria-expanded={!collapsed.has(node.id)}
            onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; })}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary">
            <i className={`ti ti-chevron-right text-xs text-muted-foreground transition-transform ${collapsed.has(node.id) ? "" : "rotate-90"}`} aria-hidden />
          </button>
          <LucideIcon name={node.icon} size={15} className="shrink-0 text-primary" />
          <button type="button" onClick={() => { if (project.id !== node.id) onNavigate(node); }} title={`Editar ${node.title}`}
            className="lxp-tree-name min-w-0 flex-1 truncate rounded px-1 text-left text-xs font-medium hover:text-primary focus-visible:ring-2 focus-visible:ring-primary">
            {node.title}
          </button>
          <span className="hidden shrink-0 text-[10px] text-muted-foreground @2xl:inline">{children.length > 0 ? children.length : ""}</span>
          <button type="button" className="lxp-tree-mobile-toggle" aria-label={`Acciones de ${node.title}`}
            aria-expanded={mobileActionsId === node.id} onClick={() => setMobileActionsId(mobileActionsId === node.id ? null : node.id)}>
            <i className="ti ti-dots-vertical" aria-hidden />
          </button>
          <div className={`lxp-tree-actions flex shrink-0 items-center gap-1 ${mobileActionsId === node.id ? "is-mobile-open" : ""}`}>
          <button type="button" onClick={() => onCreateChild(node)} disabled={!mutable(node)} aria-label={`Crear subproyecto en ${node.title}`}
            className="lxp-tree-action" title="Crear subproyecto"><i className="ti ti-plus" aria-hidden /><span className="lxp-tree-action-label">Crear</span></button>
          {!isRoot && <>
            <button type="button" onClick={() => direction(node, -1)} disabled={busyId !== null || index === 0 || !mutable(node)} aria-label={`Subir ${node.title}`} className="lxp-tree-action" title="Subir"><i className="ti ti-arrow-up" aria-hidden /><span className="lxp-tree-action-label">Subir</span></button>
            <button type="button" onClick={() => direction(node, 1)} disabled={busyId !== null || index === siblings.length - 1 || !mutable(node)} aria-label={`Bajar ${node.title}`} className="lxp-tree-action" title="Bajar"><i className="ti ti-arrow-down" aria-hidden /><span className="lxp-tree-action-label">Bajar</span></button>
            <button type="button" onClick={() => indent(node)} disabled={busyId !== null || !canIndent || !mutable(node)} aria-label={`Anidar ${node.title}`} className="lxp-tree-action" title="Anidar"><i className="ti ti-arrow-right" aria-hidden /><span className="lxp-tree-action-label">Anidar</span></button>
            <button type="button" onClick={() => outdent(node)} disabled={busyId !== null || !canOutdent || !mutable(node)} aria-label={`Subir de nivel ${node.title}`} className="lxp-tree-action" title="Subir de nivel"><i className="ti ti-arrow-left" aria-hidden /><span className="lxp-tree-action-label">Desanidar</span></button>
            <button type="button" onClick={() => void remove(node)} disabled={busyId !== null || children.length > 0 || !mutable(node)} aria-label={`Eliminar ${node.title}`} className="lxp-tree-action hover:text-destructive" title={children.length ? "Mueve o elimina sus subproyectos primero" : "Eliminar proyecto"}><i className="ti ti-trash" aria-hidden /><span className="lxp-tree-action-label">Eliminar</span></button>
          </>}
          </div>
        </div>
        {children.length > 0 && !collapsed.has(node.id) && (
          <div className="lxp-project-tree-children" role="group" aria-label={`Subproyectos de ${node.title}`}>
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-2 border-t border-border pt-4" data-project-hierarchy>
      <div className="flex items-center justify-between gap-2">
        <div><span className="block text-xs font-medium text-foreground">Estructura de proyectos</span>
          <p className="text-[11px] text-muted-foreground">{members.length - 1} subproyecto(s) · <span className="max-sm:hidden">Arrastra para ordenar o anidar</span><span className="sm:hidden">Usa Acciones para ordenar o anidar</span></p></div>
        <button type="button" onClick={() => onCreateChild(project)} disabled={!mutable(project)} className="rounded-md border border-primary/45 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/10">+ Subproyecto</button>
      </div>
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">{error}</p>}
      <div className="max-h-[28rem] overflow-auto rounded-lg border border-border/60 bg-card/40 p-2" role="tree" aria-label="Jerarquía de proyectos">
        {renderNode(root, 0)}
      </div>
      <div className={`lxp-project-shredder rounded-md border border-dashed border-destructive/35 px-3 py-2 text-center text-[11px] text-muted-foreground ${dropKey === "shredder" ? "is-active" : ""}`}
        role="note" aria-label="Arrastra aquí un subproyecto para eliminarlo"
        onDragOver={(event) => { if (draggedIdRef.current && draggedIdRef.current !== root.id) { event.preventDefault(); setDropKey("shredder"); } }}
        onDragLeave={() => setDropKey(null)}
        onDrop={(event) => { event.preventDefault(); const id = draggedIdRef.current; const node = id && byId.get(id); if (node) void remove(node); }}>
        <i className="ti ti-trash mr-1.5" aria-hidden />Arrastra aquí para eliminar · requiere confirmación
      </div>
    </section>
  );
}
