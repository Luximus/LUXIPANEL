// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { moduleToolRunScope, MODULE_RUN_EXPIRED } from "../services/module-tools.service.js";
import { ensureModuleToolRun } from "../services/cli-run-recovery.service.js";
import { resolveLiveAuthorization } from "../../auth/services/live-authorization.service.js";
import { setContextFileJail } from "../../../shared/executor/context.js";
/**
 * MCP HTTP transport — accepts JSON-RPC requests from upstream CLIs.
 *
 * Auth: `Authorization: Bearer <jwt>`. The JWT is minted by
 * `mintMcpToken` (controller below) from the admin's current session;
 * its `bridgeSessionId` lets us resolve the target executor on every
 * call so capability handlers run against the right server.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";
import { tokenService } from "../../auth/services/token.service.js";
import {
  localExecutor,
  LOCAL_TARGET_ID,
  getDirectExecutorByBridgeSessionId,
  getExecutor,
  runWithExecutor,
  type Executor,
} from "../../../shared/executor/index.js";
import { AppError, BridgeSessionRequiredError } from "../../../shared/errors/index.js";
import {
  MCP_PARSE_ERROR,
  MCP_SERVER_ERROR,
  MCP_TOOL_ERROR,
  MCP_ACCESS_DENIED,
} from "../../../shared/mcp/rpc-codes.js";
import {
  isAssistantProviderId,
  type AssistantProviderId,
} from "../models/assistant-config.types.js";
import {
  mcpServerService,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
  type JsonRpcRequest,
} from "../services/mcp-server.service.js";
import { mcpConfigWriterService } from "../services/mcp-config-writer.service.js";
import {
  mcpRepairService,
  mintLongLivedMcpToken,
  type McpTokenSession,
} from "../services/mcp-repair.service.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { GRAPH_TOOL_PREFIX } from "../services/graph-tools.js";
import { agentRunRegistry } from "../services/agent-run-registry.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { panelOriginFromRequest } from "../../../shared/http/panel-origin.js";

const log = createModuleLogger("ai-mcp");

function bearerToken(req: Request): string | null {
  const header = req.header("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

/**
 * Stale per-server MCP session: the long-lived MCP token still verifies, but
 * its `bridgeSessionId` no longer resolves to a live executor (the bridged
 * session ended, or a backend restart wiped the in-memory executor/credential
 * maps). Surfaced to the caller instead of silently running tools against the
 * panel host.
 */
class McpSessionExpiredError extends AppError {
  constructor() {
    // The `[MCP_SESSION_EXPIRED]` marker is a stable token the frontend
    // matches to raise a banner — it survives being relayed verbatim by the
    // upstream CLI in CLI mode.
    super(
      "Sesión MCP expirada o servidor desconectado. Reconéctate al servidor desde el panel y reinstala el token MCP (pestaña del asistente → Proveedores → MCP). [MCP_SESSION_EXPIRED]",
      409,
      "MCP_SESSION_EXPIRED",
    );
  }
}

