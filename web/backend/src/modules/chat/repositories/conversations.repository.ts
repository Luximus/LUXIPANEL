// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Conversations repository — file-backed via dataStore.
 *
 * Layout on the connected server:
 *   ${LUXIPANEL_CONFIG_DIR}/chat/conversations.json
 *
 * One row per conversation (dm / ad-hoc group / linux-group). Messages live in
 * a separate per-conversation collection (see messages.repository.ts) so a busy
 * room never bloats this index.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ChatConversation } from "../models/chat.model.js";

const MODULE = "chat";
const COLLECTION = "conversations";

function store(executor?: Executor | null) {
  return dataStore<ChatConversation>(executor, MODULE, COLLECTION, {
    idStrategy: "uuid",
    timestamps: false,
  });
}

export const conversationsRepository = {
  async get(executor: Executor | null | undefined, id: string): Promise<ChatConversation | null> {
    return (await store(executor).get(id)) as ChatConversation | null;
  },

  async list(executor?: Executor | null): Promise<ChatConversation[]> {
    return store(executor).list();
  },

  /** Conversations the given username participates in (by stored membership). */
  async listForUser(executor: Executor | null | undefined, username: string): Promise<ChatConversation[]> {
    const all = await store(executor).list();
    return all.filter((c) => Array.isArray(c.members) && c.members.includes(username));
  },

  /** Create with a caller-supplied id (deterministic for dm/linux-group). */
  async create(executor: Executor, conv: ChatConversation): Promise<ChatConversation> {
    return (await store(executor).create(conv)) as ChatConversation;
  },

  async update(
    executor: Executor,
    id: string,
    patch: Partial<ChatConversation>,
  ): Promise<ChatConversation | null> {
    return (await store(executor).update(id, patch)) as ChatConversation | null;
  },

  async delete(executor: Executor, id: string): Promise<boolean> {
    return store(executor).delete(id);
  },
};
