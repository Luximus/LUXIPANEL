// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-tab bridge resolution (Option B — "header per tab").
 *
 * The "active server" lives in a single httpOnly session cookie shared by ALL
 * tabs of the same host. Switching servers in one tab rewrites that cookie, so
 * other tabs would resolve to the wrong server on their next request. To isolate
 * tabs WITHOUT exposing the JWT to JS, each tab stores its own `bridgeSessionId`
 * in `sessionStorage` and sends it on every request via the `X-Bridge-Session-Id`
 * header (or the `bridge` query param on WS upgrades).
 *
 * This helper reads that per-tab id and resolves it to a DIRECT-SSH bridge
 * target from the shared `sshCredentialsCache` (populated by the `servers`
 * module target-switch controller). The `bridgeSessionId` is a non-guessable
 * 128-bit UUID only ever exposed to the authenticated owning tab over TLS, so
 * ownership is "honor-with-warn": mismatches are logged but still honored; only
 * a missing/expired record falls back to the cookie behavior (null = no override).
 *
 * INVARIANT: this helper NEVER throws. Any failure resolves to `null`, which
 * means "no override" and the request keeps its current per-cookie behavior.
 */

import { createModuleLogger } from "../logger/index.js";
import { sshCredentialsCache } from "../../modules/auth/services/ssh-credentials-cache.service.js";

const log = createModuleLogger("bridge-header");

/** HTTP header (lowercased in `req.headers`) carrying the per-tab bridge id. */
export const BRIDGE_HEADER = "x-bridge-session-id";

/**
 * A resolved per-tab DIRECT-SSH bridge target. `remoteSessionId` is always `""`
 * (no LP-side remote session in self-hosted mode); `direct` is always `true`.
 */
export interface PerTabBridge {
  bridgeSessionId: string;
  remoteSessionId: string;
  targetId: string;
  targetName: string;
  direct: true;
}

/**
 * Read the per-tab bridge id from request headers (HTTP `req.headers` or a WS
 * `IncomingMessage.headers`). Accepts a string or string[] (takes the first),
 * trims it, and returns `null` when absent/empty. Never throws.
 */
export function readBridgeHeader(headers: Record<string, unknown> | undefined): string | null {
  try {
    if (!headers) return null;
    const raw = headers[BRIDGE_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a per-tab override bridge target, or `null` when there is no usable
 * override. Returns `null` if the override id is absent, equals the cookie's own
 * `bridgeSessionId` (no override needed), or has no live SSH material cached.
 * NEVER throws — any error resolves to `null` (= fall back to the current
 * per-cookie behavior, no regression).
 *
 * Ownership is validated as defense-in-depth (honor-with-warn): a mismatch is
 * logged but the override is still honored because the `bridgeSessionId` is a
 * non-guessable secret exposed only to the owning tab over TLS.
 */
export async function resolveOverrideBridge(
  overrideBridgeId: string | null | undefined,
  payload: { userId: number; bridgeSessionId?: string },
): Promise<PerTabBridge | null> {
  try {
    // 1) No override id at all.
    if (!overrideBridgeId) return null;
    // 2) Already the cookie's own bridge id — nothing to override.
    if (overrideBridgeId === payload.bridgeSessionId) return null;
    // 3) DIRECT-SSH: credentials cached by bridgeSessionId (target switch).
    const mat = await sshCredentialsCache.get(overrideBridgeId);
    if (!mat) return null;
    // Fail-CLOSED ownership: the cached material is sealed with the owning
    // panel user id (target-switch / login stamp it). Reject (→ no override,
    // fall back to the per-cookie session) when the owner is missing or does
    // not match the session's user, so a leaked/guessed bridgeSessionId can't
    // hand another authenticated user this target's SSH executor.
    if (typeof mat.userId !== "number" || mat.userId !== payload.userId) {
      log.warn(
        { overrideBridgeId, matOwner: mat.userId, tokenUser: payload.userId },
        "per-tab bridge owner mismatch/absent — rejecting override (fail-closed)",
      );
      return null;
    }
    const targetId = mat.targetId ?? "";
    return {
      bridgeSessionId: overrideBridgeId,
      remoteSessionId: "",
      targetId,
      targetName: mat.targetName ?? targetId,
      direct: true,
    };
  } catch (err) {
    log.warn({ err, overrideBridgeId }, "resolveOverrideBridge failed — no override");
    return null;
  }
}
