// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { moduleDiscoveryTools, moduleToolRunScope, executeModuleTool, MODULE_RUN_EXPIRED } from "./module-tools.service.js";
/**
 * Minimal MCP (Model Context Protocol) server — exposes the capability
 * registry to upstream CLIs (claude / codex / gemini) running on the
 * connected target so they can invoke panel actions from inside their
 * own session.
 *
 * Transport: JSON-RPC 2.0 over HTTP POST. No SSE (yet). The CLI is the
 * client; the panel is the server. Auth is `Authorization: Bearer <jwt>`
 * — the token carries `bridgeSessionId`, which the controller uses to
 * resolve the per-target executor before running each tool handler.
 *
 * Supported methods:
 *   - `initialize`                handshake
 *   - `notifications/initialized` ack (no response)
 *   - `tools/list`                list registered capabilities
 *   - `tools/call`                run a capability with input
 *
 * Reference: https://modelcontextprotocol.io/specification
 */

import {
  toOpenAiName,
  fromOpenAiName,
  type AgentTool,
} from "../../../shared/agent-capability/index.js";
import { assistantModulesService } from "./assistant-modules.service.js";
import { assistantAuditRepository } from "../repositories/assistant-audit.repository.js";
import { permissionPolicy } from "./permission-policy.js";
import { permissionBroker } from "./permission-broker.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { agentService } from "./agent.service.js";
import { buildTeamToolsForConversation } from "./team-tools.js";
import { buildSendMessageToolForConversation, SEND_MESSAGE_TOOL, READ_MESSAGE_TOOL } from "./agent-messages.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { MCP_INVALID_REQUEST, MCP_METHOD_NOT_FOUND } from "../../../shared/mcp/rpc-codes.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";

const log = createModuleLogger("assistant-mcp");

/**
 * Team delegation over the per-run cross channel (CLI leaders).
 *
 * The `team.*` tools are RUN-SCOPED (they anchor to the leader's conversation
 * and enforce the leader's own subordinate set), so they don't live in the
 * capability registry. When the cross channel carries a conversation
 * (`permissionConversationId`) whose bound agent is a leader, we resolve the
 * toolkit per call via `buildTeamToolsForConversation` and list/dispatch it
 * here — next to `permissions.approve`, the other channel-scoped tool.
 *
 * collect wait is capped at 240 s on this channel: a tools/call blocks one
 * HTTP request end-to-end and proxies in the path cut long-idle requests.
 * Longer work still lands: the leader ends its turn and the nudge
 * (AI_TEAM_LEADER_NUDGE → queued auto turn) re-wakes it — that path is
 * mode-agnostic (the drained turn goes back through the CLI bridge).
 */
const MCP_COLLECT_MAX_WAIT_S = 240;

/**
 * Diagnostic stub surfaced when a CLI leader's team channel SHOULD be reachable
 * but its per-run binding is gone — the run died (e.g. a backend restart) and
 * the detached CLI reconnected without the run's conversation, or the leader
 * chat's meta read transiently failed. Without it the leader SILENTLY loses
 * `team.assign`/`team.collect` and can't tell "I'm not a leader" (legit) from
 * "the channel dropped — retry from the panel" (transient). The `[…]` marker is
 * relayed verbatim by the CLI so the frontend / user can match it.
 */
const TEAM_UNAVAILABLE_TOOL = "team.unavailable";
const TEAM_UNAVAILABLE_MESSAGE =
  "El canal de coordinación de equipo (team.assign / team.collect) no está " +
  "disponible en esta conexión: el vínculo por-run con tu conversación de líder " +
  "se perdió (típicamente tras un reinicio del backend o una reconexión). NO " +
  "puedes asignar ni recolectar tareas en este turno y NO debes afirmar que " +
  "delegaste. Termina tu turno sin simular avance: el panel lo relanzará con un " +
  "canal nuevo (o el usuario puede escribir «continuar»). [TEAM_CHANNEL_UNAVAILABLE]";

