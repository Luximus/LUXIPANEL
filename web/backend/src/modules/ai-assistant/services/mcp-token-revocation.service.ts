// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP token revocation list — per-server sidecar of `jti`s that have been
 * invalidated BEFORE their natural `exp`.
 *
 * Background: `POST /api/ai/mcp/tokens` mints a JWT that the panel writes
 * into the target CLI's config file (e.g. `~/.claude/mcp.json`). That file is
 * mode 0600 but lives on the TARGET, where the CLI's user can read it and any
 * other local user/process that gets the file gets the panel-issued bearer.
 * A leaked token is otherwise valid until its `exp` (see `MCP_TOKEN_TTL_SECONDS`
 * in `config/env.ts`); the revocation list is the fast-path kill switch.
 *
 * Storage: `kv()` over `${LUXIPANEL_CONFIG_DIR}/assistant/mcp-revoked.json`,
 *   shape: `{ "tokens": string[] }` — a list of `jti`s (UUID strings; same as
 *   `signCore` passes to `jwt.sign({ jwtid })` in `auth/services/token.service.ts`).
 * Per-server, NOT per-instance: revocation must travel with the executor so a
 * leaked token doesn't survive a server migration unscathed.
 *
 * Failure mode: if the sidecar can't be read (transient SFTP error, missing
 * file) the lookup returns `false` (treat as NOT revoked) — a Redis-style
 * fail-open that mirrors `token.service.verify`'s denylist behavior. We log a
 * warning so the operator sees it but never block legitimate traffic. A stale
 * "not revoked" answer during an outage is the lesser evil vs locking every
 * MCP request out.
 */

import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";

const log = createModuleLogger("assistant-mcp-revocation");

const MODULE = "assistant";
const COLLECTION = "mcp-revoked";

interface RevocationDoc {
  tokens: string[];
}

const EMPTY: RevocationDoc = { tokens: [] };

function isUuidLike(s: unknown): s is string {
  // Accept any non-empty short string. We don't strictly require UUID format
  // (jwtid is `randomUUID()` but stay tolerant of future id strategies).
  return typeof s === "string" && s.length > 0 && s.length <= 128;
}

function sanitizeList(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const tokens = (raw as { tokens?: unknown }).tokens;
  if (!Array.isArray(tokens)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!isUuidLike(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export const mcpTokenRevocationService = {
  /**
   * Has this `jti` been revoked? Returns `false` on read error (fail-open, see
   * file header). Pass the executor pinned to the current request so the read
   * lands on the connected server's sidecar.
   */
  async isTokenRevoked(jti: string | null | undefined, executor: Executor): Promise<boolean> {
    if (!isUuidLike(jti)) return false;
    try {
      const map = await kv(executor).module(MODULE).collection<RevocationDoc>(COLLECTION).get("current");
      const tokens = sanitizeList(map ?? null);
      return tokens.includes(jti);
    } catch (err) {
      log.warn(
        { err: errMessage(err), jti },
        "MCP revocation list read failed — treating token as not revoked (fail-open)",
      );
      return false;
    }
  },

  /**
   * Append `jti` to the revocation list. Idempotent: a token that's already on
   * the list is a no-op. Returns the (new) length of the list so the caller
   * can surface it in the API response.
   *
   * Uses `kv().transaction()` so a concurrent `revokeToken` on the same server
   * can't drop one of the writes (read-modify-write under a per-collection
   * lock).
   */
  async revokeToken(jti: string, executor: Executor): Promise<{ ok: boolean; count: number; alreadyRevoked: boolean }> {
    if (!isUuidLike(jti)) {
      return { ok: false, count: 0, alreadyRevoked: false };
    }
    const store = kv(executor).module(MODULE).collection<RevocationDoc>(COLLECTION);
    let count = 0;
    let alreadyRevoked = false;
    try {
      await store.transaction(async (current) => {
        const tokens = sanitizeList(current["current"]);
        if (tokens.includes(jti)) {
          alreadyRevoked = true;
          count = tokens.length;
          return { next: current, result: undefined };
        }
        const next = { tokens: [...tokens, jti] };
        count = next.tokens.length;
        return { next: { current: next }, result: undefined };
      });
      return { ok: true, count, alreadyRevoked };
    } catch (err) {
      log.warn(
        { err: errMessage(err), jti },
        "MCP token revoke failed",
      );
      throw err;
    }
  },

  /** Test-only seam: erase the in-memory list between cases. */
  __resetForTest(): void {
    // No in-memory state to clear — the file IS the state.
  },

  // Exposed for tests / introspection only.
  __empty: EMPTY,
};