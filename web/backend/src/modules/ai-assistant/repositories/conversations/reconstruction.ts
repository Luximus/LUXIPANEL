// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Durable recovery for a truncated/corrupt conversations index. The visible
 * list is derived PURELY from the index; any index entry lost to corruption or
 * a partial legacy→per-user migration hides a chat whose transcript still exists
 * on disk. This scans the assistant config dir and mints the missing index
 * entries back from those transcripts (MERGE, never replace; fully fail-open).
 */

import path from "node:path";
import { CONFIG_DIR } from "@config/paths.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import type { Executor } from "../../../../shared/executor/index.js";
import { getContextUserId } from "../../../../shared/executor/context.js";
import { teamTasksRepository } from "../team-tasks.repository.js";
import { DEFAULT_PROVIDER_ID } from "../../models/assistant-config.types.js";
import {
  metaStore,
  sharedMetaStore,
  msgStoreForScope,
  readEmbeddedMeta,
  deriveTitle,
  preview,
} from "./stores.js";
import {
  MSG_DOC_ID,
  type ConversationMeta,
  type ConversationMessage,
  type EmbeddedConversationMeta,
  type StoreScope,
} from "./types.js";

const log = createModuleLogger("assistant-conversations");
const recoveryCursor = new Map<string, string>();

/** Build a `conversationId → agentId` map from the team-task board so a lost
 *  agent chat (leader or worker) can have its `agentId` backfilled even when no
 *  embedded header exists. Fully fail-open. */
async function buildAgentIdMap(
  executor: Executor | null | undefined,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const tasks = await teamTasksRepository.listAll(executor);
    for (const t of tasks) {
      if (t.workerConversationId && t.workerAgentId) map.set(t.workerConversationId, t.workerAgentId);
      if (t.leaderConversationId && t.leaderAgentId && !map.has(t.leaderConversationId)) {
        map.set(t.leaderConversationId, t.leaderAgentId);
      }
    }
  } catch {
    /* board unreadable → no backfill hints, keep recovering the rest */
  }
  return map;
}

/** Derive a full index entry from an existing transcript (title/preview from
 *  the messages, createdAt/updatedAt from the first/last message timestamps).
 *  Used when the index lost the entry but the transcript file survives.
 *
 *  Identity fields (agentId/provider/projectId/title/createdAt) are recovered,
 *  in order of trust, from: the embedded `__meta` header → the team-task board
 *  (`agentIdFallback`) → derivation from the messages. `agentId` is only left
 *  `null` when NEITHER a header nor a matching team task carries one, so an
 *  agent chat is never demoted to a loose chat by a mere index loss. */
export function buildMetaFromMessages(
  id: string,
  msgs: ConversationMessage[],
  embedded?: EmbeddedConversationMeta | null,
  agentIdFallback?: string | null,
): ConversationMeta & { id: string } {
  const display = (m: ConversationMessage) =>
    (m.role === "user" ? m.textOriginal : m.textTranslated) ?? m.content;
  const firstUser = msgs.find((m) => m.role === "user");
  const last = msgs[msgs.length - 1]!;
  const provider = embedded?.provider || DEFAULT_PROVIDER_ID;
  const createdAt = embedded?.createdAt || msgs[0]?.ts || new Date().toISOString();
  const updatedAt = last?.ts || createdAt;
  const title = embedded?.title || deriveTitle(firstUser ? display(firstUser) : "");
  const agentId = embedded?.agentId ?? agentIdFallback ?? null;
  return {
    id,
    title,
    originProvider: embedded?.originProvider || provider,
    provider,
    projectId: embedded?.projectId ?? null,
    model: embedded?.model, effort: embedded?.effort, approvalMode: embedded?.approvalMode, speed: embedded?.speed,
    agentId,
    messageCount: msgs.length,
    preview: preview(display(last)),
    createdAt,
    updatedAt,
  };
}

/**
 * Durable recovery for a truncated/corrupt conversations index. The visible
 * list is derived PURELY from the index (`conversations-u<uid>.json`), so any
 * index entry that is lost — self-heal after "Corrupt kv-store JSON", a partial
 * legacy→per-user migration, or a bad overwrite — hides a chat whose transcript
 * file still exists on disk. This scans the assistant config dir and mints the
 * missing index entries back from those transcripts.
 *
 * Scans (for the CURRENT context user only):
 *   - `conv-u<uid>-<id>.json`  → this user's per-user transcripts
 *   - `conv-<id>.json`         → legacy pre-per-user transcripts (migration in)
 * Other users' `conv-u<other>-*` files are IGNORED — per-user isolation.
 *
 * Contract: MERGE, never replace. Existing index entries are untouched; only
 * ids present on disk (non-empty transcript) but absent from the index are
 * reconstructed, in ONE transactional write. Fully fail-open: any readdir /
 * parse / transcript error skips that id (or the whole pass) and never throws,
 * so the list keeps working even if recovery can't run. Returns entries minted.
 */
