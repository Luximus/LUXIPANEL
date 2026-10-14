// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * CLI session continuity — remembers the upstream agent CLI session per
 * conversation so each new turn RESUMES the existing session (memory)
 * instead of starting cold.
 *
 * Sidecar: `${LUXIPANEL_CONFIG_DIR}/assistant/cli-sessions.json`, keyed by
 * conversationId. Per-target (one server's chats never leak into another).
 *
 * Per provider:
 *   - claude:  we mint a UUID, pass it as `--session-id` on the first turn
 *              and `--resume <uuid>` afterwards. We persist that uuid here.
 *   - codex:   `codex exec` creates a session; later turns use
 *              `codex exec resume <session-id>`. We persist that id here.
 *   - gemini:  no reliable headless resume → not tracked (transcript-in-prompt).
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { getContextUserId } from "../../../shared/executor/context.js";
import type { AssistantProviderId } from "../models/assistant-config.types.js";

export interface CliProviderSessionState {
  claude?: string;
  codex?: string;
  codexStarted?: boolean;
  cwd?: string;
}

export interface CliSessionRecord {
  id?: string;
  /** Legacy flat fields kept for backward compatibility with older sidecars. */
  claude?: string;
  codex?: string;
  codexStarted?: boolean;
  cwd?: string;
  /** Provider-scoped upstream sessions within the same global conversation. */
  providers?: Partial<Record<AssistantProviderId, CliProviderSessionState>>;
  createdAt?: string;
  updatedAt?: string;
}

const MODULE = "assistant";
const COLLECTION = "cli-sessions";

// Per-user: mirrors the per-user namespacing of conversations (a CLI session
// belongs to a conversation, which is per-user). Keeps one user's resume
// state from binding to another's chats on the same server.
function store(executor?: Executor | null) {
  const uid = getContextUserId();
  const collection = uid ? `${COLLECTION}-u${uid}` : COLLECTION;
  return dataStore<CliSessionRecord>(executor, MODULE, collection);
}

function fromLegacy(provider: AssistantProviderId, record: CliSessionRecord | null): CliProviderSessionState | null {
  if (!record) return null;
  if (provider === "claude") {
    return record.claude || record.cwd ? { claude: record.claude, cwd: record.cwd } : null;
  }
  if (provider === "codex") {
    return record.codex || record.codexStarted ? { codex: record.codex, codexStarted: record.codexStarted } : null;
  }
  return null;
}

function mergedProviderSession(provider: AssistantProviderId, record: CliSessionRecord | null): CliProviderSessionState | null {
  if (!record) return null;
  const scoped = record.providers?.[provider];
  const legacy = fromLegacy(provider, record);
  if (!scoped && !legacy) return null;
  return { ...(legacy ?? {}), ...(scoped ?? {}) };
}

export const cliSessionsRepository = {
  async get(
    executor: Executor | null | undefined,
    conversationId: string,
  ): Promise<CliSessionRecord | null> {
    return store(executor).get(conversationId) as Promise<CliSessionRecord | null>;
  },

  /**
   * Every conversation id that has an upstream CLI/terminal session on this
   * target. These are the "conversaciones por terminal" — used to reconcile any
   * whose chat metadata went missing so they still surface in the list.
   */
  async listAll(
    executor: Executor | null | undefined,
  ): Promise<Array<CliSessionRecord & { id: string }>> {
    const rows = (await store(executor).list()) as Array<CliSessionRecord & { id: string | number }>;
    return rows.map((r) => ({ ...r, id: String(r.id) }));
  },

  /** Upsert a partial patch onto the conversation's session record. */
  async patch(
    executor: Executor | null | undefined,
    conversationId: string,
    patch: Partial<CliSessionRecord>,
  ): Promise<CliSessionRecord> {
    const existing = (await store(executor).get(conversationId)) as CliSessionRecord | null;
    return store(executor).set(conversationId, { ...(existing ?? {}), ...patch });
  },

  /**
   * Drop the upstream-session marker so the NEXT CLI turn starts a FRESH session
   * instead of `--resume`-ing the old (oversized) one. Used by compaction: after
   * the transcript is folded into a summary, resuming the stale upstream session
   * would just reload the full pre-compaction history and defeat the point.
   */
  async clear(
    executor: Executor | null | undefined,
    conversationId: string,
  ): Promise<void> {
    await store(executor).delete(conversationId).catch(() => undefined);
  },

  async getProvider(
    executor: Executor | null | undefined,
    conversationId: string,
    provider: AssistantProviderId,
  ): Promise<CliProviderSessionState | null> {
    const record = (await store(executor).get(conversationId)) as CliSessionRecord | null;
    return mergedProviderSession(provider, record);
  },

  async patchProvider(
    executor: Executor | null | undefined,
    conversationId: string,
    provider: AssistantProviderId,
    patch: Partial<CliProviderSessionState>,
  ): Promise<CliSessionRecord> {
    const existing = (await store(executor).get(conversationId)) as CliSessionRecord | null;
    const providers = { ...(existing?.providers ?? {}) };
    providers[provider] = { ...(providers[provider] ?? {}), ...patch };
    return store(executor).set(conversationId, { ...(existing ?? {}), providers });
  },

  async clearProvider(
    executor: Executor | null | undefined,
    conversationId: string,
    provider: AssistantProviderId,
  ): Promise<CliSessionRecord | null> {
    const existing = (await store(executor).get(conversationId)) as CliSessionRecord | null;
    if (!existing) return null;
    const providers = { ...(existing.providers ?? {}) };
    delete providers[provider];
    return store(executor).set(conversationId, { ...existing, providers });
  },
};
