// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Chat profiles repository — per-user presence opt-out + status line.
 *
 * PER CONNECTED SERVER like everything else in this module: rows live in
 * `${LUXIPANEL_CONFIG_DIR}/chat/profiles.json` on the bridged server and the
 * doc id IS the Linux username (there is no panel-side numeric id here — the
 * chat directory is `getent passwd`, so usernames are the natural key).
 *
 * Every read is FAIL-OPEN: a missing/unreadable sidecar must degrade to
 * "no profile" (visible presence, no status), never break the directory.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { ChatProfile } from "../models/chat.model.js";

const log = createModuleLogger("chat-profiles");

const MODULE = "chat";
const COLLECTION = "profiles";

const STATUS_MAX = 80;

function store(executor: Executor | null | undefined) {
  return dataStore<ChatProfile>(executor, MODULE, COLLECTION, {
    idStrategy: "uuid",
    timestamps: false,
  });
}

/** Contract defaults for a user that never touched their profile. */
export function defaultProfile(username: string): ChatProfile {
  return { username, showOnline: true, statusMessage: null, updatedAt: "" };
}

export const profilesRepository = {
  /** The stored profile, or the defaults when there is none. Never throws. */
  async get(executor: Executor, username: string): Promise<ChatProfile> {
    try {
      const row = (await store(executor).get(username)) as ChatProfile | null;
      if (!row) return defaultProfile(username);
      return {
        username,
        showOnline: row.showOnline !== false,
        statusMessage: typeof row.statusMessage === "string" ? row.statusMessage : null,
        updatedAt: row.updatedAt ?? "",
      };
    } catch (err) {
      log.warn({ err, username }, "profiles.get failed — using defaults");
      return defaultProfile(username);
    }
  },

  /** Merge-write the caller's own profile. Returns the resulting profile. */
  async upsert(
    executor: Executor,
    username: string,
    patch: { showOnline?: boolean; statusMessage?: string | null },
  ): Promise<ChatProfile> {
    const current = await this.get(executor, username);
    const next: ChatProfile = {
      username,
      showOnline: patch.showOnline !== undefined ? patch.showOnline : current.showOnline,
      statusMessage:
        patch.statusMessage !== undefined
          ? patch.statusMessage === null
            ? null
            : patch.statusMessage.slice(0, STATUS_MAX)
          : current.statusMessage,
      updatedAt: new Date().toISOString(),
    };
    await store(executor).set(username, next);
    return next;
  },

  /** Every stored profile, keyed by username. Fail-open to an empty map. */
  async listAll(executor: Executor): Promise<Map<string, ChatProfile>> {
    try {
      const rows = await store(executor).list();
      const map = new Map<string, ChatProfile>();
      for (const row of rows) {
        const username = row.username ?? String(row.id ?? "");
        if (!username) continue;
        map.set(username, {
          username,
          showOnline: row.showOnline !== false,
          statusMessage: typeof row.statusMessage === "string" ? row.statusMessage : null,
          updatedAt: row.updatedAt ?? "",
        });
      }
      return map;
    } catch (err) {
      log.warn({ err }, "profiles.listAll failed — presence opt-outs ignored");
      return new Map();
    }
  },

  /** Usernames that opted out of presence (`showOnline: false`). */
  async hiddenPresence(executor: Executor): Promise<Set<string>> {
    const all = await this.listAll(executor);
    const hidden = new Set<string>();
    for (const [username, profile] of all) {
      if (!profile.showOnline) hidden.add(username);
    }
    return hidden;
  },
};
