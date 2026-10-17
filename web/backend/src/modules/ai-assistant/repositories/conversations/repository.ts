// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `conversationsRepository` — the public API over the per-target conversation
 * history: list/create/rename/patch/delete plus the paginated message reads and
 * the orphan/index self-heal entry points. Storage namespacing + scope
 * resolution live in ./stores, index reconstruction in ./reconstruction.
 */

import path from "node:path";
import { CONFIG_DIR } from "@config/paths.js";
import type { Executor } from "../../../../shared/executor/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import { normalizeConversationMessages } from "../../services/conversation-message-normalizer.js";
import {
  MSG_DOC_ID,
  META_DOC_ID,
  type ConversationMeta,
  type ConversationMessage,
  type ConversationDoc,
} from "./types.js";
import {
  listMetaDocs,
  metaStore,
  sharedMetaStore,
  msgStore,
  msgStoreForScope,
  storeForScope,
  resolveScope,
  getMetaAny,
  readMessagesAny,
  embeddedMetaStore,
  embeddedFromMeta,
  deriveTitle,
  preview,
  userSuffix,
} from "./stores.js";
import { reconstructMissingIndex, maybeReconstruct } from "./reconstruction.js";
import { foldSearchText, searchConversationMessages, conversationSearchStatus, updateConversationSearch, dropConversationSearch } from "./message-search.js";

import { getContextUserId } from "../../../../shared/executor/context.js";
import { assessContext } from "../../services/context-window.service.js";
import { pageConversations } from "./list-pages.js";

const log = createModuleLogger("assistant-conversations");
// Internal receipt in the same atomic sidecar write as the queued user turn.
// Separate from messages/metadata: never returned by the history API.
const QUEUE_RECEIPT_DOC_ID = "__queue_receipt";