/**
 * Outcome of resolving the run-scoped team toolkit for a cross channel:
 *  - `ready`       → the bound conversation is a leader chat; expose its tools.
 *  - `not-leader`  → meta read OK but the chat has no team toolkit (no agent /
 *                    not a supervisor / no subordinates). Legit — stay silent.
 *  - `unavailable` → the toolkit should be reachable but isn't (no per-run
 *                    conversation binding, or the meta read threw). Surface it.
 */
type TeamToolsResolution =
  | { state: "ready"; tools: AgentTool[] }
  | { state: "not-leader" }
  | { state: "unavailable"; reason: string };

async function resolveTeamTools(ctx: McpHandleContext): Promise<TeamToolsResolution> {
  // The cross channel is per-run: it MUST carry the leader run's conversation to
  // anchor the team toolkit. Missing it → the binding was lost (the run ended,
  // or the CLI reconnected with only its static `servers` token).
  if (!ctx.permissionConversationId) {
    return { state: "unavailable", reason: "no-conversation-binding" };
  }
  try {
    const built = await buildTeamToolsForConversation({
      executor: ctx.executor,
      user: ctx.user,
      userId: ctx.userId,
      conversationId: ctx.permissionConversationId,
      runAgent: (msgs, opts) => agentService.run(msgs, opts),
      maxCollectWaitS: MCP_COLLECT_MAX_WAIT_S,
    });
    // null = the bound conversation simply isn't a leader chat. Legit silence.
    if (!built) return { state: "not-leader" };
    return { state: "ready", tools: built.tools };
  } catch (err) {
    // A THROW (not a null) means the leader chat should be readable but the
    // executor/meta read failed — transient (e.g. stale bridge right after a
    // restart). Surface it so the leader retries instead of assuming no team.
    log.warn(
      { err: (err as Error).message, conversationId: ctx.permissionConversationId },
      "mcp: team tools resolution failed (transient) — surfacing team.unavailable",
    );
    return { state: "unavailable", reason: (err as Error).message };
  }
}

// ── Canal de mensajería asíncrona agente↔agente (`agents.send_message`) ──────
//
// RUN-SCOPED como el toolkit de equipo (resuelve al EMISOR desde la conversación
// del canal y solo admite sus agentes relacionados), así que no vive en el
// registro de capacidades. A diferencia de `team.*` NO exige permiso de
// supervisor: cualquier agente con relacionados puede hacer un handoff.
//
// Aplica EL MISMO principio que `team.unavailable` de arriba, y por la misma
// razón: resolver esto hace I/O contra el target, y `tools/list` se pide UNA
// sola vez por run. Cuando un fallo transitorio devolvía `null`, la tool
// desaparecía del listado SIN señal alguna y el agente concluía "canal caído"
// para todo el run — se rendía y escribía un HANDOFF.md en vez de reintentar.
// Una tool AUSENTE el modelo la lee como "esto no existe"; una tool que
// devuelve un error, como "reintenta". De ahí: reintento acotado, caché corta
// por conversación (un hipo puntual no ciega el run entero) y, si aun así
// falla, el stub `agents.unavailable`.
//
// La ausencia LEGÍTIMA (la conversación no está ligada a un agente con
// relacionados) sigue siendo una tool ausente, que es lo correcto: ahí no hay
// nada que reintentar.

const SEND_MESSAGE_UNAVAILABLE_TOOL = "agents.unavailable";
const SEND_MESSAGE_UNAVAILABLE_MESSAGE =
  "El canal de mensajería entre agentes no se pudo resolver en este momento " +
  "(fallo transitorio al leer el estado del servidor). NO es un fallo permanente " +
  "y NO significa que el destinatario no exista: vuelve a intentar el envío. " +
  "No escribas ficheros de handoff como sustituto del canal.";

const SEND_MESSAGE_CACHE_TTL_MS = 60_000;
const SEND_MESSAGE_RESOLVE_ATTEMPTS = 2;
const SEND_MESSAGE_RETRY_DELAY_MS = 250;

/** Resultado de resolver el canal para una conversación:
 *  - `ready`       → la tool está disponible.
 *  - `none`        → ausencia legítima (sin agente ligado / sin relacionados).
 *  - `unavailable` → fallo transitorio; se expone el stub para que reintente. */
