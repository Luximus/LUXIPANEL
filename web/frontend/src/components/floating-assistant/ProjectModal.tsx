// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ProjectModal — public project create/edit modal. Thin orchestrator: it owns
 * the in-place navigation stack (jumping to a parent/child project SWAPS the
 * content of THIS modal) and renders the presentational `ProjectModalView`
 * (whose state/effects live in `./project-modal/use-project-modal-view`). The
 * public `ProjectModal` export + its props are unchanged.
 */
import { useEffect, useState } from "react";
import { type AssistantProject } from "./assistant-api";
import { ProjectModalView } from "./project-modal/ProjectModalView";
import { type ProjectModalProps } from "./project-modal/types";

/**
 * Public modal. Owns the in-place navigation stack so jumping to a parent/child
 * project SWAPS the content of THIS modal (no second/stacked modal). Each entry
 * remounts the inner view (keyed by project id) so its form state re-initialises
 * for the project being shown; "Back" pops to the project we came from.
 */
export function ProjectModal(props: ProjectModalProps) {
  const [navStack, setNavStack] = useState<(AssistantProject | null)[]>([props.project ?? null]);
  // Brief "changing project" spinner shown while the view swaps to the new
  // project (parent/child navigation or Back).
  const [navigating, setNavigating] = useState(false);
  // Reset to the root if the caller opens the modal on a different project.
  useEffect(() => {
    setNavStack([props.project ?? null]);
  }, [props.project?.id]);
  // Clear the spinner shortly after a navigation lands (re-arms on each jump).
  useEffect(() => {
    if (!navigating) return;
    const id = window.setTimeout(() => setNavigating(false), 400);
    return () => window.clearTimeout(id);
  }, [navigating, navStack.length]);

  const active = navStack[navStack.length - 1] ?? null;
  const navTo = (updater: (s: (AssistantProject | null)[]) => (AssistantProject | null)[]) => {
    setNavigating(true);
    setNavStack(updater);
  };
  return (
    <ProjectModalView
      key={active?.id ?? "new"}
      {...props}
      project={active}
      canGoBack={navStack.length > 1}
      loading={navigating}
      onBack={() => navTo((s) => (s.length > 1 ? s.slice(0, -1) : s))}
      onNavigate={(p) => navTo((s) => [...s, p])}
    />
  );
}
