// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { notifyModulesChanged } from "../../../shared/module-state/lifecycle.js";
/**
 * Persists which modules and tools the assistant can use on this target.
 * Sidecar:  ${LUXIPANEL_CONFIG_DIR}/assistant/modules.json (kv collection).
 */

import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type {
  ModuleAccessEntry,
  ModuleAccessMap,
  ModuleAccessToolEntry,
} from "../models/assistant-module-access.types.js";

const MODULE = "assistant";
const COLLECTION = "modules";
const DOC_ID = "current";

function store(executor?: Executor | null) {
  return kv(executor).module(MODULE).collection<ModuleAccessMap>(COLLECTION);
}

export const assistantModuleAccessRepository = {
  async load(executor?: Executor | null): Promise<ModuleAccessMap> {
    const doc = await store(executor).get(DOC_ID);
    return doc ?? {};
  },

  async save(map: ModuleAccessMap, executor?: Executor | null): Promise<ModuleAccessMap> {
    await store(executor).set(DOC_ID, map);
    notifyModulesChanged(undefined, executor?.target.id);
    return map;
  },

  async setModule(
    moduleId: string,
    entry: ModuleAccessEntry,
    executor?: Executor | null,
  ): Promise<ModuleAccessMap> {
    const current = await this.load(executor);
    const next: ModuleAccessMap = {
      ...current,
      [moduleId]: {
        ...(current[moduleId] ?? {}),
        ...entry,
        tools: { ...(current[moduleId]?.tools ?? {}), ...(entry.tools ?? {}) },
      },
    };
    await store(executor).set(DOC_ID, next);
    notifyModulesChanged(moduleId, executor?.target.id);
    return next;
  },

  async setTool(
    moduleId: string,
    toolName: string,
    patch: ModuleAccessToolEntry,
    executor?: Executor | null,
  ): Promise<ModuleAccessMap> {
    const current = await this.load(executor);
    const mod = current[moduleId] ?? {};
    const tools = { ...(mod.tools ?? {}) };
    tools[toolName] = { ...(tools[toolName] ?? {}), ...patch };
    const next: ModuleAccessMap = {
      ...current,
      [moduleId]: { ...mod, tools },
    };
    await store(executor).set(DOC_ID, next);
    notifyModulesChanged(moduleId, executor?.target.id);
    return next;
  },
};