type SendMessageResolution =
  | { state: "ready"; tool: AgentTool; readTool?: AgentTool }
  | { state: "none" }
  | { state: "unavailable"; reason: string };

const sendMessageCache = new Map<string, { at: number; tool: AgentTool; readTool?: AgentTool }>();

async function resolveSendMessageTool(ctx: McpHandleContext): Promise<SendMessageResolution> {
  const conversationId = ctx.permissionConversationId;
  if (!conversationId) return { state: "none" };

  const cacheKey = JSON.stringify([ctx.executor.target.id, ctx.userId ?? ctx.user?.userId ?? null, conversationId]);
  const cached = sendMessageCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SEND_MESSAGE_CACHE_TTL_MS) {
    return { state: "ready", tool: cached.tool, readTool: cached.readTool };
  }

  let lastError = "";
  for (let attempt = 1; attempt <= SEND_MESSAGE_RESOLVE_ATTEMPTS; attempt++) {
    try {
      const built = await buildSendMessageToolForConversation({
        executor: ctx.executor,
        user: ctx.user,
        userId: ctx.userId,
        conversationId,
      });
      // `null` = ausencia legítima, NO un fallo: ni reintentar ni publicar stub.
      if (!built?.tool) {
        sendMessageCache.delete(cacheKey);
        return { state: "none" };
      }
      sendMessageCache.set(cacheKey, { at: Date.now(), tool: built.tool, readTool: built.readTool });
      return { state: "ready", tool: built.tool, readTool: built.readTool };
    } catch (err) {
      lastError = (err as Error).message;
      if (attempt < SEND_MESSAGE_RESOLVE_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, SEND_MESSAGE_RETRY_DELAY_MS * attempt));
      }
    }
  }

  // Una entrada de caché aún válida vale más que un stub: si la resolución falló
  // pero hace <60s el canal existía, el agente puede seguir enviando. PERO la
  // tool cacheada captura en su closure el `executor`/`user` del momento: servir
  // una entrada CADUCADA rompería el invariante fail-closed de aislamiento
  // (escrituras al servidor previamente conectado). Exigimos frescura y purgamos
  // lo caducado.
  const stale = sendMessageCache.get(cacheKey);
  if (stale && Date.now() - stale.at < SEND_MESSAGE_CACHE_TTL_MS) {
    log.warn(
      { err: lastError, conversationId },
      "mcp: agents.send_message resolution failed — serving the cached channel",
    );
    return { state: "ready", tool: stale.tool, readTool: stale.readTool };
  }
  if (stale) sendMessageCache.delete(cacheKey);

  log.warn(
    { err: lastError, conversationId },
    "mcp: agents.send_message resolution failed — exposing the agents.unavailable stub",
  );
  return { state: "unavailable", reason: lastError };
}

/**
 * Internal MCP tool wired into the Claude CLI via `--permission-prompt-tool`.
 * It is NOT a capability-registry tool: it's listed/dispatched directly here,
 * bypassing the `allowedTools` gate, because it governs permission rather than
 * being a permissioned action itself. Claude calls it with `{ tool_name, input }`
 * and expects a JSON verdict `{ behavior: "allow"|"deny", … }` as the result.
 */
const PERMISSION_TOOL = "permissions.approve";

/** Build the JSON verdict payload the Claude CLI expects from a prompt tool. */
function permissionVerdict(
  decision: "allow" | "deny",
  input: Record<string, unknown>,
  denyMessage?: string,
): { content: Array<{ type: "text"; text: string }>; isError: boolean } {
  const payload =
    decision === "allow"
      ? { behavior: "allow", updatedInput: input }
      : { behavior: "deny", message: denyMessage ?? "Permiso denegado por el usuario." };
  // isError stays false: the prompt tool itself SUCCEEDED — the allow/deny
  // outcome is carried in the payload, per the permission-prompt-tool contract.
  return { content: [{ type: "text", text: JSON.stringify(payload) }], isError: false };
}

