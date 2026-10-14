// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** ProjectModal pure helpers — extracted verbatim. */
import { assistantProjectsApi, type AssistantProject } from "../assistant-api";

/** Re-parents a child project, preserving its other fields. */
export function reparentChild(child: AssistantProject, parentId: string | null) {
  return assistantProjectsApi.update(child.id, {
    title: child.title,
    icon: child.icon,
    path: child.path,
    instructions: child.instructions,
    provider: child.provider,
    parentId,
  });
}

/** Returns all ancestor IDs of a project to prevent circular parent assignments. */
export function getAncestorIds(projectId: string, all: AssistantProject[]): Set<string> {
  const ancestors = new Set<string>();
  let cur = all.find((p) => p.id === projectId);
  while (cur?.parentId) {
    ancestors.add(cur.parentId);
    cur = all.find((p) => p.id === cur!.parentId);
  }
  return ancestors;
}
