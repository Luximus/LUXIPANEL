// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Contract for an assistant skill (a.k.a. "method"): a togglable behavior or
 * system-prompt block the user can enable per target for the AI assistant.
 */

export interface AssistantSkillOptionChoice {
  value: string;
  label: string;
}

export interface AssistantSkillOption {
  key: string;
  label: string;
  choices: AssistantSkillOptionChoice[];
  default: string;
}

export interface SkillPromptContext {
  cliMode: boolean;
}

export type AssistantSkillKind = "prompt-block" | "behavior";

export interface AssistantSkill {
  id: string;
  name: string; // Spanish, user-facing
  description: string; // Spanish, one line
  source?: string; // e.g. "ponytail · MIT · github.com/DietrichGebert/ponytail"
  /** Group id (see categories.ts). Skills are grouped by this in the UI. */
  category: string;
  kind: AssistantSkillKind;
  defaultEnabled: boolean;
  options?: AssistantSkillOption[];
  /** Only for kind "prompt-block": returns the system-prompt block to inject (Spanish), or "" when it contributes none (e.g. mode off). */
  systemPromptBlock?(
    state: { enabled?: boolean; options?: Record<string, string> },
    ctx: SkillPromptContext,
  ): string;
}
