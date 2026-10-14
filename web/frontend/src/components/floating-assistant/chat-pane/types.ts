// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Local types shared across the ChatPane decomposition (`./chat-pane/*`).
 * Extracted verbatim from the original `ChatPane.tsx` so the split pieces keep
 * the exact same shapes.
 */
import type { ChatTurn } from "../chat-engine";
import type { AssistantAgent } from "../assistant-api";

export type ModifiedFileKind = "modified" | "deleted";
export interface ModifiedFileEntry {
  path: string;
  kind: ModifiedFileKind;
}

export type ProjectTreeRowProps = {
  activeId: string | null;
  agentById: Map<string, AssistantAgent>;
  projectTitleById: Map<string, string>;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
};

export type ToolTraceLite = ChatTurn["tools"][number];