/** Run the interactive permission gate for one `permissions.approve` call. */
async function handlePermissionRequest(
  ctx: McpHandleContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError: boolean }> {
  const toolName = typeof args["tool_name"] === "string" ? (args["tool_name"] as string) : "";
  const input = (args["input"] ?? {}) as Record<string, unknown>;
  // No conversation channel to ask through → fail safe (deny). Without a live
  // run there's no UI to surface the prompt on.
  if (!ctx.permissionConversationId) {
    return permissionVerdict("deny", input);
  }
  // Read-only tools never interrupt the user.
  if (permissionPolicy.decide(toolName) === "allow") {
    return permissionVerdict("allow", input);
  }
  // Plan mode: defense in depth. Claude Code's native `--permission-mode plan`
  // already blocks mutating tools before they reach `permissions.approve`, so
  // this branch is normally inert. But if a future Claude Code release ever
  // forwards a mutating tool through the prompt tool under plan mode (or the
  // user adds one to `autoApproveTools` by mistake), this guard denies
  // unconditionally — plan mode must never mutate, regardless of the tool
  // allowlist. Read-only tools already returned above (`decide === "allow"`),
  // so any tool that reaches this branch is by definition mutating.
  const planApproval = agentRunRegistry.getApproval(ctx.permissionConversationId);
  if (planApproval?.mode === "plan") {
    return permissionVerdict("deny", input, "mutating tool blocked in plan mode");
  }
  // User's approval policy for this run (snapshotted at run start): "auto" mode
  // approves everything; a tool on the "never ask again" allowlist is approved
  // regardless of mode. Both skip the prompt entirely. Falls through to "ask"
  // when there's no snapshot (manual/plan, or an older run).
  const approval = agentRunRegistry.getApproval(ctx.permissionConversationId);
  if (approval && (approval.mode === "auto" || approval.autoApprove.has(toolName))) {
    return permissionVerdict("allow", input);
  }
  const { title, detail } = permissionPolicy.summarize(toolName, input);
  const decision = await permissionBroker.request({
    conversationId: ctx.permissionConversationId,
    tool: toolName,
    title,
    ...(detail ? { detail } : {}),
  });
  return permissionVerdict(decision, input);
}

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_SERVER_INFO = {
  name: "luxipanel-assistant",
  version: "1.0.0",
};

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const ERR_INTERNAL = -32603;

export interface McpHandleContext {
  moduleChannel?: boolean;
  executor: Executor;
  userId?: string;
  /** Identidad de la sesión que acuñó el token MCP. Gobierna QUÉ tools se
   *  listan e invocan (mismo `allowedTools` que el agente API-mode): sin esto
   *  las previews owner-only de module-dev se ocultaban incluso a su dueño en
   *  tools/list y, peor, tools/call despachaba sin ningún gate de owner. */
  user?: SessionUser;
  /** When set, only tools whose name starts with this prefix are listed /
   *  callable (e.g. "servers." for the per-run cross-server MCP channel). The
   *  hard gate is still `allowedTools` (role/sidecar); this just narrows it. */
  toolNamePrefix?: string;
  /** Graph channel: strip `toolNamePrefix` from the tool name emitted on the
   *  wire (and re-add it when a call comes back in). The CLI registers this
   *  server as `codebase-graph`, so a `graph.search_graph` tool must go out as
   *  `search_graph` → `mcp__codebase-graph__search_graph`, which is exactly the
   *  pre-approval flag cli-specs generates. Without stripping the wire name is
   *  `graph__search_graph` and the flag never matches (graph reads never
   *  pre-approved in manual mode). */
  stripToolPrefixOnWire?: boolean;
  /** Cross channel only: the conversation this per-run channel belongs to. When
   *  present, the `permissions.approve` tool is exposed (and routed to the
   *  permission broker) so the Claude CLI's `--permission-prompt-tool` can ask
   *  the user before each mutating action. Absent → no interactive approval
   *  (the approve tool isn't listed and, if called, fails safe to deny). */
  permissionConversationId?: string;
}

function makeError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Wire name for a capability tool, honoring `stripToolPrefixOnWire`. */
function wireNameFor(ctx: McpHandleContext, realName: string): string {
  if (ctx.stripToolPrefixOnWire && ctx.toolNamePrefix && realName.startsWith(ctx.toolNamePrefix)) {
    return toOpenAiName(realName.slice(ctx.toolNamePrefix.length));
  }
  return toOpenAiName(realName);
}

