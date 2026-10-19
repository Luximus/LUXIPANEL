// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap } from "@/lib/api-client";
import type { StructureProviderId } from "./projects";
import type { AssistantProviderId } from "./providers";

// ── Project provider structure (CLAUDE.md, .claude/, AGENTS.md, GEMINI.md…) ──

export interface StructureNodeStatus {
  rel: string;
  type: "file" | "dir";
  description: string;
  core: boolean;
  present: boolean;
  editable: boolean;
}

export interface ProjectStructure {
  provider: StructureProviderId;
  label: string;
  rootDoc: string;
  hint: string;
  path: string;
  nodes: StructureNodeStatus[];
}

export interface ProjectContextDocument {
  rel: string;
  content: string;
  revision: string;
  needsMigration: boolean;
  path: string;
  provider: StructureProviderId;
}

export const assistantProjectStructureApi = {
  async readContext(projectId: string): Promise<ProjectContextDocument> {
    const res = await api.get<{ ok: boolean; document: ProjectContextDocument }>(`/api/ai/projects/${projectId}/context-document`);
    return unwrap(res, "Failed to read project context").document;
  },
  async saveContext(projectId: string, content: string, revision: string): Promise<ProjectContextDocument> {
    const res = await api.put<{ ok: boolean; document: ProjectContextDocument }>(`/api/ai/projects/${projectId}/context-document`, { content, revision });
    return unwrap(res, "Failed to save project context").document;
  },
  async scan(projectId: string): Promise<ProjectStructure> {
    const res = await api.get<{ ok: boolean; structure: ProjectStructure }>(`/api/ai/projects/${projectId}/structure`);
    return unwrap(res, "Failed to scan structure").structure;
  },
  async scaffold(projectId: string, rels: string[]): Promise<{ created: string[]; skipped: string[] }> {
    const res = await api.post<{ ok: boolean; created: string[]; skipped: string[] }>(
      `/api/ai/projects/${projectId}/structure/scaffold`,
      { rels },
    );
    const data = unwrap(res, "Failed to scaffold structure");
    return { created: data.created, skipped: data.skipped };
  },
  async readFile(projectId: string, rel: string): Promise<string> {
    const res = await api.get<{ ok: boolean; content: string }>(
      `/api/ai/projects/${projectId}/structure/file?rel=${encodeURIComponent(rel)}`,
    );
    return unwrap(res, "Failed to read file").content;
  },
  async writeFile(projectId: string, rel: string, content: string): Promise<void> {
    const res = await api.put(`/api/ai/projects/${projectId}/structure/file`, { rel, content });
    if (!res.ok) throw new Error(res.error ?? "Failed to write file");
  },
  /** Ask an AI provider to improve the file. Sends the editor's current
   *  (possibly unsaved) `content` and the chosen `providerId`; the backend
   *  gathers project context (root doc + sibling files) and returns the
   *  improved text for review. */
  async improveFile(
    projectId: string,
    rel: string,
    content: string,
    opts?: { providerId?: AssistantProviderId; instruction?: string },
  ): Promise<string> {
    const res = await api.post<{ ok: boolean; improved: string }>(
      `/api/ai/projects/${projectId}/structure/improve`,
      {
        rel,
        content,
        ...(opts?.providerId ? { providerId: opts.providerId } : {}),
        ...(opts?.instruction ? { instruction: opts.instruction } : {}),
      },
    );
    return unwrap(res, "Failed to improve file").improved;
  },
};

/** Curated lucide icon names (PascalCase) offered in the picker. */
export const PROJECT_ICONS = [
  "Folder", "FolderGit2", "Rocket", "Code", "Terminal", "Database",
  "Server", "Cloud", "Globe", "Shield", "Mail", "Bug",
  "Cpu", "Box", "Package", "Wrench", "Settings", "FlaskConical",
  "Book", "FileText", "Briefcase", "Star", "Zap", "Layers",
] as const;
