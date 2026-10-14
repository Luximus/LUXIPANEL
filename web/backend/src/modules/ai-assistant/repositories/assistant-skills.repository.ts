// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Persists which assistant skills/methods are enabled (and their option
 * values) on this target.
 * Sidecar:  ${LUXIPANEL_CONFIG_DIR}/assistant/skills.json (kv collection).
 */

import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type {
  AssistantSkillState,
  AssistantSkillsMap,
} from "../models/assistant-skills.types.js";

const MODULE = "assistant";
const COLLECTION = "skills";
const DOC_ID = "current";

function store(executor?: Executor | null) {
  return kv(executor).module(MODULE).collection<AssistantSkillsMap>(COLLECTION);
}

export const assistantSkillsRepository = {
  async load(executor?: Executor | null): Promise<AssistantSkillsMap> {
    const doc = await store(executor).get(DOC_ID);
    return doc ?? {};
  },

  async save(
    map: AssistantSkillsMap,
    executor?: Executor | null,
  ): Promise<AssistantSkillsMap> {
    await store(executor).set(DOC_ID, map);
    return map;
  },

  async setSkill(
    id: string,
    state: AssistantSkillState,
    executor?: Executor | null,
  ): Promise<AssistantSkillsMap> {
    const current = await this.load(executor);
    const next: AssistantSkillsMap = {
      ...current,
      [id]: {
        ...(current[id] ?? {}),
        ...state,
        options: { ...(current[id]?.options ?? {}), ...(state.options ?? {}) },
      },
    };
    await store(executor).set(DOC_ID, next);
    return next;
  },
};
