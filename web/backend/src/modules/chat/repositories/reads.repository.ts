// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Read-cursor repository — tracks the last time each user read each
 * conversation, so the bell badge and the per-conversation unread dot can be
 * computed without scanning message bodies.
 *
 *   ${LUXIPANEL_CONFIG_DIR}/chat/reads.json   (id = `${convId}__${username}`)
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ChatReadState } from "../models/chat.model.js";

const MODULE = "chat";
const COLLECTION = "reads";

function store(executor?: Executor | null) {
  return dataStore<ChatReadState>(executor, MODULE, COLLECTION, {
    idStrategy: "uuid",
    timestamps: false,
  });
}

function keyFor(convId: string, username: string): string {
  return `${convId}__${username}`;
}

export const readsRepository = {
  async list(executor?: Executor | null): Promise<ChatReadState[]> {
    return store(executor).list();
  },

  /** Map of convId → lastReadAt for one user (cheap lookup for list/badge). */
  async cursorsForUser(
    executor: Executor | null | undefined,
    username: string,
  ): Promise<Map<string, string>> {
    const all = await store(executor).list();
    const map = new Map<string, string>();
    for (const r of all) if (r.username === username) map.set(r.convId, r.lastReadAt);
    return map;
  },

  async markRead(
    executor: Executor,
    convId: string,
    username: string,
    at: string,
  ): Promise<void> {
    const id = keyFor(convId, username);
    const existing = await store(executor).get(id);
    if (existing) {
      await store(executor).update(id, { lastReadAt: at });
    } else {
      await store(executor).create({ id, convId, username, lastReadAt: at });
    }
  },
};
