// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap } from "@/lib/api-client";

// ── Skills / Methods ──────────────────────────────────────────────────────

export interface SkillOption {
  key: string;
  label: string;
  choices: { value: string; label: string }[];
  value: string;
}

export interface AssistantSkill {
  id: string;
  name: string;
  description: string;
  source?: string;
  category: string;
  categoryLabel: string;
  kind: "prompt-block" | "behavior";
  enabled: boolean;
  options: SkillOption[];
}

/** Per-agent / per-project skill override map: skillId → {enabled, options}. */
export type AssistantSkillsMap = Record<string, { enabled?: boolean; options?: Record<string, string> }>;

interface SkillsEnvelope {
  ok: boolean;
  skills: AssistantSkill[];
}

export const skillsApi = {
  async list(): Promise<AssistantSkill[]> {
    const res = await api.get<SkillsEnvelope>("/api/ai/skills");
    return unwrap(res, "Failed to load skills").skills;
  },
  async update(
    id: string,
    patch: { enabled?: boolean; options?: Record<string, string> },
  ): Promise<AssistantSkill[]> {
    const res = await api.put<SkillsEnvelope>(
      `/api/ai/skills/${encodeURIComponent(id)}`,
      patch,
    );
    return unwrap(res, "Failed to update skill").skills;
  },
};
