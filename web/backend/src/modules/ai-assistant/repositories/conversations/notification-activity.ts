// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Executor } from "../../../../shared/executor/index.js";
import { getContextUserId } from "../../../../shared/executor/context.js";
import type { ConversationActivity, ConversationMessage, ConversationMeta } from "./types.js";
import { readMessagesAny } from "./stores.js";

/** Project card notifications describe answers to the human, not the team's
 * internal inbox. Legacy automatic-only threads are worker/mailbox history;
 * automatic continuations after a human request still answer that human. */
export function userNotificationActivity(meta: ConversationMeta, messages: ConversationMessage[]): ConversationActivity {
  const { id, agentId, updatedAt } = meta;
  let audience: "user" | "agent" = "user";
  let requestSeen = false;
  const replies: Array<{ message: ConversationMessage; audience: "user" | "agent" }> = [];
  for (const message of messages) {
    if (message.compacted) continue;
    if (message.role === "user") {
      if (!message.auto) audience = "user";
      else if (message.replyAudience) audience = message.replyAudience;
      else if (!requestSeen) audience = "agent";
      requestSeen = true;
    } else {
      audience = message.replyAudience ?? audience;
      if (message.replyAudience) requestSeen = true;
      replies.push({ message, audience });
    }
  }
  const knownUnread = meta.unreviewed ? Math.max(0, meta.unreadCount ?? 1) : 0;
  const unread = knownUnread ? replies.slice(-knownUnread).filter(reply => reply.audience === "user") : [];
  const last = unread.at(-1)?.message;
  const lastReplyState = last ? last.error || last.interrupted ? "failed"
    : last.ask?.length || last.pending ? "waiting" : "done" : undefined;
  return { id, agentId, updatedAt, unreadCount: unread.length, unreviewed: unread.length > 0,
    // A pending decision remains visible even in an internal worker thread.
    ...(lastReplyState ? { lastReplyState } : meta.lastReplyState === "waiting" ? { lastReplyState: "waiting" } : {}) };
}

type Entry = { version: string; expires: number; value: Promise<ConversationActivity> };
const cache = new Map<string, Entry>();
const MAX_ENTRIES = 1000;

/** Two readers at most per projection; unchanged polls reuse counts, never
 * transcript bodies. Scope includes both target and principal. Failed reads
 * propagate as unavailable and are retried, never converted to unread zero. */
export async function notificationActivity(executor: Executor | null | undefined, metas: ConversationMeta[]): Promise<ConversationActivity[]> {
  const scope = [executor?.target?.id ?? "local", getContextUserId() ?? "shared"];
  const result: ConversationActivity[] = new Array(metas.length);
  let cursor = 0;
  const read = async () => {
    while (cursor < metas.length) {
      const index = cursor++, meta = metas[index]!;
      if (!meta.unreviewed || meta.unreadCount === 0) {
        result[index] = userNotificationActivity(meta, []);
        continue;
      }
      const key = JSON.stringify([...scope, meta.id]);
      const version = JSON.stringify([meta.updatedAt, meta.messageCount, meta.unreadCount, meta.unreviewed, meta.lastReplyState, meta.agentId]);
      let entry = cache.get(key);
      if (!entry || entry.version !== version || entry.expires <= Date.now()) {
        entry = { version, expires: Date.now() + 60_000,
          value: readMessagesAny(executor, String(meta.id)).then(messages => userNotificationActivity(meta, messages)) };
        cache.set(key, entry);
        // A failed read must not poison subsequent polling.
        void entry.value.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
      }
      cache.delete(key); cache.set(key, entry);
      while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
      result[index] = await entry.value;
    }
  };
  await Promise.all([read(), read()]);
  return result;
}
