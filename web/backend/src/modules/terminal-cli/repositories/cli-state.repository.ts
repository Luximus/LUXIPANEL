// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-user CLI state (onboarding + installed/active CLIs), stored as a
 * document in the `terminal-cli` collection. The collection is namespaced by
 * the context user so two Linux users on one server keep separate CLI state.
 */

import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { getContextUserId } from "../../../shared/executor/context.js";
import { DEFAULT_STATE, type TerminalCliState } from "../models/cli-state.model.js";

const MODULE = "terminal-cli";
const COLLECTION = "state";
const DOC_ID = "singleton";

function store(executor?: Executor | null) {
  const uid = getContextUserId();
  const collection = uid ? `${COLLECTION}-u${uid}` : COLLECTION;
  return kv(executor).module(MODULE).collection<TerminalCliState>(collection);
}

export const cliStateRepository = {
  async get(executor?: Executor | null): Promise<TerminalCliState> {
    const current = await store(executor).get(DOC_ID);
    if (!current) return { ...DEFAULT_STATE };
    return {
      onboardingDone: Boolean(current.onboardingDone),
      installed: Array.isArray(current.installed) && current.installed.length > 0
        ? current.installed
        : ["default"],
      active: current.active ?? "default",
      updatedAt: current.updatedAt ?? new Date(0).toISOString(),
    };
  },

  async set(state: TerminalCliState, executor?: Executor | null): Promise<TerminalCliState> {
    const persisted: TerminalCliState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };
    await store(executor).set(DOC_ID, persisted);
    return persisted;
  },
};