/** Inverse of {@link wireNameFor}: reconstruct the real (prefixed) tool name
 *  from an incoming wire name on a prefix-stripping channel. */
function realNameFromWire(ctx: McpHandleContext, wireName: string): string {
  const name = fromOpenAiName(wireName);
  if (ctx.stripToolPrefixOnWire && ctx.toolNamePrefix && !name.startsWith(ctx.toolNamePrefix)) {
    return ctx.toolNamePrefix + name;
  }
  return name;
}

type McpToolDescriptor = {
  name: string; description: string; inputSchema: object;
  annotations?: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
};

async function listTools(
  ctx: McpHandleContext,
): Promise<{ tools: McpToolDescriptor[] }> {
  // Honor the per-target access sidecar AND the session identity: the
  // owner-only marketplace previews are visible only to their dev, and
  // role-gated tools follow the same rules as the API-mode agent.
  const runScope = ctx.permissionConversationId && ctx.user ? moduleToolRunScope(ctx.permissionConversationId, ctx.executor, ctx.user) : undefined;
  if (ctx.moduleChannel && !runScope) return { tools: [] };
  const all = ctx.moduleChannel ? moduleDiscoveryTools({ executor: ctx.executor, user: ctx.user, conversationId: ctx.permissionConversationId, allowlists: runScope?.allowlists, agentId: runScope?.agentId, signal: runScope?.signal }) : await assistantModulesService.allowedTools(null /* uses ALS executor */, ctx.user);
  const allowed = ctx.toolNamePrefix ? all.filter((t) => t.name.startsWith(ctx.toolNamePrefix!)) : all;
  const tools: McpToolDescriptor[] = allowed.map((t) => ({
    // MCP tool names match the same regex as OpenAI (no dots). Use the
    // same `__` mapping so the round-trip is symmetric. On a prefix-stripping
    // channel (graph) the prefix is removed so the wire name matches the CLI's
    // pre-approval flag.
    name: wireNameFor(ctx, t.name),
    description: t.description,
    // Preserve the capability contract on the MCP wire. Otherwise read-only
    // discovery is treated as an unknown action by clients such as Codex.
    annotations: {
      readOnlyHint: t.kind === "read" && !t.dangerous,
      destructiveHint: t.kind !== "read" || Boolean(t.dangerous),
      idempotentHint: t.kind === "read" && !t.dangerous,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      properties: t.inputSchema.properties ?? {},
      required: t.inputSchema.required ?? [],
    } as object,
  }));
  // Expose the permission-prompt tool on the cross channel so the Claude CLI can
  // resolve `--permission-prompt-tool mcp__luxipanel-servers__permissions__approve`.
  // It bypasses `allowedTools` (it governs permission, it isn't a permissioned
  // action). Listed on EVERY cross call — even an ephemeral chat with no
  // conversation must advertise it so the CLI doesn't error on a missing prompt
  // tool; the handler then fails safe to deny when there's no channel to ask.
  //
  // OMIT in `auto` mode: the bridge launches the CLI with
  // `--dangerously-skip-permissions` and never invokes the prompt tool.
  // Advertising it anyway is dead surface and would let a future Claude Code
  // release that probes for it fall into the broker by accident. If the
  // approval snapshot is missing (ephemeral / older run) we keep listing it —
  // the handler fail-safes to deny anyway, which is the safe default.
  if (ctx.toolNamePrefix === "servers.") {
    const approval = ctx.permissionConversationId
      ? agentRunRegistry.getApproval(ctx.permissionConversationId)
      : null;
    if (approval?.mode !== "auto") {
      tools.push({
        name: toOpenAiName(PERMISSION_TOOL),
        description:
          "Internal permission gate. The CLI calls this before a tool that may " +
          "mutate the server; returns a JSON verdict {behavior:'allow'|'deny'}.",
        inputSchema: {
          type: "object",
          properties: {
            tool_name: { type: "string" },
            input: { type: "object" },
          },
          required: ["tool_name"],
        },
      });
    }
    // Team toolkit (CLI leaders): channel-scoped like permissions.approve —
    // listed only when the channel's conversation is bound to a leader agent.
    const team = await resolveTeamTools(ctx);
    if (team.state === "ready") {
      for (const t of team.tools) {
        tools.push({
          name: toOpenAiName(t.name),
          description: t.description,
          inputSchema: {
            type: "object",
            properties: t.inputSchema.properties ?? {},
            required: t.inputSchema.required ?? [],
          } as object,
        });
      }
    } else if (team.state === "unavailable") {
      // Don't drop the toolkit SILENTLY: a leader that lost its per-run binding
      // would otherwise see no team.* and no reason why. Expose a stub so the
      // model can tell "channel dropped — retry from panel" from "not a leader".
      log.warn(
        { conversationId: ctx.permissionConversationId ?? null, reason: team.reason, userId: ctx.userId },
        "mcp: team toolkit unavailable on cross channel — exposing team.unavailable stub",
      );
      tools.push({
        name: toOpenAiName(TEAM_UNAVAILABLE_TOOL),
        description:
          "Estado del canal de equipo. Aparece SOLO cuando la coordinación de " +
          "equipo NO está disponible en esta conexión (se perdió el vínculo " +
          "por-run con tu conversación de líder). Si eres líder de proyecto: NO " +
          "puedes delegar en este turno; termina sin afirmar que asignaste — el " +
          "panel lo relanzará. Llama esta tool para ver la guía completa.",
        inputSchema: { type: "object", properties: {}, required: [] },
      });
    }
    // team.state === "not-leader" → nothing (this connection has no team toolkit).

    // Canal de mensajes agente↔agente. Se lista cuando la conversación del canal
    // está ligada a un agente CON relacionados (sin gate de líder). Si la
    // resolución falla de forma transitoria se lista el stub en su lugar, para
    // que el modelo reintente en vez de dar el canal por muerto.
    const send = await resolveSendMessageTool(ctx);
    if (send.state === "ready") {
      tools.push({
        name: toOpenAiName(send.tool.name),
        description: send.tool.description,
        inputSchema: {
          type: "object",
          properties: send.tool.inputSchema.properties ?? {},
          required: send.tool.inputSchema.required ?? [],
        } as object,
      });
      if (send.readTool) tools.push({ name: toOpenAiName(send.readTool.name), description: send.readTool.description,
        inputSchema: send.readTool.inputSchema as object });
    } else if (send.state === "unavailable") {
      tools.push({
        name: toOpenAiName(SEND_MESSAGE_UNAVAILABLE_TOOL),
        description:
          "Estado del canal de mensajería entre agentes. Aparece SOLO cuando el " +
          "canal NO se pudo resolver (fallo transitorio). Llama a esta tool para " +
          "reintentar; si vuelve a fallar, informa al usuario. NO la uses como " +
          "sustituto de enviar el mensaje, ni escribas ficheros de handoff.",
        inputSchema: { type: "object", properties: {}, required: [] } as object,
      });
    }
    // send.state === "none" → nada (esta conversación no tiene agentes relacionados).
  }
  return { tools };
}

