// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantProject } from "./assistant-api";

export type WorkspaceState = {
  provider: string | null;
  mode: "api" | "cli" | null;
  project: AssistantProject | null;
};

let state: WorkspaceState = { provider: null, mode: null, project: null };
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

export const workspaceState = {
  getSnapshot: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  setContext(provider: string, mode: "api" | "cli", project: AssistantProject | null) {
    if (state.provider === provider && state.mode === mode && state.project === project) return;
    state = { provider, mode, project };
    emit();
  },
};