async function resolveExecutor(payload: {
  bridgeSessionId?: string;
  targetId?: string;
  conversationId?: string;
  userId?: number;
}): Promise<Executor> {
  // No per-server bridge at all (token without `bridgeSessionId`/`targetId`,
  // or an explicit "local" target) → the panel-host executor. This is the
  // legacy non-managed-style path: token identifies the user only, tools run
  // on the panel host.
  if (payload.targetId === LOCAL_TARGET_ID) {
    return localExecutor;
  }
  if (!payload.bridgeSessionId) {
    if (payload.targetId) throw new McpSessionExpiredError();
    return localExecutor;
  }
  const direct = await getDirectExecutorByBridgeSessionId(payload.bridgeSessionId);
  if (direct) {
    if (payload.targetId && direct.target.id !== payload.targetId) throw new McpSessionExpiredError();
    return direct;
  }
  // Cross tokens carry the run's conversationId: when THAT run is still
  // active, serve the callback with the run's own pinned executor. This heals
  // the "session rotated/expired MID-RUN" case — the CLI is literally still
  // streaming through that executor — without widening the token: strict
  // owner check (same panel user), same target (the run was started on it),
  // and the fallback dies with the run (runContext returns null once done).
  if (payload.conversationId) {
    const ctx = payload.targetId ? agentRunRegistry.runContext(payload.conversationId, payload.targetId) : null;
    if (ctx && ctx.executor.target.id === payload.targetId && ctx.ownerUserId !== undefined && ctx.ownerUserId === payload.userId) {
      log.warn(
        { conversationId: payload.conversationId, bridgeSessionId: payload.bridgeSessionId },
        "MCP bridge session stale — serving with the active run's pinned executor",
      );
      return ctx.executor;
    }
  }
  // Fail CLOSED. The token expected a per-server target (it carried a
  // bridgeSessionId) but it no longer resolves — do NOT fall back to
  // localExecutor (the panel host): that silently runs tools against the
  // wrong machine and surfaces as confusing "Account not found" / wrong
  // service state. Honor the fail-closed isolation invariant and tell the
  // user to reconnect.
  throw new McpSessionExpiredError();
}

/**
 * Shared JSON-RPC dispatch for both the full MCP endpoint and the per-run
 * cross-server channel. `toolNamePrefix` narrows the tool set (cross channel =
 * "servers."); `rejectCrossScope` blocks a cross-scoped token from widening to
 * the full toolset on the main endpoint.
 */
