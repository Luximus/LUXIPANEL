// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** ProjectModal prop shapes — extracted verbatim. */
import type { AssistantProject } from "../assistant-api";

export interface ProjectModalProps {
  project: AssistantProject | null; // null = create
  allProjects?: AssistantProject[];
  /** Pre-set parentId when creating a child project. */
  initialParentId?: string;
  onClose(): void;
  onSaved(p: AssistantProject): void;
  onDeleted?(id: string): void;
  /** Called after assigning/removing a child so ChatPane reloads allProjects. */
  onRefresh?(): void;
}

/** Inner view props: the public props plus the in-place navigation controls the
 *  wrapper injects (parent ↔ child navigation swaps content IN the same modal). */
export type ProjectModalViewProps = ProjectModalProps & {
  /** True when this isn't the root project → show a "Back" button. */
  canGoBack: boolean;
  /** While true, an overlay spinner is shown (project is changing). */
  loading?: boolean;
  /** Pop the navigation stack (return to the project we came from). */
  onBack(): void;
  /** Push a related project (parent/child) to view it IN this same modal. */
  onNavigate(p: AssistantProject): void;
};