export async function reconstructMissingIndex(executor: Executor | null | undefined): Promise<number> {
  if (!executor) return 0;
  const uid = getContextUserId();
  // Reconstruction targets the per-user index. With no user in context the
  // list is the shared/legacy scope and there is no migration to perform.
  if (!uid) return 0;

  const dir = path.posix.join(CONFIG_DIR, "assistant");
  let entries: Array<{ name: string; isDir: boolean }>;
  try {
    entries = await executor.readdir(dir);
  } catch {
    return 0; // dir unreadable → keep current behaviour, never break listing
  }

  const userRe = new RegExp(`^conv-u${uid}-(.+)\\.json$`);
  const legacyRe = /^conv-(.+)\.json$/;
  // id → the store scope its transcript lives in.
  const candidates = new Map<string, StoreScope>();
  for (const e of entries) {
    if (e.isDir) continue;
    const mu = userRe.exec(e.name);
    if (mu) {
      candidates.set(mu[1]!, "user");
      continue;
    }
    const ml = legacyRe.exec(e.name);
    if (ml) {
      const rest = ml[1]!;
      // Never treat ANOTHER user's per-user file (`conv-u<digits>-…`) as a
      // legacy candidate — that would leak one Linux user's chats into another.
      if (/^u\d+-/.test(rest)) continue;
      if (!candidates.has(rest)) candidates.set(rest, "shared");
    }
  }
  if (candidates.size === 0) return 0;

  // Ids already represented in the index (own per-user OR legacy shared meta).
  const [own, legacy] = await Promise.all([
    metaStore(executor).list(),
    sharedMetaStore(executor).list(),
  ]);
  const known = new Set<string>();
  for (const d of own) known.add(String(d.id));
  for (const d of legacy) known.add(String(d.id));

  // Backfill source for `agentId` when a lost chat has no embedded header:
  // the team-task board maps leader/worker conversations to their agent.
  const missing = [...candidates].filter(([id]) => !known.has(id)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  if (missing.length === 0) return 0;
  const agentByConv = await buildAgentIdMap(executor);

  const minted: Array<ConversationMeta & { id: string }> = [];
  // Bound each pass and advance past corrupt/empty transcripts, so they cannot
  // permanently starve later valid entries. The cursor never crosses a user/target.
  const cursorKey = JSON.stringify([executor.target.id, uid]);
  const previous = recoveryCursor.get(cursorKey);
  const next = previous ? missing.findIndex(([id]) => id > previous) : 0;
  const start = next < 0 ? 0 : next;
  const batch = missing.slice(start, start + 20);
  recoveryCursor.set(cursorKey, batch[batch.length - 1]![0]);
  if (recoveryCursor.size > 128) recoveryCursor.delete(recoveryCursor.keys().next().value!);
  for (const [id, scope] of batch) {
    try {
      const doc = await msgStoreForScope(executor, id, scope).get(MSG_DOC_ID);
      const msgs = doc?.messages ?? [];
      if (msgs.length === 0) continue; // empty transcript → not a real chat
      const embedded = await readEmbeddedMeta(executor, id, scope);
      minted.push(buildMetaFromMessages(id, msgs, embedded, agentByConv.get(id) ?? null));
    } catch {
      /* unreadable transcript → skip this id, keep recovering the rest */
    }
  }
  if (minted.length === 0) return 0;

  // Persist every reconstructed entry into the per-user index in ONE write,
  // merging into the current map so a concurrent/valid entry is never clobbered.
  try {
    await metaStore(executor).transaction(async (current) => {
      const next = { ...current } as Record<string, ConversationMeta>;
      for (const m of minted) {
        if (!next[m.id]) {
          const { id: _id, ...rest } = m;
          next[m.id] = rest as ConversationMeta;
        }
      }
      return { next, result: undefined };
    });
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Conversation index reconstruction failed to persist");
    return 0;
  }
  log.info({ count: minted.length, uid }, "Reconstructed missing conversation index entries from transcripts");
  return minted.length;
}

// Per-(target,user) cooldown so `list()` doesn't pay a readdir on every call.
// The steady state (index already complete) mints nothing; a corruption/loss
// event is recovered on the first list after it and persisted, so a short
// cooldown is enough to keep the list self-healing without a hot round-trip.
const RECON_COOLDOWN_MS = 60_000;
const lastRecon = new Map<string, number>();

export async function maybeReconstruct(executor: Executor | null | undefined): Promise<number> {
  if (!executor) return 0;
  const uid = getContextUserId();
  if (!uid) return 0;
  const key = `${executor.target?.id ?? "?"}:${uid}`;
  const now = Date.now();
  if (now - (lastRecon.get(key) ?? 0) < RECON_COOLDOWN_MS) return 0;
  lastRecon.set(key, now);
  try {
    return await reconstructMissingIndex(executor);
  } catch {
    /* fail-open: recovery is best-effort, never block the listing */
    return 0;
  }
}