async function dispatchMcp(
  req: Request,
  res: Response,
  opts: {
    toolNamePrefix?: string;
    rejectCrossScope?: boolean;
    stripToolPrefixOnWire?: boolean;
    requireGraphScope?: boolean;
    requireModuleScope?: boolean;
  },
): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    res
      .status(401)
      .set("WWW-Authenticate", "Bearer realm=\"luxipanel-mcp\"")
      .json({ jsonrpc: "2.0", id: null, error: { code: MCP_SERVER_ERROR, message: "Missing bearer token" } });
    return;
  }
  const payload = await tokenService.verify(token);
  if (!payload) {
    res
      .status(401)
      .json({ jsonrpc: "2.0", id: null, error: { code: MCP_SERVER_ERROR, message: "Invalid token" } });
    return;
  }
  // Per-run tokens are written to a target shell (mode 0600, but the agent's own
  // user can read them), so each one must only ever open the door it was minted
  // for. A `cross` token must not reach the full toolset, and a `graph` token —
  // which is handed to EVERY CLI run that has an indexed project — must not be
  // replayable on the cross channel to gain `servers.*`/`team.*`.
  const scope = payload.mcpScope;
  const forbidden = opts.requireModuleScope ? scope !== "modules" : scope === "modules" ? true : opts.requireGraphScope
    ? scope !== "graph" // the graph endpoint takes graph tokens and nothing else
    : scope === "graph" || (Boolean(opts.rejectCrossScope) && scope === "cross");
  if (forbidden) {
    res
      .status(403)
      .json({ jsonrpc: "2.0", id: null, error: { code: MCP_ACCESS_DENIED, message: `Forbidden (${scope ?? "unscoped"} token)` } });
    return;
  }
  if (!payload.modules.includes("assistant") && payload.kind !== "admin") {
    res
      .status(403)
      .json({ jsonrpc: "2.0", id: null, error: { code: MCP_ACCESS_DENIED, message: "Forbidden" } });
    return;
  }

  let body: JsonRpcRequest;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as JsonRpcRequest;
  } catch {
    res
      .status(400)
      .json({ jsonrpc: "2.0", id: null, error: { code: MCP_PARSE_ERROR, message: "Parse error" } });
    return;
  }

  let executor: Executor;
  try {
    executor = await resolveExecutor({
      ...(payload.bridgeSessionId ? { bridgeSessionId: payload.bridgeSessionId } : {}),
      ...(payload.targetId ? { targetId: payload.targetId } : {}),
      ...(payload.conversationId ? { conversationId: payload.conversationId } : {}),
      ...(payload.userId !== undefined ? { userId: payload.userId } : {}),
    });
  } catch (err) {
    const message =
      err instanceof AppError ? err.message : "No se pudo resolver el servidor de la sesión MCP.";
    // JSON-RPC error (HTTP 200) so the upstream CLI shows the message
    // instead of a generic transport failure.
    res.json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: MCP_TOOL_ERROR, message } });
    return;
  }

  // El token MCP porta la identidad de la sesión que lo acuñó: se reconstruye
  // el SessionUser y se PINEA en el ALS junto al executor (4º arg). Sin esto,
  // getContextUser() devolvía null en el loopback y toda tool que exige el
  // usuario de sesión (p.ej. previews de module-dev) fallaba SIEMPRE en
  // CLI-mode; además el filtro owner-only de previews no podía aplicarse.
  const sessionUser = tokenService.toSessionUser(payload);
  if (opts.requireModuleScope) {
    const restored = payload.conversationId && await runWithExecutor(executor, async () => {
      await resolveLiveAuthorization(sessionUser, executor);
      return ensureModuleToolRun(executor, payload.conversationId!, sessionUser, token);
    }, payload.userId, sessionUser).catch(() => false);
    if (!restored) {
      res.status(403).json({ jsonrpc: "2.0", id: body.id ?? null,
        error: { code: MCP_ACCESS_DENIED, message: MODULE_RUN_EXPIRED.message, data: MODULE_RUN_EXPIRED } }); return;
    }
  }
  const response = await runWithExecutor(
    executor,
    () => {
      if (opts.requireModuleScope && payload.conversationId) setContextFileJail(moduleToolRunScope(payload.conversationId, executor, sessionUser)?.jail ?? []);
      return mcpServerService.handle(body, {
        executor,
        userId: String(payload.userId),
        user: sessionUser,
        ...(opts.toolNamePrefix ? { toolNamePrefix: opts.toolNamePrefix } : {}),
        // Cross channel (per-run) carrying a conversation → enable the interactive
        // permission gate. The full /api/ai/mcp endpoint never sets toolNamePrefix,
        // so the approve tool stays off there.
        ...(payload.conversationId
          ? { permissionConversationId: payload.conversationId }
          : {}),
        ...(opts.stripToolPrefixOnWire ? { stripToolPrefixOnWire: true } : {}),
        ...(opts.requireModuleScope ? { moduleChannel: true } : {}),
      });
    },
    payload.userId,
    sessionUser,
  );

  if (response === null) {
    res.status(204).end();
    return;
  }
  res.json(response);
}

