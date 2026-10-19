// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** ProjectModal prop shapes — extracted verbatim. */
import type { AssistantAgent, AssistantProject } from "../assistant-api";

export interface ProjectModalProps {
  project: AssistantProject | null; // null = create
  allProjects?: AssistantProject[];
  /** Pre-set parentId when creating a child project. */
  initialParentId?: string;
  initialTab?: "general" | "agents";
  initialEditAgentId?: string | null;
  locale?: string;
  onLaunchAgent?(agent: AssistantAgent, projectId?: string): void;
  onClose(): void;
  onSaved(p: AssistantProject): void;
  onDeleted?(id: string): void;
  /** Called after assigning/removing a child so ChatPane reloads allProjects. */
  onRefresh?(): void;
}

/** Inner view props: navigation controls and the layer managed by the wrapper. */
export type ProjectModalViewProps = ProjectModalProps & {
  /** True when this isn't the root project → show a "Back" button. */
  canGoBack: boolean;
  /** While true, an overlay spinner is shown (project is changing). */
  loading?: boolean;
  /** Pop the navigation stack (return to the project we came from). */
  onBack(): void;
  /** Push a related project (parent/child) to view it IN this same modal. */
  onNavigate(p: AssistantProject): void;
  /** Open a project selected in the hierarchy above the current drawer. */
  onOpenDrawer(p: AssistantProject): void;
  /** Open the same project editor in create mode under a chosen node. */
  onCreateChild(parent: AssistantProject): void;
  /** Drawers below the active one remain mounted but cannot receive input. */
  covered?: boolean;
  layer?: number;
};