async function callTool(
  ctx: McpHandleContext,
  wireName: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError: boolean }> {
  const realName = realNameFromWire(ctx, wireName);
  // Permission-prompt tool: handled directly (not a capability-registry tool).
  if (ctx.moduleChannel) {
    const runScope = ctx.permissionConversationId && ctx.user ? moduleToolRunScope(ctx.permissionConversationId, ctx.executor, ctx.user) : undefined;
    if (!runScope) return { content: [{ type: "text", text: JSON.stringify(MODULE_RUN_EXPIRED) }], isError: true };
    const tool = moduleDiscoveryTools({ executor: ctx.executor, user: ctx.user, conversationId: ctx.permissionConversationId, allowlists: runScope.allowlists, agentId: runScope.agentId, signal: runScope.signal }).find(tool => tool.name === realName);
    if (!tool) return { content: [{ type: "text", text: "Unknown module gateway" }], isError: true };
    const result = await tool.handler(args);
    return { content: [{ type: "text", text: asText(result.output) }], isError: !result.ok };
  }
  // Resolved BEFORE the allowedTools gate since it governs permission itself.
  if (realName === PERMISSION_TOOL) {
    return handlePermissionRequest(ctx, args);
  }
  // Team toolkit (CLI leaders): channel-scoped, resolved per call from the
  // channel's conversation → its leader agent. NOT in the capability registry
  // (run-scoped semantics); gated by the leader's own subordinates +
  // supervisor permission inside `buildTeamToolsForConversation`.
  if (realName.startsWith("team.") && ctx.toolNamePrefix === "servers.") {
    const team = await resolveTeamTools(ctx);
    if (team.state === "ready") {
      const teamTool = team.tools.find((t) => t.name === realName);
      if (teamTool) {
        const startedAt = Date.now();
        try {
          const result = await teamTool.handler(args);
          const text = asText(result.output);
          void assistantAuditRepository.append(
            {
              ts: new Date().toISOString(),
              provider: "mcp:cross",
              tool: realName,
              success: result.ok,
              durationMs: Date.now() - startedAt,
              userId: ctx.userId,
              outputPreview: text.slice(0, 200),
            },
            ctx.executor,
          );
          return { content: [{ type: "text", text }], isError: !result.ok };
        } catch (err) {
          const message = (err as Error).message ?? "tool execution failed";
          return { content: [{ type: "text", text: message }], isError: true };
        }
      }
    }
    // Channel dropped its per-run binding (or the model called the diagnostic
    // stub): return an ACTIONABLE verdict, not a bare "Unknown tool", so the
    // leader ends its turn cleanly instead of hallucinating a dispatch.
    if (team.state === "unavailable" || realName === TEAM_UNAVAILABLE_TOOL) {
      return { content: [{ type: "text", text: TEAM_UNAVAILABLE_MESSAGE }], isError: true };
    }
    // not-leader, or an unknown team.* name on a genuine leader channel.
    return { content: [{ type: "text", text: `Unknown tool: ${realName}` }], isError: true };
  }

  // Canal de mensajes agente↔agente: channel-scoped como team.*, resuelto por
  // llamada desde la conversación del canal → su agente ligado (el EMISOR). La
  // allowlist de destinatarios la aplican la propia tool y agentMessagesService.
  if (
    (realName === SEND_MESSAGE_TOOL || realName === READ_MESSAGE_TOOL || realName === SEND_MESSAGE_UNAVAILABLE_TOOL) &&
    ctx.toolNamePrefix === "servers."
  ) {
    const send = await resolveSendMessageTool(ctx);
    if (send.state !== "ready") {
      // Transitorio (`unavailable`) o ausencia legítima (`none`): en ambos casos
      // el mensaje es explícito y accionable — nunca una tool que se esfuma.
      const text =
        send.state === "unavailable"
          ? SEND_MESSAGE_UNAVAILABLE_MESSAGE
          : "El canal de mensajería entre agentes no está disponible en esta conexión: " +
            "la conversación no está ligada a un agente con agentes relacionados " +
            "(subordinado, conexión o superior).";
      return { content: [{ type: "text", text }], isError: true };
    }
    // El modelo llamó al stub y el canal ya se recuperó: decírselo para que
    // reintente el envío de verdad.
    if (realName === SEND_MESSAGE_UNAVAILABLE_TOOL) {
      return {
        content: [
          {
            type: "text",
            text:
              "El canal de mensajería entre agentes ya está disponible de nuevo. " +
              `Reintenta el envío con \`${SEND_MESSAGE_TOOL}\`.`,
          },
        ],
        isError: false,
      };
    }
    const startedAt = Date.now();
    try {
      const tool = realName === READ_MESSAGE_TOOL ? send.readTool : send.tool;
      if (!tool) return { content: [{ type: "text", text: "Herramienta no disponible en este contexto." }], isError: true };
      const result = await tool.handler(args);
      const text = asText(result.output);
      void assistantAuditRepository.append(
        {
          ts: new Date().toISOString(),
          provider: "mcp:cross",
          tool: realName,
          success: result.ok,
          durationMs: Date.now() - startedAt,
          userId: ctx.userId,
          outputPreview: text.slice(0, 200),
        },
        ctx.executor,
      );
      return { content: [{ type: "text", text }], isError: !result.ok };
    } catch (err) {
      const message = (err as Error).message ?? "tool execution failed";
      return { content: [{ type: "text", text: message }], isError: true };
    }
  }

  // Dispatch SOLO dentro del mismo conjunto que tools/list expone para esta
  // identidad (sidecar per-target + rol + owner-gate de previews). Antes se
  // resolvía directo del registry: cualquier token MCP del panel podía invocar
  // por nombre las tools del preview de OTRO dev.
  const allowed = await assistantModulesService.allowedTools(null /* ALS executor */, ctx.user);
  const inScope = !ctx.toolNamePrefix || realName.startsWith(ctx.toolNamePrefix);
  const tool: AgentTool | undefined = inScope ? allowed.find((t) => t.name === realName) : undefined;
  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${realName}` }],
      isError: true,
    };
  }
  const startedAt = Date.now();
  // `servers.*` tools write their OWN rich cross-server access record (with the
  // target host, linux user, key fingerprint…), so skip the generic entry here
  // to avoid a duplicate line in the Access tab.
  const auditGeneric = !realName.startsWith("servers.");
  try {
    const result = await executeModuleTool(realName, args, { executor: ctx.executor, user: ctx.user, conversationId: ctx.permissionConversationId });
    const text = asText(result.output);
    if (auditGeneric) {
      void assistantAuditRepository.append(
        {
          ts: new Date().toISOString(),
          provider: "mcp:loopback",
          tool: realName,
          success: result.ok,
          durationMs: Date.now() - startedAt,
          userId: ctx.userId,
          outputPreview: text.slice(0, 200),
        },
        ctx.executor,
      );
    }
    return {
      content: [{ type: "text", text }],
      isError: !result.ok,
    };
  } catch (err) {
    const message = (err as Error).message ?? "tool execution failed";
    if (auditGeneric) {
      void assistantAuditRepository.append(
        {
          ts: new Date().toISOString(),
          provider: "mcp:loopback",
          tool: realName,
          success: false,
          durationMs: Date.now() - startedAt,
          userId: ctx.userId,
          outputPreview: message.slice(0, 200),
        },
        ctx.executor,
      );
    }
    return {
      content: [{ type: "text", text: message }],
      isError: true,
    };
  }
}

export const mcpServerService = {
  /**
   * Dispatch a single JSON-RPC request. Caller is responsible for having
   * already pinned the per-target executor via `runWithExecutor`.
   * Returns `null` for notification methods (no response expected).
   */
  async handle(
    req: JsonRpcRequest,
    ctx: McpHandleContext,
  ): Promise<JsonRpcResponse | null> {
    if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
      return makeError(req.id ?? null, MCP_INVALID_REQUEST, "Invalid JSON-RPC envelope");
    }
    const id = req.id ?? null;

    log.debug({ method: req.method, hasParams: Boolean(req.params) }, "MCP request");

    try {
      switch (req.method) {
        case "initialize":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: {
                tools: { listChanged: false },
              },
              serverInfo: MCP_SERVER_INFO,
            },
          };
        case "notifications/initialized":
        case "notifications/cancelled":
          // Notification — no response.
          return null;
        case "ping":
          return { jsonrpc: "2.0", id, result: {} };
        case "tools/list":
          return { jsonrpc: "2.0", id, result: await listTools(ctx) };
        case "tools/call": {
          const params = req.params ?? {};
          const name = typeof params["name"] === "string" ? (params["name"] as string) : "";
          const args = (params["arguments"] ?? {}) as Record<string, unknown>;
          if (!name) return makeError(id, MCP_INVALID_REQUEST, "Missing tool name");
          return {
            jsonrpc: "2.0",
            id,
            result: await callTool(ctx, name, args),
          };
        }
        default:
          return makeError(id, MCP_METHOD_NOT_FOUND, `Method not found: ${req.method}`);
      }
    } catch (err) {
      log.error({ err, method: req.method }, "MCP handler crashed");
      return makeError(id, ERR_INTERNAL, (err as Error).message ?? "internal error");
    }
  },
};
