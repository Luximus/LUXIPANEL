// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ProjectModal — public project create/edit modal. Thin orchestrator: it owns
 * the in-place navigation stack and opens hierarchy selections in a second
 * drawer above the current view. `ProjectModalView` renders each layer
 * (its state/effects live in `./project-modal/use-project-modal-view`). The
 * public `ProjectModal` export + its props are unchanged.
 */
import { useEffect, useRef, useState } from "react";
import { type AssistantProject } from "./assistant-api";
import { ProjectModalView } from "./project-modal/ProjectModalView";
import { type ProjectModalProps } from "./project-modal/types";

/**
 * Breadcrumbs and child creation retain their navigation stack. A hierarchy
 * selection opens a new drawer while this view stays mounted underneath.
 */
export function ProjectModal(props: ProjectModalProps & { layer?: number }) {
  type Entry = { project: AssistantProject | null; parentId?: string };
  const [navStack, setNavStack] = useState<Entry[]>([{ project: props.project ?? null }]);
  const [overlayProject, setOverlayProject] = useState<AssistantProject | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Brief "changing project" spinner shown while the view swaps to the new
  // project (parent/child navigation or Back).
  const [navigating, setNavigating] = useState(false);
  // Reset to the root if the caller opens the modal on a different project.
  useEffect(() => {
    setNavStack([{ project: props.project ?? null }]);
    setOverlayProject(null);
  }, [props.project?.id]);
  // Clear the spinner shortly after a navigation lands (re-arms on each jump).
  useEffect(() => {
    if (!navigating) return;
    const id = window.setTimeout(() => setNavigating(false), 400);
    return () => window.clearTimeout(id);
  }, [navigating, navStack.length]);

  const entry = navStack[navStack.length - 1]!;
  const active = entry.project ? props.allProjects?.find((item) => item.id === entry.project?.id) ?? entry.project : null;
  const navTo = (updater: (s: Entry[]) => Entry[]) => {
    setNavigating(true);
    setNavStack(updater);
  };
  const openDrawer = (project: AssistantProject) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOverlayProject(project);
  };
  const closeDrawer = () => {
    setOverlayProject(null);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  };
  return (
    <>
    <ProjectModalView
      key={active?.id ?? `new:${entry.parentId ?? props.initialParentId ?? "root"}`}
      {...props}
      project={active}
      initialParentId={entry.parentId ?? props.initialParentId}
      canGoBack={navStack.length > 1}
      loading={navigating}
      covered={overlayProject !== null}
      layer={props.layer ?? 0}
      onBack={() => navTo((s) => (s.length > 1 ? s.slice(0, -1) : s))}
      onNavigate={(p) => navTo((s) => [...s, { project: p }])}
      onOpenDrawer={openDrawer}
      onCreateChild={(parent) => navTo((s) => [...s, { project: null, parentId: parent.id }])}
    />
    {overlayProject && <ProjectModal
      {...props}
      project={overlayProject}
      initialTab="general"
      initialEditAgentId={null}
      onClose={closeDrawer}
      layer={(props.layer ?? 0) + 1}
    />}
    </>
  );
}
