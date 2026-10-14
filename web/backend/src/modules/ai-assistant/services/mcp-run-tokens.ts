// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Acuñación de los tokens MCP por-run (canal cross `servers.*`/`team__*` y
 * canal code-graph). Extraído de `agent.controller.ts` para que el DRAIN de la
 * cola (`turn-queue.service.ts`) pueda acuñar tokens FRESCOS al lanzar un turno
 * en background: los turnos drenados no tienen Request, y sin token el CLI
 * arranca sin el canal MCP (tools `team__*` ausentes — "No such tool
 * available"). Los mints solo necesitan el `SessionUser` (persistido en el
 * QueuedTurn) + conversationId, así que re-acuñar en el drain es seguro y evita
 * además persistir tokens que podrían caducar en cola.
 */

import { tokenService, type TokenPayload } from "../../auth/services/token.service.js";
import type { SessionUser } from "../../../shared/types/index.js";

export const CROSS_MCP_TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6h — covers long background runs

/** Minimal session identity a minted MCP token binds to — satisfied by both a
 *  full `SessionUser` (per-run mints) and the repair endpoint's
 *  `McpTokenSession` (structurally identical). */
export interface McpIdentitySession {
  userId?: number;
  username?: string;
  displayName?: string;
  role?: string;
  modules?: string[];
  kind?: TokenPayload["kind"];
  bridgeSessionId?: string;
  remoteSessionId?: string;
  targetId?: string;
  targetName?: string;
  targetHost?: string;
}

/**
 * The identity claims EVERY minted MCP token carries: who the caller is
 * (userId/username/displayName/role/modules/kind) plus the live bridge/target
 * binding (each only present when set) so the loopback re-resolves the SAME
 * server the admin was on. Callers add the variable claims (`mcpScope`,
 * `conversationId`) and choose the expiry. Consolidated so the three mints
 * (cross / graph / long-lived-repair) stay in lock-step.
 */
export function mcpTokenIdentityClaims(session: McpIdentitySession): TokenPayload {
  return {
    userId: session.userId ?? 0,
    username: session.username ?? "",
    displayName: session.displayName ?? "",
    role: session.role ?? "",
    modules: session.modules ?? ["assistant"],
    kind: session.kind ?? "admin",
    ...(session.bridgeSessionId ? { bridgeSessionId: session.bridgeSessionId } : {}),
    ...(session.remoteSessionId ? { remoteSessionId: session.remoteSessionId } : {}),
    ...(session.targetId ? { targetId: session.targetId } : {}),
    ...(session.targetName ? { targetName: session.targetName } : {}),
    ...(session.targetHost ? { targetHost: session.targetHost } : {}),
  };
}

/**
 * Mint a short-lived, cross-scoped MCP token for the per-run servers.* channel.
 * Carries the session identity (so the cross endpoint resolves the same target
 * executor + gates by role) but `mcpScope:"cross"` so it can NEVER be replayed
 * on the full `/api/ai/mcp` endpoint.
 *
 * Sesión SIN bridge: solo se acuña cuando el target es el propio host
 * ("local"/ausente) — el endpoint cross ya resuelve ese caso a `localExecutor`
 * (mcp.controller) y las tools `servers.*` ni siquiera usan ese executor
 * (montan su propio DirectSshExecutor desde el registro local de servidores).
 * Con target REMOTO sin bridge se sigue devolviendo undefined: sin bridge no
 * hay executor válido hacia ese target. (Antes se exigía bridge SIEMPRE, lo
 * que dejaba a los workers de equipo de una sesión local sin `servers.*`.)
 */
export function mintCrossMcpToken(
  session: SessionUser | undefined,
  conversationId: string | undefined,
): string | undefined {
  if (!session) return undefined;
  if (!session.bridgeSessionId && session.targetId && session.targetId !== "local") return undefined;
  const { token } = tokenService.signWithExpiry(
    {
      ...mcpTokenIdentityClaims(session),
      mcpScope: "cross",
      // Lets the cross channel's `permissions.approve` tool route an approval
      // prompt back to this exact run (and block on the user's decision).
      ...(conversationId ? { conversationId } : {}),
    },
    Date.now() + CROSS_MCP_TOKEN_TTL_MS,
  );
  return token;
}

/**
 * Token for the per-run code-graph MCP channel (`/api/ai/mcp/graph`).
 *
 * NOTE — unlike `mintCrossMcpToken` this does NOT bail out when the session has
 * no `bridgeSessionId`. The cross channel needs one because it acts on OTHER
 * servers through the LP proxy; the graph channel only ever runs the graph
 * binary on the session's own target, and `resolveExecutor` already falls back
 * to the local executor on a non-managed install. Copying that guard here would
 * silently kill the code graph for every standalone/local deployment — where it
 * works today.
 */
export function mintGraphMcpToken(
  session: SessionUser | undefined,
  conversationId: string | undefined,
): string | undefined {
  if (!session || !conversationId) return undefined;
  const { token } = tokenService.signWithExpiry(
    {
      ...mcpTokenIdentityClaims(session),
      mcpScope: "graph",
      // The conversation is the ONLY thing that binds a graph call to an agent
      // (and therefore to a project scope). It is signed: the model cannot forge
      // it, and every tool call re-resolves the scope from it.
      conversationId,
    },
    Date.now() + CROSS_MCP_TOKEN_TTL_MS,
  );
  return token;
}

/** This token can call only the protected, run-bound module gateway. */
export function mintModuleMcpToken(session: SessionUser | undefined, conversationId: string | undefined): string | undefined {
  if (!session || !conversationId || (!session.bridgeSessionId && session.targetId && session.targetId !== "local")) return undefined;
  return tokenService.signWithExpiry({
    ...mcpTokenIdentityClaims(session), mcpScope: "modules", conversationId,
    // A run token authenticates the existing session; minting it must not
    // reset a hosting plan's session lifetime or lose its verified MFA/owner.
    ...(session.sessionIssuedAt !== undefined ? { authTime: session.sessionIssuedAt } : {}),
    ...(session.mfaAuthenticated !== undefined ? { mfaAuthenticated: session.mfaAuthenticated } : {}),
    ...(session.tenantId !== undefined ? { tenantId: session.tenantId } : {}),
    ...(session.owner !== undefined ? { owner: session.owner } : {}),
  }, Date.now() + CROSS_MCP_TOKEN_TTL_MS).token;
}
