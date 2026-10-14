// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap } from "@/lib/api-client";
import type { AssistantProviderId } from "./providers";
import type { AvatarConfig, AssistantAgent } from "./agents";

// ── Team templates ("Grupos rápidos de agentes") ──
// Curated blueprints of full agent hierarchies (CEO + specialists) the user
// can materialise with one click. The backend seed is the source of truth;
// the wizard on the frontend only edits overrides before applying.

export type TeamTemplateCategory =
  | "web"
  | "app"
  | "desktop"
  | "backend"
  | "automatizaciones"
  | "bots-ia"
  | "devops"
  | "librerias"
  | "iot"
  | "videojuegos";

export interface TeamTemplateTag {
  id: string;
  label: string;
  hint?: string;
}

export interface TeamTemplateCategoryDef {
  id: TeamTemplateCategory;
  label: string;
  icon: string;
  color: string;
  tags: TeamTemplateTag[];
}

export interface TeamTemplateSlotSummary {
  slotId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  avatarConfig?: AvatarConfig;
  parentSlotId: string | null;
  connectionSlotIds?: string[];
  agentMode?: "single" | "multi";
  multiAgentCount?: number;
}

export interface TeamTemplateSlotTranslation {
  name: string;
  description: string;
  systemPrompt: string;
}

export interface TeamTemplateTranslation {
  name: string;
  description: string;
  /** Slot translations keyed by `slotId`. Missing slot ids fall back to Spanish. */
  slots: Record<string, TeamTemplateSlotTranslation>;
}

/** Mirrors `TeamTemplateLocale` in the backend model. */
export type TeamTemplateLocale =
  | "es"
  | "en"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "ar"
  | "bn"
  | "hi"
  | "ja"
  | "ko"
  | "ru";

export interface TeamTemplateSummary {
  id: string;
  category: TeamTemplateCategory;
  tags: string[];
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultProvider?: AssistantProviderId;
  defaultModel?: string;
  recommendMultiAgent?: boolean;
  slotCount: number;
  slots: TeamTemplateSlotSummary[];
  /**
   * Per-locale translations of name/description and (for `get(id)`) every
   * slot's name/description/systemPrompt. Spanish MAY be omitted — the seed
   * fields are the canonical Spanish.
   */
  translations?: Partial<Record<TeamTemplateLocale, TeamTemplateTranslation>>;
}

export interface TeamTemplateSlot extends TeamTemplateSlotSummary {
  /** Full system prompt — only returned by `get(id)`. */
  systemPrompt: string;
  allowedTools: string[] | null;
  canSpawnChats?: boolean;
}

export interface TeamTemplate extends Omit<TeamTemplateSummary, "slots"> {
  slots: TeamTemplateSlot[];
  defaultProjectPaths?: string[];
}

export interface ApplySlotOverrides {
  name?: string;
  description?: string;
  systemPrompt?: string;
  providerId?: AssistantProviderId;
  model?: string;
  allowedTools?: string[] | null;
  icon?: string;
  color?: string;
  avatarConfig?: AvatarConfig;
  projectPaths?: string[];
  agentMode?: "single" | "multi";
  multiAgentCount?: number;
  realtime?: boolean;
}

export interface ApplyDefaults {
  providerId?: AssistantProviderId;
  model?: string;
  projectPaths?: string[];
}

export interface ApplyRequest {
  slotOverrides?: Record<string, ApplySlotOverrides>;
  defaults?: ApplyDefaults;
  rootCanSpawnChats?: boolean;
  namePrefix?: string;
}

export interface ApplyResult {
  agents: AssistantAgent[];
  createdIds: string[];
}

export const assistantTeamTemplatesApi = {
  async list(): Promise<{ categories: TeamTemplateCategoryDef[]; templates: TeamTemplateSummary[] }> {
    const res = await api.get<{
      ok: boolean;
      categories: TeamTemplateCategoryDef[];
      templates: TeamTemplateSummary[];
    }>("/api/ai/team-templates");
    const data = unwrap(res, "Failed to load team templates");
    return { categories: data.categories, templates: data.templates };
  },
  async get(id: string): Promise<TeamTemplate> {
    const res = await api.get<{ ok: boolean; template: TeamTemplate }>(`/api/ai/team-templates/${id}`);
    return unwrap(res, "Failed to load team template").template;
  },
  async apply(id: string, body: ApplyRequest): Promise<ApplyResult> {
    const res = await api.post<{ ok: boolean; agents: AssistantAgent[]; createdIds: string[] }>(
      `/api/ai/team-templates/${id}/apply`,
      body,
    );
    const data = unwrap(res, "Failed to apply team template");
    return { agents: data.agents, createdIds: data.createdIds };
  },

  /** Compare a materialised team (rooted at `rootAgentId`) against its template:
   *  which slots are missing, which are covered, and which agents were added by
   *  hand. `markersMissing` = the team lost its provenance markers. */
  async resync(id: string, rootAgentId: string): Promise<TeamTemplateResyncResult> {
    const res = await api.post<{ ok: boolean } & TeamTemplateResyncResult>(
      `/api/ai/team-templates/${id}/resync`,
      { rootAgentId },
    );
    return unwrap(res, "Failed to resync team template");
  },

  /** Create the selected missing slots under the existing team root. */
  async applyMissing(id: string, rootAgentId: string, slotIds: string[]): Promise<ApplyResult> {
    const res = await api.post<{ ok: boolean; agents: AssistantAgent[]; createdIds: string[] }>(
      `/api/ai/team-templates/${id}/apply-missing`,
      { rootAgentId, slotIds },
    );
    const data = unwrap(res, "Failed to apply missing slots");
    return { agents: data.agents, createdIds: data.createdIds };
  },

  /** Aggregated task-feedback stats of the teams created from a template. */
  async feedbackStats(id: string): Promise<TeamTemplateFeedbackStats | null> {
    const res = await api.get<{ ok: boolean; stats: TeamTemplateFeedbackStats }>(
      `/api/ai/team-templates/${id}/feedback-stats`,
    );
    if (!res.ok || !res.data) return null;
    return res.data.stats ?? null;
  },
};

export interface TeamTemplateResyncResult {
  markersMissing: boolean;
  missing: Array<{ slotId: string; name: string; description: string }>;
  present: Array<{ slotId: string; agentId: string; name: string }>;
  extra: Array<{ agentId: string; name: string }>;
}

export interface TeamTemplateFeedbackStats {
  total: number;
  up: number;
  /** 0..1 share of positive ratings. */
  ratio: number;
  byNode?: Record<string, { total: number; up: number }>;
}