export const mcpController = {
  async handleModules(req: Request, res: Response): Promise<void> { await dispatchMcp(req, res, { requireModuleScope: true }); },
  /**
   * POST /api/ai/mcp — single JSON-RPC envelope per HTTP call.
   * (Streamable HTTP transport with SSE upgrades is a v2.)
   */
  async handle(req: Request, res: Response): Promise<void> {
    await dispatchMcp(req, res, { rejectCrossScope: true });
  },

  /**
   * POST /api/ai/mcp/cross — per-run cross-server channel. Auto-wired into a
   * Claude CLI run when its project has associated servers; exposes ONLY the
   * `servers.*` tools so the agent can act on the associated targets. Same
   * Bearer/identity model as `handle`, narrowed by `toolNamePrefix`.
   */
  async handleCross(req: Request, res: Response): Promise<void> {
    await dispatchMcp(req, res, { toolNamePrefix: "servers." });
  },

  /**
   * POST /api/ai/mcp/graph — per-run code-graph channel. Replaces handing the
   * `codebase-memory-mcp` binary straight to the CLI over stdio: that gave the
   * model an unscoped `list_projects` (every graph on the box) plus a free
   * `project` argument on every query, so any agent could read any other
   * agent's code. Here the panel resolves the caller's agent from the SIGNED
   * conversationId and validates each `project` against that agent's own
   * projects, asking the user when the model reaches outside them.
   */
  async handleGraph(req: Request, res: Response): Promise<void> {
    await dispatchMcp(req, res, {
      toolNamePrefix: GRAPH_TOOL_PREFIX,
      stripToolPrefixOnWire: true,
      requireGraphScope: true,
    });
  },

  /**
   * POST /api/ai/mcp/tokens — mint a long-lived JWT bound to the caller's
   * current target. Returns the MCP config snippet the user can paste into
   * each CLI's config file on the target.
   *
   * The token inherits `bridgeSessionId` / `targetId` / modules from the
   * caller's session so the same isolation rules apply.
   */
  mintToken: asyncHandler(async (req: Request, res: Response) => {
    const session = res.locals["user"] as
      | (Partial<import("../../auth/services/token.service.js").TokenPayload> & {
          userId?: number;
          username?: string;
        })
      | undefined;
    if (!session) {
      res.status(401).json({ ok: false, error: apiErrorMessage(res.locals.locale, "authentication") });
      return;
    }

    // Mint a long-lived token bound to the session's CURRENT target (shared
    // helper — keeps mint + repair in lock-step). `targetHost` (SSO `thost` or
    // validated direct host) rides along so host-resolved tools work in the
    // loopback too.
    const { token, expiresAt } = mintLongLivedMcpToken(session as McpTokenSession);

    const provider = String(req.query["provider"] ?? "");
    const providerId = isAssistantProviderId(provider) ? provider : null;
    const mcpUrl = `${panelOriginFromRequest(req)}/api/ai/mcp`;
    const config = buildCliMcpSnippet({
      providerId,
      token,
      panelOrigin: panelOriginFromRequest(req),
    });

    // When `?install=true`, write the config straight to the target's CLI
    // config file via the request executor — no copy-paste needed.
    let install: { ok: boolean; path: string; detail: string } | undefined;
    if (providerId && String(req.query["install"] ?? "") === "true") {
      const executor = getExecutor(req);
      install = await mcpConfigWriterService.install(providerId, mcpUrl, token, executor);
    }

    res.json({
      ok: true,
      token,
      // Seconds-since-epoch (from mintLongLivedMcpToken) — easier for the
      // frontend to format with `new Date(expiresAt * 1000)`.
      expiresAt,
      mcpUrl,
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: MCP_SERVER_INFO,
      config,
      install,
    });
  }),

  /**
   * POST /api/ai/mcp/repair — one-click recovery for the persistent
   * «Sesión MCP expirada» banner.
   *
   * The banner is sticky because it is derived from the persisted transcript
   * (the `[MCP_SESSION_EXPIRED]` marker), and because regenerating the token in
   * the provider config never reinstalls it where the runtime reads it. This
   * endpoint does the real repair:
   *   1. Re-resolve the connected server for THIS session (fail-closed → 428).
   *   2. Re-mint an MCP token bound to the session's LIVE bridge.
   *   3. Reinstall it into the target's CLI config (so the next run resolves).
   *   4. When `conversationId` is given, stamp the conversation MCP-repaired so
   *      the frontend can dismiss the banner across reloads.
   *
   * Body (JSON, all optional): `{ provider?, conversationId? }`.
   * Response 200: `{ ok, detail, provider, reinstalled, expiresAt, install?, mcpRepairedAt? }`.
   */
  repair: asyncHandler(async (req: Request, res: Response) => {
    const session = res.locals["user"] as
      | (McpTokenSession & { userId?: number })
      | undefined;
    if (!session) {
      res.status(401).json({ ok: false, error: apiErrorMessage(res.locals.locale, "authentication") });
      return;
    }

    // Re-resolve the connected server for this session. Fail-closed: if the
    // bridge can't be resolved the user genuinely isn't connected — surface a
    // typed 428 ("reconnect") instead of running against the panel host.
    let executor: Executor;
    try {
      executor = getExecutor(req);
    } catch {
      throw new BridgeSessionRequiredError(
        "No hay un servidor conectado que resolver. Reconéctate al servidor y reintenta la reparación.",
      );
    }

    const rawProvider = String((req.body as { provider?: unknown } | undefined)?.provider ?? "");
    const provider = isAssistantProviderId(rawProvider) ? rawProvider : undefined;
    const conversationId =
      typeof (req.body as { conversationId?: unknown } | undefined)?.conversationId === "string"
        ? (req.body as { conversationId: string }).conversationId
        : undefined;
    const mcpUrl = `${panelOriginFromRequest(req)}/api/ai/mcp`;

    const result = await mcpRepairService.repair({
      session,
      executor,
      mcpUrl,
      ...(provider ? { provider } : {}),
    });

    // Clear the sticky banner on the originating conversation (durable signal).
    let mcpRepairedAt: string | undefined;
    if (result.ok && conversationId) {
      const meta = await conversationsRepository.markMcpRepaired(executor, conversationId);
      mcpRepairedAt = meta?.mcpRepairedAt;
    }

    res.json({
      ok: result.ok,
      detail: result.detail,
      provider: result.provider,
      reinstalled: result.reinstalled,
      expiresAt: result.expiresAt,
      ...(result.install ? { install: result.install } : {}),
      ...(mcpRepairedAt ? { mcpRepairedAt } : {}),
    });
  }),
};

