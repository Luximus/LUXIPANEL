// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Resolves the assistant skills/methods for a target: merges the registry
 * defaults with the per-target stored state, exposes prompt-block injection
 * for enabled prompt skills, and persists toggles/option changes.
 */

import { createModuleLogger } from "../../../shared/logger/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { assistantSkillsRepository } from "../repositories/assistant-skills.repository.js";
import { assistantSkills, getSkill } from "./skills/registry.js";
import { categoryLabel } from "./skills/categories.js";
import type { AssistantSkillsMap } from "../models/assistant-skills.types.js";
import type {
  AssistantSkillKind,
  SkillPromptContext,
} from "./skills/skill.types.js";

const log = createModuleLogger("assistant-skills");

export interface ResolvedSkillOption {
  key: string;
  label: string;
  choices: { value: string; label: string }[];
  value: string;
}

export interface ResolvedSkill {
  id: string;
  name: string;
  description: string;
  source?: string;
  category: string;
  categoryLabel: string;
  kind: AssistantSkillKind;
  enabled: boolean;
  options: ResolvedSkillOption[];
}

export interface ResolvedSkills {
  list: ResolvedSkill[];
  isEnabled(id: string): boolean;
  optionOf(id: string, key: string): string | undefined;
  promptBlocks(ctx: SkillPromptContext): string;
}

/**
 * Pure (no I/O) resolver: turn a skills MAP (registry defaults overlaid with the
 * given per-target/per-agent/per-project state) into a {@link ResolvedSkills}.
 * Shared by `resolve` (per-target stored map) and `resolveFromMap` (an explicit
 * map, e.g. a per-agent/project override layered over the global one).
 */
function buildResolvedSkills(stored: AssistantSkillsMap): ResolvedSkills {
  const list: ResolvedSkill[] = assistantSkills.map((skill) => {
    const state = stored[skill.id];
    const enabled = state?.enabled ?? skill.defaultEnabled;
    const options: ResolvedSkillOption[] = (skill.options ?? []).map((opt) => ({
      key: opt.key,
      label: opt.label,
      choices: opt.choices.map((c) => ({ value: c.value, label: c.label })),
      value: state?.options?.[opt.key] ?? opt.default,
    }));
    const resolved: ResolvedSkill = {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      categoryLabel: categoryLabel(skill.category),
      kind: skill.kind,
      enabled,
      options,
    };
    if (skill.source !== undefined) resolved.source = skill.source;
    return resolved;
  });

  const byId = new Map(list.map((s) => [s.id, s]));
  const isEnabled = (id: string): boolean => byId.get(id)?.enabled ?? false;
  const optionOf = (id: string, key: string): string | undefined =>
    byId.get(id)?.options.find((o) => o.key === key)?.value;

  const promptBlocks = (ctx: SkillPromptContext): string => {
    const blocks: string[] = [];
    for (const skill of assistantSkills) {
      if (skill.kind !== "prompt-block" || !skill.systemPromptBlock) continue;
      if (!isEnabled(skill.id)) continue;
      const state = stored[skill.id] ?? {};
      const optionValues: Record<string, string> = {};
      for (const opt of skill.options ?? []) {
        optionValues[opt.key] = state.options?.[opt.key] ?? opt.default;
      }
      const block = skill.systemPromptBlock({ enabled: true, options: optionValues }, ctx);
      if (block) blocks.push(block);
    }
    return blocks.join("\n\n");
  };

  return { list, isEnabled, optionOf, promptBlocks };
}

export const assistantSkillsService = {
  async resolve(executor?: Executor | null): Promise<ResolvedSkills> {
    return buildResolvedSkills(await assistantSkillsRepository.load(executor));
  },

  /** Resolve from an explicit skills map (no I/O). Used for per-agent/per-project
   *  skill overrides layered over the global per-target map. */
  resolveFromMap(map: AssistantSkillsMap): ResolvedSkills {
    return buildResolvedSkills(map);
  },

  /** Normalize an untrusted skills override map (agent/project field): keep only
   *  KNOWN skill ids, coerce `enabled` to boolean and `options` to string→string. */
  sanitizeMap(input: unknown): AssistantSkillsMap {
    if (!input || typeof input !== "object") return {};
    const out: AssistantSkillsMap = {};
    for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
      if (!getSkill(id) || !raw || typeof raw !== "object") continue;
      const r = raw as { enabled?: unknown; options?: unknown };
      const entry: AssistantSkillsMap[string] = {};
      if (typeof r.enabled === "boolean") entry.enabled = r.enabled;
      if (r.options && typeof r.options === "object") {
        const opts: Record<string, string> = {};
        for (const [k, v] of Object.entries(r.options as Record<string, unknown>)) {
          if (typeof v === "string" && k.length <= 60 && v.length <= 200) opts[k] = v;
        }
        if (Object.keys(opts).length) entry.options = opts;
      }
      out[id] = entry;
      if (Object.keys(out).length >= 200) break;
    }
    return out;
  },

  async list(executor?: Executor | null): Promise<ResolvedSkill[]> {
    return (await this.resolve(executor)).list;
  },

  async setSkill(
    id: string,
    patch: { enabled?: boolean; options?: Record<string, string> },
    executor?: Executor | null,
  ): Promise<ResolvedSkill[]> {
    if (!getSkill(id)) {
      throw new ValidationError(`Unknown skill "${id}"`, [
        { field: "id", message: "Unknown skill" },
      ]);
    }
    await assistantSkillsRepository.setSkill(id, patch, executor);
    log.debug({ id, patch }, "skill updated");
    return this.list(executor);
  },
};
