// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-user file-manager preferences (#25) — client vs developer mode.
 *
 * UX guardrail only: "client" mode hides advanced/destructive controls in the
 * UI to stop non-technical users from breaking sites. The AUTHORITATIVE access
 * control remains the role/permission system — this does not grant or revoke
 * any capability, it just declutters the interface. Stored per-user in the
 * per-server sidecar (`files/prefs.json`, keyed by user id).
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";

export type FilesMode = "client" | "developer";
export type TreeExpansionMode = "multiple" | "single";

export interface FilesPref {
  id: string; // user id
  mode: FilesMode;
  showHidden?: boolean;
  favoriteRoots?: string[];
  treeExpansionMode?: TreeExpansionMode;
  shortcuts?: Record<string, string>;
  updatedAt?: string;
}

const store = makeKvStore<FilesPref>({ module: "files", collection: "prefs" });

export const filesPrefsService = {
  async get(executor: Executor, userId: string | number): Promise<FilesPref> {
    const id = String(userId);
    const rec = await store(executor).get(id);
    return { id, mode: rec?.mode === "client" ? "client" : "developer", showHidden: rec?.showHidden, favoriteRoots: rec?.favoriteRoots, treeExpansionMode: rec?.treeExpansionMode === "single" ? "single" : "multiple", shortcuts: rec?.shortcuts };
  },

  async patch(executor: Executor, userId: string | number, values: Partial<Omit<FilesPref, "id">>): Promise<FilesPref> {
    const id = String(userId);
    // Merge under the sidecar lock: mode, favorites and shortcuts can be saved
    // by independent UI controls at nearly the same time.
    return store(executor).transaction(async (current) => {
      const previous = current[id];
      const next: FilesPref = {
        id,
        mode: previous?.mode === "client" ? "client" : "developer",
        ...previous,
        ...values,
        updatedAt: new Date().toISOString(),
      };
      return { next: { ...current, [id]: next }, result: next };
    });
  },

  async getMode(executor: Executor, userId: string | number): Promise<FilesMode> {
    return (await this.get(executor, userId)).mode;
  },

  async setMode(executor: Executor, userId: string | number, mode: FilesMode): Promise<FilesMode> {
    const next: FilesMode = mode === "client" ? "client" : "developer";
    await this.patch(executor, userId, { mode: next });
    return next;
  },
};