/** @internal — exported ONLY for unit tests (executor-resolution fallback matrix). */
export const __mcpControllerInternals = { resolveExecutor, McpSessionExpiredError };

// ── MCP config snippet generator ───────────────────────────────────────────

function buildCliMcpSnippet(args: {
  providerId: AssistantProviderId | null;
  token: string;
  panelOrigin: string;
}): { path: string; format: "json" | "toml"; snippet: string } | null {
  if (!args.providerId) return null;
  const url = `${args.panelOrigin}/api/ai/mcp`;
  switch (args.providerId) {
    case "claude":
      return {
        path: "~/.claude/mcp.json",
        format: "json",
        snippet: JSON.stringify(
          {
            mcpServers: {
              luxipanel: {
                transport: "http",
                url,
                headers: { Authorization: `Bearer ${args.token}` },
              },
            },
          },
          null,
          2,
        ),
      };
    case "codex":
      return {
        path: "~/.codex/config.toml",
        format: "toml",
        snippet:
          "# Append (or merge) under the `[mcp_servers.luxipanel]` table:\n" +
          `[mcp_servers.luxipanel]\n` +
          `url = "${url}"\n` +
          `http_headers = { Authorization = "Bearer ${args.token}" }\n`,
      };
    case "gemini":
      return {
        path: "~/.gemini/settings.json",
        format: "json",
        snippet: JSON.stringify(
          {
            mcpServers: {
              luxipanel: {
                httpUrl: url,
                headers: { Authorization: `Bearer ${args.token}` },
              },
            },
          },
          null,
          2,
        ),
      };
    case "deepseek":
      // No upstream CLI yet — generic JSON for whatever wrapper is in use.
      return {
        path: "(pendiente — DeepSeek no tiene CLI estable)",
        format: "json",
        snippet: JSON.stringify(
          {
            mcpServers: {
              luxipanel: {
                url,
                headers: { Authorization: `Bearer ${args.token}` },
              },
            },
          },
          null,
          2,
        ),
      };
    case "grok":
      // No upstream CLI yet — generic JSON for whatever wrapper is in use.
      return {
        path: "(pendiente — Grok no tiene CLI estable)",
        format: "json",
        snippet: JSON.stringify(
          {
            mcpServers: {
              luxipanel: {
                url,
                headers: { Authorization: `Bearer ${args.token}` },
              },
            },
          },
          null,
          2,
        ),
      };
    case "minimax":
      // MiniMax is API-only in the assistant; its `mmx` CLI is managed by the
      // Terminal module and isn't wired for the panel's MCP server.
      return null;
  }
}