export const conversationsRepository = {
  /**
   * Every conversation id this (server, user) owns — no paging, no self-heal.
   *
   * For membership checks only (e.g. "is this active run one of MINE?"). Callers
   * used to reach for `list({ limit: 1000 })`, which is wrong twice over: `list`
   * CLAMPS the limit to 200, so a run on the 201st-newest chat was silently
   * reported as not-mine, and it also sorted/copied the whole index to then
   * throw the metadata away. This reads the index once and returns the ids.
   */
  async listIds(executor: Executor | null | undefined): Promise<Set<string>> {
    const all = await listMetaDocs(executor);
    const ids = new Set<string>();
    for (const doc of all) {
      const id = String(doc.id ?? "");
      if (id) ids.add(id);
    }
    return ids;
  },

  /** List conversation metadata, newest first, optional text filter. */
  async list(
    executor: Executor | null | undefined,
    opts: {
      q?: string;
      provider?: string;
      projectId?: string | null;
      /** `null` → only chats with NO agent (loose); a string → only that agentId. */
      agentId?: string | null;
      withAgent?: boolean;
      projectIds?: string[];
      agentIds?: string[];
      cursor?: string;
      paged?: boolean;
      includeSummary?: boolean;
      summaryScope?: "filtered";
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ items: ConversationMeta[]; total: number; hasMore?: boolean; nextCursor?: string | null; searchStatus?: { state: string; indexed: number; total: number }; summary?: { projects: Record<string, number>; agents: Record<string, number> } }> {
    // Reconstruction is a readdir + a transcript read per unknown id over the
    // per-server executor (SSH/SFTP). Awaiting it here put that I/O in the
    // critical path of EVERY list — the main contributor to the p95 of
    // GET /api/ai/conversations. It is a self-heal for a corrupt index, not a
    // per-load necessity, so run it in the BACKGROUND and serve the index we
    // already have; the heal lands on a subsequent load. The one case that
    // cannot wait is an index that yields NOTHING — that IS the corruption
    // reconstruction exists for, and there is nothing to show meanwhile — so
    // heal synchronously there and re-list. Cooldown-gated either way.
    let all = await listMetaDocs(executor);
    if (all.length === 0) {
      if ((await maybeReconstruct(executor)) > 0) all = await listMetaDocs(executor);
    } else {
      void maybeReconstruct(executor);
    }
    // Pinned conversations float to the top; within each band, newest first.
    let items = [...all].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || String(a.id).localeCompare(String(b.id));
    });
    if (opts.provider) {
      items = items.filter((c) => c.provider === opts.provider);
    }
    if (opts.withAgent !== undefined) {
      // true → only agent-bound chats (leaders + subordinates); false → the rest
      // (loose + project chats). Powers the conversation-list tabs.
      items = items.filter((c) => !!c.agentId === opts.withAgent);
    }
    if (opts.agentId !== undefined) {
      // `null` → only loose chats (no agent bound); a string → that agent's chats.
      items = items.filter((c) => (c.agentId ?? null) === opts.agentId);
    }
    if (opts.projectId !== undefined) {
      // `null` → only loose chats (no project); a string → that project.
      items = items.filter((c) => (c.projectId ?? null) === opts.projectId);
    }
    if (opts.agentIds) {
      const ids = new Set(opts.agentIds);
      items = items.filter(c => ids.has(c.agentId ?? "none"));
    }
    if (opts.projectIds) {
      const ids = new Set(opts.projectIds);
      items = items.filter(c => ids.has(c.projectId ?? "none"));
    }
    const summary = opts.includeSummary ? { projects: {} as Record<string, number>, agents: {} as Record<string, number> } : undefined;
    const q = foldSearchText((opts.q ?? "").trim().replace(/\s+/g, " ").slice(0, 160));
    if (q) {
      const inMetadata = (c: ConversationMeta) =>
        foldSearchText(c.title).includes(q) || foldSearchText(c.preview).includes(q);
      const transcriptMatches = await searchConversationMessages(executor, items.filter((c) => !inMetadata(c)), q, !!opts.paged);
      items = items
        .filter((c) => inMetadata(c) || transcriptMatches.has(String(c.id)))
        .map((c) => {
          const searchMatch = transcriptMatches.get(String(c.id));
          return searchMatch ? { ...c, searchMatch } : c;
        });
    }
    // Existing clients keep global counts; project teams request counts for
    // the same scope and search as their rows, before pagination.
    if (summary) for (const c of opts.summaryScope === "filtered" ? items : all) {
      const project = c.projectId ?? "none", agent = c.agentId ?? "none";
      summary.projects[project] = (summary.projects[project] ?? 0) + 1;
      summary.agents[agent] = (summary.agents[agent] ?? 0) + 1;
    }
    // Transcript indexing is demand-driven by a non-empty search.
    const searchStatus = q && opts.paged ? conversationSearchStatus(executor, all) : undefined;
    const total = items.length;
    const offset = Number.isFinite(opts.offset) ? Math.max(0, Math.trunc(opts.offset!)) : 0;
    const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.min(200, Math.trunc(opts.limit!))) : 50;
    if (opts.paged || opts.cursor) {
      const scope = JSON.stringify([executor?.target?.id ?? "local", getContextUserId()]);
      const query = JSON.stringify([q, opts.provider, opts.projectId, opts.projectIds, opts.agentId, opts.agentIds, opts.withAgent]);
      return { ...pageConversations(items, scope, query, limit, opts.cursor), ...(searchStatus ? { searchStatus } : {}), ...(summary ? { summary } : {}) };
    }
    return { items: items.slice(offset, offset + limit), total, hasMore: offset + limit < total, ...(summary ? { summary } : {}) };
  },

  async create(
    executor: Executor | null | undefined,
    provider: string,
    firstMessage?: string,
    projectId?: string | null,
    agentId?: string | null,
    choices: Pick<ConversationMeta, "model" | "effort" | "approvalMode"> = {},
  ): Promise<ConversationMeta> {
    const meta = await metaStore(executor).create({
      ...choices,
      title: deriveTitle(firstMessage ?? ""),
      originProvider: provider,
      provider,
      projectId: projectId ?? null,
      agentId: agentId ?? null,
      messageCount: 0,
      preview: firstMessage ? preview(firstMessage) : "",
    });
    await msgStore(executor, String(meta.id)).set(MSG_DOC_ID, { messages: [] });
    // Seed the embedded identity header immediately so the chat's agent binding
    // survives an index loss even before its first message lands. Best-effort:
    // a failure here never blocks conversation creation.
    await embeddedMetaStore(executor, String(meta.id), "user")
      .set(META_DOC_ID, embeddedFromMeta(meta))
      .catch(() => undefined);
    return meta;
  },

  async rename(
    executor: Executor | null | undefined,
    id: string,
    title: string,
  ): Promise<ConversationMeta | null> {
    return metaStore(executor).update(id, { title: title.slice(0, 120) });
  },

  /**
   * Apply a metadata patch from the PATCH endpoint: title (rename) and/or
   * pinned. Both are optional; only the provided fields are written. Returns the
   * updated meta (or current meta when the patch is empty).
   */
  async patchMeta(
    executor: Executor | null | undefined,
    id: string,
    patch: Partial<Pick<ConversationMeta, "title" | "pinned" | "provider" | "model" | "effort" | "approvalMode">>,
  ): Promise<ConversationMeta | null> {
    const update: Partial<ConversationMeta> = {};
    if (patch.title !== undefined) update.title = patch.title.slice(0, 120);
    if (patch.pinned !== undefined) update.pinned = patch.pinned;
    if (patch.provider !== undefined) update.provider = patch.provider;
    if (patch.model !== undefined) update.model = patch.model;
    if (patch.effort !== undefined) update.effort = patch.effort;
    if (patch.approvalMode !== undefined) update.approvalMode = patch.approvalMode;
    const scope = await resolveScope(executor, id);
    const store = storeForScope(executor, scope);
    if (Object.keys(update).length === 0) {
      return store.get(id) as Promise<ConversationMeta | null>;
    }
    // Rename/pin are edits, not new activity → keep updatedAt (ordering) put.
    const updated = await store.update(id, update, { touch: false });
    if (updated) await embeddedMetaStore(executor, id, scope).set(META_DOC_ID, embeddedFromMeta(updated));
    return updated;
  },

  /**
   * Per-turn routing fields: the conversation stays global, but we remember the
   * latest provider/project/agent used to continue it.
   */
  async patchRuntime(
    executor: Executor | null | undefined,
    id: string,
    patch: { provider?: string; projectId?: string | null; agentId?: string | null; panelOrigin?: string },
  ): Promise<ConversationMeta | null> {
    const scope = await resolveScope(executor, id);
    const store = storeForScope(executor, scope);
    const update: Partial<ConversationMeta> = {};
    // A queued run may use an older provider snapshot. Explicit composer
    // choices stay authoritative even when that background turn starts later.
    const existing = await store.get(id);
    if (patch.provider !== undefined && existing?.approvalMode === undefined) update.provider = patch.provider;
    if (patch.agentId !== undefined) update.agentId = patch.agentId;
    if (patch.panelOrigin) update.panelOrigin = patch.panelOrigin;
    if (patch.projectId !== undefined) {
      if (patch.projectId === null) {
        // A continue-turn that arrives with a NULL project must NOT silently
        // un-project an existing chat. The project is fixed at creation and
        // there is no UI to move a chat to "loose", so a null here means the
        // caller lost the chat's project (e.g. it was opened from the Dashboard
        // while the conversation list was scoped to another project, so the
        // client couldn't resolve `activeMeta.projectId`). Only honor null when
        // the chat genuinely had no project to begin with.
        const existing = await store.get(id);
        if (!existing?.projectId) update.projectId = null;
      } else {
        update.projectId = patch.projectId;
      }
    }
    if (Object.keys(update).length === 0) return getMetaAny(executor, id);
    const saved = await store.update(id, update, { touch: false });
    if (saved) await embeddedMetaStore(executor, id, scope).set(META_DOC_ID, embeddedFromMeta(saved));
    return saved;
  },

  /** Explicit project deletion/move, unlike patchRuntime's turn-safety guard. */
  async moveToLoose(executor: Executor | null | undefined, id: string): Promise<ConversationMeta | null> {
    const scope = await resolveScope(executor, id);
    return storeForScope(executor, scope).update(id, { projectId: null }, { touch: false });
  },

  /** Read a single conversation's metadata (for translation state lookups). */
  async getMeta(
    executor: Executor | null | undefined,
    id: string,
  ): Promise<ConversationMeta | null> {
    return getMetaAny(executor, id);
  },

  /**
   * Like {@link getMeta} but self-heals an ORPHAN conversation: one whose meta
   * doc is gone (or never landed) yet still holds a message doc — so it shows in
   * the sidebar (the list mints metas) but `getMeta` returns null. Without this,
   * opening such a chat would 404 on the meta fetch and the client would purge it
   * as "dead" even though it has messages and is perfectly openable. Mints +
   * persists a minimal LOOSE meta from the transcript and returns it. Returns
   * null ONLY when there is truly no content (no meta AND no messages).
   */
  async getMetaOrReconcile(
    executor: Executor | null | undefined,
    id: string,
  ): Promise<ConversationMeta | null> {
    const existing = await getMetaAny(executor, id);
    if (existing) return existing;
    // No meta — is this an orphan (has messages) or genuinely gone?
    const scope = await resolveScope(executor, id);
    const doc = await msgStoreForScope(executor, id, scope).get(MSG_DOC_ID);
    const msgs = doc?.messages ?? [];
    if (msgs.length === 0) return null; // truly gone → caller 404s
    const display = (m: ConversationMessage) =>
      (m.role === "user" ? m.textOriginal : m.textTranslated) ?? m.content;
    const firstUser = msgs.find((m) => m.role === "user");
    const last = msgs[msgs.length - 1]!;
    const provider = "claude";
    const minted = {
      id,
      title: deriveTitle(firstUser ? display(firstUser) : ""),
      originProvider: provider,
      provider,
      projectId: null,
      agentId: null,
      messageCount: msgs.length,
      preview: preview(display(last)),
    };
    // Persist so the next read is a plain hit (and the list/meta stay consistent).
    await storeForScope(executor, scope).set(id, minted).catch(() => undefined);
    return (await getMetaAny(executor, id)) ?? (minted as unknown as ConversationMeta);
  },

  /**
   * Self-heal "orphan" conversations so NONE are omitted from the list. A chat
   * is an orphan when it has persisted content (a message doc and/or an upstream
   * CLI/terminal session) but lost its metadata entry — so it never surfaced in
   * the sidebar. For each candidate id missing a meta but holding messages, mint
   * a minimal LOOSE meta derived from its transcript (so it appears, openable).
   *
   * `candidateIds` are conversation ids known from OTHER sidecars (e.g. the
   * CLI/terminal session map) — the only way to discover ids whose meta is gone.
   * Best-effort and fully fail-open: a bad id is skipped, never thrown.
   */
  async reconcileOrphans(
    executor: Executor | null | undefined,
    candidateIds: string[],
    providerHint?: (id: string) => string | undefined,
  ): Promise<number> {
    const ids = [...new Set(candidateIds.map((x) => String(x)))].filter(Boolean);
    if (ids.length === 0) return 0;
    const store = metaStore(executor);

    // Read BOTH indexes ONCE and compare in memory. This used to `get(id)` per
    // candidate against each index — an N+1 over SSH where every miss also cost
    // an extra `sudo cat` — so a box with a few dozen CLI sessions paid dozens
    // of round-trips just to discover it had no orphans at all (the steady state).
    const [own, legacy] = await Promise.all([store.list(), sharedMetaStore(executor).list()]);
    const known = new Set<string>();
    for (const d of own) known.add(String(d.id));
    for (const d of legacy) known.add(String(d.id));

    const missing = ids.filter((id) => !known.has(id));
    if (missing.length === 0) return 0; // steady state: zero further I/O

    const minted: Array<ConversationMeta & { id: string }> = [];
    for (const id of missing) {
      try {
        const doc = await msgStore(executor, id).get(MSG_DOC_ID);
        const msgs = doc?.messages ?? [];
        if (msgs.length === 0) continue;
        const display = (m: ConversationMessage) =>
          (m.role === "user" ? m.textOriginal : m.textTranslated) ?? m.content;
        const firstUser = msgs.find((m) => m.role === "user");
        const last = msgs[msgs.length - 1]!;
        const provider = providerHint?.(id) || "claude";
        minted.push({
          id,
          title: deriveTitle(firstUser ? display(firstUser) : ""),
          originProvider: provider,
          provider,
          projectId: null,
          agentId: null,
          messageCount: msgs.length,
          preview: preview(display(last)),
        });
      } catch {
        /* skip this id — never break the listing */
      }
    }
    if (minted.length === 0) return 0;

    // One transactional write instead of a `set()` (= one SFTP write) per orphan,
    // merging so a concurrent/valid entry is never clobbered.
    try {
      await store.transaction(async (current) => {
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
      log.warn({ err: (err as Error).message }, "Orphan reconcile failed to persist");
      return 0;
    }
    return minted.length;
  },

  /**
   * Set the background-translation state for a conversation. Pass `lang` to pin
   * the detected language, `translate` to override the global default
   * (`null` clears the override → follow global default again).
   */
  async setTranslation(
    executor: Executor | null | undefined,
    id: string,
    patch: { lang?: string; translate?: boolean | null },
  ): Promise<ConversationMeta | null> {
    const update: Partial<ConversationMeta> = {};
    if (patch.lang !== undefined) update.lang = patch.lang;
    if (patch.translate !== undefined) update.translate = patch.translate ?? undefined;
    if (Object.keys(update).length === 0) return getMetaAny(executor, id);
    // Translation-state toggles are housekeeping → don't bump updatedAt.
    const scope = await resolveScope(executor, id);
    return storeForScope(executor, scope).update(id, update, { touch: false });
  },

  async delete(executor: Executor | null | undefined, id: string): Promise<boolean> {
    dropConversationSearch(executor, id);
    const scope = await resolveScope(executor, id);
    await msgStoreForScope(executor, id, scope).delete(MSG_DOC_ID).catch(() => false);
    const removed = await storeForScope(executor, scope).delete(id);
    // Remove the transcript sidecar itself; leaving an empty `{}` file behind
    // pollutes the config dir and the index-reconstruction candidate scan.
    // Best-effort: executors without `unlink` keep the legacy `{}` residue.
    const file =
      scope === "shared" ? `conv-${id}.json` : `conv${userSuffix()}-${id}.json`;
    try {
      await executor?.unlink?.(path.posix.join(CONFIG_DIR, "assistant", file));
    } catch {
      /* residue file is harmless — reconstruction skips empty transcripts */
    }
    return removed;
  },

  /** Delete every conversation (meta + message docs). Returns count removed. */
  async clearAll(executor: Executor | null | undefined): Promise<number> {
    const all = await listMetaDocs(executor);
    for (const c of all) {
      if (c.id) await this.delete(executor, String(c.id)).catch(() => false);
    }
    return all.length;
  },

  /**
   * Append one or more messages to a conversation and bump its metadata.
   * Returns the updated meta.
   */
  async appendMessages(
    executor: Executor | null | undefined,
    id: string,
    messages: ConversationMessage[],
    opts: { unreviewed?: boolean; queueTurnId?: string } = {},
  ): Promise<ConversationMeta | null> {
    if (messages.length === 0) return getMetaAny(executor, id);
    const scope = await resolveScope(executor, id);
    const store = msgStoreForScope(executor, id, scope);
    const existingMeta = await storeForScope(executor, scope).get(id);
    const normalizedBatch = normalizeConversationMessages(messages).messages;

    // Prefer the user-facing variant so previews/titles show the user's own
    // language, not the English canonical `content` used for agent context.
    const display = (m: ConversationMessage) =>
      (m.role === "user" ? m.textOriginal : m.textTranslated) ?? m.content;
    let last = normalizedBatch[normalizedBatch.length - 1]!;
    // Resolve the title BEFORE writing so the embedded header never persists the
    // placeholder "Nueva conversación" (which would beat message-derivation on
    // reconstruction). Once a real title exists it is preserved verbatim.
    const hasGoodTitle = !!existingMeta?.title && existingMeta.title !== "Nueva conversación";
    const firstUserInBatch = normalizedBatch.find((m) => m.role === "user");
    const effectiveTitle = hasGoodTitle
      ? existingMeta!.title
      : firstUserInBatch
        ? deriveTitle(display(firstUserInBatch))
        : existingMeta?.title ?? "Nueva conversación";

    // ONE conv-file write: append the batch AND keep the embedded `__meta`
    // header in sync with the index identity. Piggybacking on the per-turn
    // messages write costs zero extra SSH round-trips; the header lets a later
    // index loss be reconstructed WITHOUT dropping the chat's agent binding.
    let nextLen = 0;
    let indexedMessages: ConversationMessage[] = [];
    await store.transaction(async (current) => {
      const curMap = current as Record<string, ConversationDoc & Record<string, unknown>>;
      const prev = (curMap[MSG_DOC_ID]?.messages ?? []) as ConversationMessage[];
      const alreadySaved = opts.queueTurnId !== undefined &&
        curMap[QUEUE_RECEIPT_DOC_ID]?.["queueTurnId"] === opts.queueTurnId;
      const nextMessages = alreadySaved ? prev : [...prev, ...normalizedBatch];
      last = nextMessages.at(-1) ?? last;
      nextLen = nextMessages.length;
      indexedMessages = nextMessages;
      const next = { ...curMap, [MSG_DOC_ID]: { messages: nextMessages } } as Record<
        string,
        ConversationDoc
      >;
      if (opts.queueTurnId !== undefined) {
        // FIFO draining needs only the most recent receipt, not an unbounded log.
        const receipt = { messages: [], queueTurnId: opts.queueTurnId };
        next[QUEUE_RECEIPT_DOC_ID] = receipt;
      }
      if (existingMeta) {
        (next as Record<string, unknown>)[META_DOC_ID] = embeddedFromMeta({
          ...existingMeta,
          title: effectiveTitle,
        });
      }
      return { next, result: undefined };
    });

    const patch: Partial<ConversationMeta> = {
      messageCount: nextLen,
      preview: preview(display(last)),
    };
    // Flag the conversation as needing review when an answer just landed (set
    // by the run-completion path). Omitted for the user turn so a fresh send
    // doesn't mark its own conversation unreviewed.
    if (opts.unreviewed !== undefined) patch.unreviewed = opts.unreviewed;
    // If the conversation had no title yet, derive it from the first user msg.
    if (existingMeta && !hasGoodTitle && firstUserInBatch) {
      patch.title = effectiveTitle;
    }
    const updated = await storeForScope(executor, scope).update(id, patch);
    if (updated) updateConversationSearch(executor, updated, indexedMessages);
    return updated;
  },

  /**
   * Force a conversation-index reconstruction pass (bypasses the list()
   * cooldown). Scans the assistant config dir and mints back any index entry
   * whose transcript file exists but is missing from the index (corruption /
   * partial migration recovery). Returns the number of entries reconstructed.
   */
  async recoverIndex(executor: Executor | null | undefined): Promise<number> {
    return reconstructMissingIndex(executor);
  },

  /** Read EVERY message of a conversation (no pagination). Used by the context
   *  guard / compaction, which must measure and rewrite the full transcript. */
  async allMessages(
    executor: Executor | null | undefined,
    id: string,
  ): Promise<ConversationMessage[]> {
    return readMessagesAny(executor, id);
  },

  /**
   * Replace a conversation's ENTIRE message list (compaction rewrite). Recomputes
   * `messageCount` + `preview` from the new tail. Unlike `appendMessages` this
   * never flips `unreviewed` — compaction is a maintenance op, not a new answer.
   */
  async replaceMessages(
    executor: Executor | null | undefined,
    id: string,
    messages: ConversationMessage[],
    expected?: ConversationMessage[],
  ): Promise<ConversationMeta | null> {
    const scope = await resolveScope(executor, id);
    const normalized = normalizeConversationMessages(messages).messages;
    await msgStoreForScope(executor, id, scope).transaction(async (current) => {
      const existing = normalizeConversationMessages(current[MSG_DOC_ID]?.messages ?? []).messages;
      if (expected && JSON.stringify(existing) !== JSON.stringify(expected)) {
        throw new Error("Conversation changed during compaction; history was preserved");
      }
      return { next: { ...current, [MSG_DOC_ID]: { messages: normalized } }, result: undefined };
    });
    const display = (m: ConversationMessage) =>
      (m.role === "user" ? m.textOriginal : m.textTranslated) ?? m.content;
    const last = normalized[normalized.length - 1];
    const updated = await storeForScope(executor, scope).update(id, {
      messageCount: normalized.length,
      preview: last ? preview(display(last)) : "",
    });
    if (updated) updateConversationSearch(executor, updated, normalized);
    return updated;
  },

  /** Clear the "needs review" flag — called when the user opens the chat.
   *  `touch: false` so merely opening a chat does NOT bump `updatedAt`: the
   *  ordering timestamp only moves on a real message/answer, not on a read. */
  async markReviewed(executor: Executor | null | undefined, id: string): Promise<ConversationMeta | null> {
    const scope = await resolveScope(executor, id);
    return storeForScope(executor, scope).update(id, { unreviewed: false }, { touch: false });
  },

  /**
   * Stamp the conversation as MCP-repaired (now). The chat's "Sesión MCP
   * expirada" banner is derived from the persisted transcript (the
   * `MCP_SESSION_EXPIRED` marker), so it survives the underlying session being
   * healed. `POST /api/ai/mcp/repair` calls this so the frontend has a durable
   * signal to dismiss the banner (compare against the marker turn's ts). Not an
   * activity edit → keep updatedAt (ordering) put.
   */
  async markMcpRepaired(executor: Executor | null | undefined, id: string): Promise<ConversationMeta | null> {
    const scope = await resolveScope(executor, id);
    return storeForScope(executor, scope).update(id, { mcpRepairedAt: new Date().toISOString() }, { touch: false });
  },

  /**
   * Paginated message read — newest-last ordering for chat display.
   * `before` is an absolute index from the end (0 = latest page). The UI
   * fetches the last `limit` first, then older pages with growing offset.
   */
  async messages(
    executor: Executor | null | undefined,
    id: string,
    opts: { limit?: number; offset?: number; includeContext?: boolean } = {},
  ): Promise<{ items: ConversationMessage[]; total: number; hasMore: boolean; context?: ReturnType<typeof assessContext> }> {
    const all = await readMessagesAny(executor, id);
    const total = all.length;
    const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.min(200, Math.trunc(opts.limit!))) : 10;
    const offset = Number.isFinite(opts.offset) ? Math.max(0, Math.trunc(opts.offset!)) : 0;
    // Return the tail window: the last (offset+limit) … last(offset).
    const end = Math.max(0, total - offset);
    const start = Math.max(0, end - limit);
    return {
      items: all.slice(start, end),
      total,
      hasMore: start > 0,
      ...(opts.includeContext ? { context: assessContext(all) } : {}),
    };
  },
};
