// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP repair — the "real fix" behind the persistent «Sesión MCP expirada»
 * banner.
 *
 * The banner is raised when the MCP loopback (`mcp.controller.resolveExecutor`)
 * fails CLOSED: a token that carried a `bridgeSessionId` no longer resolves to
 * a live executor (a backend restart wiped the in-memory bridge map, or the
 * bridged session ended). The error carries the `[MCP_SESSION_EXPIRED]` marker,
 * which the CLI relays verbatim into the assistant turn and gets PERSISTED in
 * the conversation transcript — so the banner is sticky even after the session
 * is healthy again.
 *
 * Regenerating the token in the provider config does NOT clear it because that
 * only mints a fresh JWT + shows a snippet: it neither reinstalls the token
 * where the runtime reads it (the target's CLI config) nor clears the persisted
 * marker. This service does the real repair: re-mint a token bound to the
 * session's CURRENT (live) bridge and reinstall it into the target CLI config.
 * The controller re-resolves the connected server (fail-closed) before calling
 * here and stamps the conversation as repaired so the banner can be dismissed.
 *
 * No express imports (module convention): the controller passes the resolved
 * `Executor` + a plain session identity.
 */

import { tokenService, type TokenPayload } from "../../auth/services/token.service.js";
import type { Executor } from "../../../shared/executor/index.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import {
  mcpConfigWriterService,
  supportsMcpAutoInstall,
  type McpInstallResult,
} from "./mcp-config-writer.service.js";
import { isAssistantProviderId, type AssistantProviderId } from "../models/assistant-config.types.js";
import { mcpTokenIdentityClaims } from "./mcp-run-tokens.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-mcp-repair");

/** Long-lived MCP token TTL (30 days) — shared by mint + repair. */
export const MCP_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Identity fields carried from the caller's session into a minted MCP token. */
export interface McpTokenSession {
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
 * Mint a long-lived MCP JWT bound to the caller's CURRENT target. Shared by the
 * mint-token endpoint (copy/paste + optional install) and the repair endpoint
 * (mint + forced reinstall), so both stay in lock-step. The token MUST inherit
 * `bridgeSessionId` so the loopback resolves the same server the admin was on.
 * Returns `expiresAt` as seconds-since-epoch (the JSON payload the UI formats
 * with `new Date(expiresAt * 1000)`).
 */
export function mintLongLivedMcpToken(
  session: McpTokenSession,
  ttlSeconds: number = MCP_TOKEN_TTL_SECONDS,
): { token: string; expiresAt: number } {
  const expiresAtMs = Date.now() + ttlSeconds * 1000;
  const { token } = tokenService.signWithExpiry(mcpTokenIdentityClaims(session), expiresAtMs);
  return { token, expiresAt: Math.floor(expiresAtMs / 1000) };
}

export interface McpRepairInput {
  session: McpTokenSession;
  /** Executor for the connected server — resolved fail-closed by the caller. */
  executor: Executor;
  /** The panel's `/api/ai/mcp` endpoint (per-request panel origin). */
  mcpUrl: string;
  /** Provider whose CLI config to reinstall. Defaults to the target's active provider. */
  provider?: AssistantProviderId;
}

export interface McpRepairResult {
  ok: boolean;
  detail: string;
  provider: AssistantProviderId;
  /** True when a fresh token was written into the target CLI config. */
  reinstalled: boolean;
  /** New token expiry (seconds-since-epoch). */
  expiresAt: number;
  install?: McpInstallResult;
}

export const mcpRepairService = {
  /**
   * Re-mint the MCP token bound to the session's LIVE bridge and reinstall it
   * into the target CLI config, so the next run resolves the connected server
   * instead of the stale `bridgeSessionId` that raised MCP_SESSION_EXPIRED.
   * Reaching here already proves the connected server is resolvable again (the
   * controller resolved the executor fail-closed).
   */
  async repair(input: McpRepairInput): Promise<McpRepairResult> {
    let provider = input.provider;
    if (!provider) {
      const cfg = await assistantConfigRepository.load(input.executor);
      provider = isAssistantProviderId(cfg.activeProvider) ? cfg.activeProvider : "claude";
    }

    const { token, expiresAt } = mintLongLivedMcpToken(input.session);

    if (!supportsMcpAutoInstall(provider)) {
      // API-only provider (deepseek/grok/minimax): no CLI on the target to
      // reinstall a token for. Re-minting + the fail-closed executor
      // re-resolution already healed the runtime path; the banner is cleared by
      // the caller stamping the conversation.
      return {
        ok: true,
        detail: `El proveedor ${provider} no usa CLI/MCP en el servidor; no hay token que reinstalar.`,
        provider,
        reinstalled: false,
        expiresAt,
      };
    }

    const install = await mcpConfigWriterService.install(provider, input.mcpUrl, token, input.executor);
    if (!install.ok) {
      log.warn({ provider, path: install.path }, "MCP repair: reinstall into target CLI config failed");
    }
    return {
      ok: install.ok,
      detail: install.detail,
      provider,
      reinstalled: install.ok,
      expiresAt,
      install,
    };
  },
};
