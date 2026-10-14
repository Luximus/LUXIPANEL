// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { redactModuleData } from "../../../shared/module-operations/redact.js";
import { moduleDiscoveryTools, bindModuleToolRun } from "./module-tools.service.js";
import { mintModuleMcpToken } from "./mcp-run-tokens.js";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/registry.js";
/**
 * Agent dispatcher — picks the right provider per the per-target sidecar,
 * loads the capability tools allowed for that target, and streams events
 * back to the SSE controller.
 *
 * The previous env-driven implementation (AI_PROVIDER / AI_API_KEY / AI_MODEL)
 * is retired. Configuration now lives in `assistant/config.json` per target.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { getContextExecutor, setContextFileJail } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { resolveAgentRunModel, resolveAgentRunProvider, type AssistantProviderId } from "../models/assistant-config.types.js";
import { assistantAuditRepository } from "../repositories/assistant-audit.repository.js";
import { assistantModulesService } from "./assistant-modules.service.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { agentRolesRepository } from "../repositories/agent-roles.repository.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import type { AssistantAgent } from "../models/assistant-agent.types.js";
import type { AssistantRole } from "../models/assistant-role.types.js";
import { buildProvider, ProviderUnavailableError } from "./providers/provider-factory.js";
import { modelSupportsVision, modelSupportsPdf } from "./providers/vision.js";
import { classifyComplexity, clampTier, resolveModel, effortForTier, type RoutingDecision } from "./auto-router.service.js";
import { orchestratorService, hasMutatingTools } from "./orchestrator.service.js";
import { slashCommandsService } from "./slash-commands.service.js";
import { normalizeAllowedTools } from "./tool-allowlist.js";
import { buildSystemPrompt } from "./system-prompt-builder.js";
import { resolveCrossChannelOrigin } from "./cross-channel-origin.js";
import type {
  AgentEvent,
  AgentMessage,
  AgentProvider,
} from "./providers/provider.types.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

export type { AgentEvent, AgentMessage } from "./providers/provider.types.js";

const log = createModuleLogger("ai-agent");

export interface AgentRunOptions {
  /** Trusted background callers may narrow tools even after prompt assembly. */
  toolAllowlist?: readonly string[];
  /** Strict repairs never use a CLI shell outside the scoped capability tools. */
  requireApiMode?: boolean;
  /** When true (default), prepends a system snapshot to the prompt. */
  withContext?: boolean;
  /** Optional AbortSignal — wires through to the provider's fetch / spawn. */
  signal?: AbortSignal;
  /** Pass-through executor when callers want to override the request scope. */
  executor?: Executor | null;
  /** Optional caller id stored on audit entries. */
  userId?: string;
  /** Logged-in user — gates which tools/modes the agent may use by role. */
  user?: SessionUser;
  /** Override which provider handles this run (multi-provider tabs). */
  providerId?: AssistantProviderId;
  /**
   * Override the model for THIS run only (never persisted). Lets callers like
   * the scheduled AI-agent jobs pick a model per job without mutating the
   * Assistant's saved provider config.
   */
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh";
  /** Project whose path (cwd) + instructions scope this run. */
  projectId?: string;
  /**
   * Custom agent (CLI-subagent style) driving this run: its system prompt is
   * injected, its `allowedTools` narrow the tool set, and its provider/model act
   * as a layer between the explicit per-run override and the saved config
   * (precedence: explicit `providerId`/`model` > agent > config). Fail-open: an
   * unknown/deleted id is ignored and the run proceeds without agent overrides.
   */
  agentId?: string;
  /**
   * Explicit working directory for this run (e.g. a git project path detected
   * by the Files module). A resolved `projectId` path takes precedence.
   */
  cwd?: string;
  /**
   * cwd FORZADO que GANA sobre el path del proyecto (worktree de una tarea de
   * equipo): el run conserva projectId (instrucciones/vault/grafo) pero
   * trabaja en esta ruta. Es el inverso de `cwd`, al que project.path pisa.
   */
  forcedCwd?: string;
  /** Conversation id — CLI providers use it to resume the upstream session. */
  conversationId?: string;
  /** Files attached to the latest user message. */
  attachments?: { name: string; mimeType: string; dataBase64: string }[];
  /**
   * Background-translation is active for this run: the user's message was
   * already translated to English upstream, and the final answer will be
   * translated back to their language. The agent must therefore THINK, narrate
   * tool usage and answer entirely in English — overriding the default Spanish
   * directive — so the live CLI terminal shows real English work and the
   * translation layer isn't a Spanish→Spanish no-op.
   */
  outputEnglish?: boolean;
  /** Panel origin (`https://host`) of the request that started this run, used
   *  to build the target→panel cross-server MCP URL. */
  panelOrigin?: string;
  /** Short-lived cross-scoped MCP token minted for this run (servers.* only).
   *  Attached to the Claude CLI when the project has associated servers. */
  crossMcpToken?: string;
  /** Short-lived graph-scoped MCP token minted for this run. Carries the SIGNED
   *  conversationId, which is what binds every graph call to this run's agent
   *  (and therefore to its project scope). Attached to any CLI run whose scope
   *  has an indexed project. */
  graphMcpToken?: string;
  /**
   * Recursion depth of inter-agent delegation (agents.delegate tool). The
   * top-level chat run is 0; each delegated sub-run increments it. Used to cap
   * delegation chains and to stop exposing the delegate tool past the limit.
   */
  delegationDepth?: number;
  /**
   * Per-call override of the assistant's approval mode (manual/auto/plan).
   * Callers: background runs (scheduled AI-agent jobs, security-audit) that
   * must NOT inherit the interactive user's `auto` setting — a cron job that
   * ran "fix the staging config" with `--dangerously-skip-permissions` would
   * be a disaster — and the plan-approval resume (`planDecision:"approve"`),
   * which overrides the persisted "plan" with "manual" for ONE turn so the
   * approved plan can execute behind the per-action gate. When omitted, the
   * user's persisted `config.approval.mode` applies. The permission-gate
   * snapshot, the system prompt and the CLI bridge all read the EFFECTIVE mode.
   */
  approvalModeOverride?: "auto" | "manual" | "plan";
}

export const agentService = {
  async *run(
    messages: AgentMessage[],
    options: AgentRunOptions = {},
  ): AsyncGenerator<AgentEvent> {
    const { withContext = true, signal, executor, userId, user, providerId, model, projectId, agentId, conversationId, attachments, outputEnglish, cwd: cwdOverride, forcedCwd, panelOrigin, crossMcpToken, graphMcpToken, delegationDepth = 0 } = options;

    // EFFECTIVE per-server executor. Production conversation runs never pass
    // `options.executor` — the run registry pins it via AsyncLocalStorage and
    // repositories resolve it implicitly — while direct callers (cron,
    // delegation sub-runs, tests) pass it explicitly. The delegation/team
    // wiring needs the REAL executor object (it pins spawned worker runs into
    // detached scopes), so resolve it ONCE here. Trusting `options.executor`
    // alone silently disabled `agents.delegate`/`chats.create`/`team.*` in
    // every production web run (gate saw `executor: undefined`).
    const runExecutor: Executor | null = executor ?? getContextExecutor();

    const config = await assistantConfigRepository.load(executor);
    if (!config.enabled) {
      yield { type: "error", message: "El asistente IA no está habilitado en este servidor." };
      return;
    }

    // Approval mode EFFECTIVE for this run (per-turn override wins over the
    // persisted config — see AgentRunOptions.approvalModeOverride).
    const conversation = conversationId ? await conversationsRepository.getMeta(runExecutor, conversationId) : null;
    const effectiveApprovalMode = options.approvalModeOverride ?? (conversationId ? conversation?.approvalMode ?? "manual" : config.approval.mode);

    // Snapshot the approval policy into the run registry so the permission gate
    // (mcp-server.handlePermissionRequest) reads mode + the "never ask again"
    // allowlist in-memory, with no SSH round-trip per ask. Only a
    // conversation-keyed run has a permission channel; ephemeral/delegated runs
    // never surface the prompt, so the snapshot is harmless there. Uses the
    // EFFECTIVE mode: on the plan-approved turn the gate must ask per action.
    if (conversationId) {
      agentRunRegistry.setApproval(conversationId, {
        mode: effectiveApprovalMode,
        autoApproveTools: config.approval.autoApproveTools,
      });
    }

    // Custom agent driving this run (chat bound to an agent, or a cron job that
    // selected one). PANEL-HOST/global store. Fail-open: an unknown/deleted id
    // is ignored so the run never breaks. Provider/model precedence applied
    // below; allowedTools narrows the set; the system prompt is injected later.
    let agent: AssistantAgent | null = null;
    if (agentId) {
      try {
        agent = await agentsRepository.get(agentId);
      } catch (err) {
        log.warn({ err, agentId }, "Failed to load custom agent — running without it");
      }
    }
    // Assigned role (reusable profile): layered UNDER the agent — its system
    // prompt is injected first and its allowedTools narrow the set too. Fail-open:
    // an unknown/deleted roleId is ignored.
    let role: AssistantRole | null = null;
    if (agent?.roleId) {
      try {
        role = await agentRolesRepository.get(agent.roleId);
      } catch (err) {
        log.warn({ err, roleId: agent.roleId }, "Failed to load agent role — running without it");
      }
    }

    // Slash command del turno actual (/help, /mod, /provider…). Único
    // call-site del servicio: handled → respuesta directa sin tocar el
    // provider; rewrite (verbos /mod) → se sustituye el texto del turno y el
    // run sigue para que el modelo invoque la tool module-dev.* indicada.
    let effectiveMessages = messages;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser && slashCommandsService.isSlash(lastUser.content)) {
      try {
        const slash = await slashCommandsService.handle(lastUser.content, { executor, projectId, user });
        if (slash.handled) {
          if (slash.text) yield { type: "text", delta: slash.text };
          yield { type: "done" };
          return;
        }
        if (slash.rewrite) {
          effectiveMessages = messages.map((m) =>
            m === lastUser ? { ...m, content: slash.rewrite as string } : m,
          );
        }
      } catch (err) {
        // Nunca rompemos el run por un slash: se reenvía el mensaje tal cual.
        log.warn({ err }, "Slash command handling failed — forwarding raw message");
      }
    }

    // Resolve the tool set up-front: the auto-router uses the tool count as a
    // (mild) complexity signal, and the model must be chosen BEFORE buildProvider.
    let tools = await assistantModulesService.permittedTools(executor, user);
    const moduleAllowlists: (readonly string[] | null | undefined)[] = [];
    // The role's and the agent's allowlists can only NARROW the already-permitted
    // set (intersection of whatever restrictions exist). The role caps what its
    // agents may ever touch; the agent narrows further. `null`/absent = no cap.
    // Los sidecars pueden traer nombres legacy (files.list, terminal.run…):
    // se normalizan contra el registro para que el agente conserve las tools
    // que su diseñador quiso darle en vez de intersecar a vacío.
    for (const allowList of [role?.allowedTools, agent?.allowedTools, options.toolAllowlist]) {
      if (allowList) {
        const norm = normalizeAllowedTools([...allowList], { onUnknown: "drop", context: "agent-run" });
        const allow = new Set(norm ? norm.valid : allowList);
        moduleAllowlists.push([...allow]);
        tools = tools.filter((t) => allow.has(t.name));
      }
    }

    // An explicit provider changes only this run. Its model is independent of
    // the agent's saved model, which belongs to the agent's own provider.
    const modelOverride = (model && model.trim()) ? model : undefined;
    const effProviderId = resolveAgentRunProvider(providerId, modelOverride, agent?.providerId);
    const effModel = resolveAgentRunModel(modelOverride, agent?.model, effProviderId, agent?.providerId);
    const effId = effProviderId ?? config.activeProvider;

    // LEADER runs need the panel's API tool loop (team.plan/assign/collect —
    // the whole coordinate-and-delegate flow). When the agent is a leader
    // (direct subordinates + supervisor permission) but its provider slot is
    // configured in CLI mode, coordination silently degrades: only the claude
    // CLI has the cross-MCP team channel — codex/minimax CLIs have no panel
    // tool loop at all (first real-world test: a codex-CLI leader answered a
    // team-sized task entirely by itself). If the slot has an API key, force
    // THIS run to API mode (in-memory patch only, same pattern as the model
    // overrides below): the leader coordinates via API; its WORKERS keep
    // whatever mode their own providers are configured with. Without an API
    // key we keep CLI and log why the team tools are absent.
    let forcedApiForLeader = false;
    if (agent && (agent.canSpawnChats || role?.canSpawnChats) && delegationDepth === 0) {
      const slot = config.providers[effId];
      if (slot?.mode === "cli" && effId !== "claude") {
        try {
          const allForLeaderCheck = await agentsRepository.list();
          const hasSubordinates = allForLeaderCheck.some((a) => a.id && a.parentAgentId === agent.id);
          if (hasSubordinates) {
            if (slot.api?.apiKey) {
              config.providers[effId] = { ...slot, mode: "api" };
              forcedApiForLeader = true;
              log.info(
                { agentId: agent.id, provider: effId },
                "leader run: CLI slot forced to API mode (team tools require the panel tool loop)",
              );
            } else {
              log.warn(
                { agentId: agent.id, provider: effId },
                "leader agent on a CLI-mode provider without API key — team tools unavailable this run",
              );
            }
          }
        } catch (err) {
          log.warn({ err }, "leader API-mode check failed — keeping configured mode");
        }
      }
    }

    // Model / effort / multi-agent selection.
    //  - An explicit per-run `model` (scheduled AI-agent jobs) always wins.
    //  - Otherwise, when auto-routing is enabled and the active provider is in
    //    API mode, the heuristic router picks the model + reasoning effort +
    //    whether to deploy multiple agents. CLI mode keeps its own `--model`.
    // Patches the in-memory config only — never persisted back to the sidecar.
    const hasAttachments = (attachments?.length ?? 0) > 0;
    let runEffort: "low" | "medium" | "high" | "xhigh" | undefined;
    let decision: RoutingDecision | undefined;
    if (effModel) {
      const slot = config.providers[effId];
      if (slot?.api) slot.api = { ...slot.api, model: effModel };
      // CLI mode reads the model from the CLI slot (provider-factory →
      // `--model`/env). Without this, the per-turn selection only applied to
      // API mode and CLI runs silently kept the slot's configured default.
      if (slot?.cli) slot.cli = { ...slot.cli, model: effModel };
    } else if (config.autoRouting?.enabled !== false && config.providers[effId]?.mode === "api") {
      const maxTier = config.autoRouting?.maxTier ?? "max";
      const d = classifyComplexity(effectiveMessages, {
        attachments: attachments?.length ?? 0,
        toolCount: tools.length,
        conversationTurns: effectiveMessages.length,
      });
      const tier = clampTier(d.tier, maxTier);
      const routedModel = resolveModel(effId, tier, hasAttachments);
      const slot = config.providers[effId];
      if (slot?.api) slot.api = { ...slot.api, model: routedModel };
      runEffort = effortForTier(tier);
      // multiAgent requires tier "max"; after clamping to maxTier it may not hold.
      decision = { tier, multiAgent: tier === "max" && d.multiAgent, reasons: d.reasons };
      log.info(
        { provider: effId, tier, model: routedModel, multiAgent: decision.multiAgent, reasons: d.reasons },
        "auto-router decision",
      );
    }
    // A composer choice applies to this turn only and wins over auto routing.
    const savedEffort = !providerId || providerId === conversation?.provider ? conversation?.effort : undefined;
    if (options.effort || savedEffort) runEffort = options.effort || savedEffort || undefined;

    // Agent explicitly set to multi-agent → force the orchestrator (API only),
    // regardless of auto-routing. Fan-out spreads across the agent's providers.
    if (agent?.agentMode === "multi" && config.providers[effId]?.mode === "api") {
      const maxTier = config.autoRouting?.maxTier ?? "max";
      decision = {
        tier: clampTier(decision?.tier ?? "high", maxTier),
        multiAgent: true,
        reasons: [...(decision?.reasons ?? []), "agent:multi"],
      };
    }

    let provider: AgentProvider;
    try {
      provider = buildProvider(config, effProviderId);
    } catch (err) {
      const message =
        err instanceof ProviderUnavailableError
          ? err.message
          : (err as Error).message || "No se pudo inicializar el proveedor IA.";
      yield { type: "error", message };
      return;
    }

    if (options.requireApiMode && provider.mode !== "api") {
      yield { type: "error", message: "Las reparaciones de Logs requieren un proveedor en modo API para limitar el acceso al worktree." };
      return;
    }

    // CLI mode runs an autonomous agent with a target shell — restricted to
    // panel admins. Non-admins must use API mode (tools are gated by role).
    if (provider.mode === "cli" && user && user.kind !== "admin") {
      yield {
        type: "error",
        message: "El modo CLI del asistente está reservado a administradores. Usa un proveedor en modo API.",
      };
      return;
    }

    // Stable system prompt (cacheable prefix) + volatile context + run-scoped
    // tool additions (ask/delegate/team), project cwd and file-jail paths —
    // assembled by the extracted builder. Block ordering and the
    // stable/volatile split are prompt-cache invariants (see
    // system-prompt-builder.ts).
    const built = await buildSystemPrompt({
      executor: runExecutor,
      user,
      userId,
      config,
      effectiveApprovalMode,
      provider,
      tools,
      agent,
      role,
      projectId,
      cwdOverride,
      forcedCwd,
      conversationId,
      withContext,
      outputEnglish,
      panelOrigin,
      crossMcpToken,
      delegationDepth,
      signal,
      runAgent: (msgs, opts) => agentService.run(msgs, opts),
    });
    tools = built.tools;
    if (options.toolAllowlist) tools = tools.filter((tool) => options.toolAllowlist!.includes(tool.name));
    const moduleScope = { executor: runExecutor, user, conversationId, agentId, signal, allowlists: moduleAllowlists };
    tools = [...tools.filter(tool => !agentCapabilityRegistry.findTool(tool.name)), ...moduleDiscoveryTools(moduleScope)];
    const { systemContext, cwd, jailPaths, cliTeamLeader } = built;
    const systemPrompt = built.systemPrompt + "\n\nModule management: call modules.list, then modules.describe, then modules.read or modules.execute with the discovered revision and exact tool input. These tools enforce the module manager's current state and user permissions. Use these tools for panel module operations.";

    log.info(
      {
        provider: provider.id,
        mode: provider.mode,
        toolCount: tools.length,
        messageCount: effectiveMessages.length,
        projectId,
        cwd,
      },
      "Agent run starting",
    );

    // Vision gating (fail-safe): drop image/PDF attachments the active
    // (provider, model) can't accept so we never trigger an upstream 4xx. The
    // UI mirrors this gating, but enforce it server-side too. CLI mode writes
    // files to disk + references paths, so it isn't gated here.
    let effectiveAttachments = attachments;
    if (provider.mode === "api" && attachments?.length) {
      const model = config.providers[provider.id]?.api?.model;
      const allowImg = modelSupportsVision(provider.id, model);
      const allowPdf = modelSupportsPdf(provider.id, model);
      const kept = attachments.filter((a) => {
        if (a.mimeType.startsWith("image/")) return allowImg;
        if (a.mimeType === "application/pdf") return allowPdf;
        return true; // other types pass through (providers ignore unknown)
      });
      if (kept.length !== attachments.length) {
        const dropped = attachments.length - kept.length;
        yield {
          type: "text",
          delta:
            `⚠️ El modelo ${model ?? provider.id} no admite ` +
            `${allowImg ? "documentos PDF" : "imágenes"}; se omitió ${dropped} adjunto(s).\n\n`,
        };
        effectiveAttachments = kept;
      }
    }

    // Track tool_use → tool_result pairs so we can persist a single audit
    // entry per invocation with the elapsed wall-time.
    const pending = new Map<string, { tool: string; startedAt: number }>();

    // Auto-wire the per-run cross-server MCP channel for the Claude CLI. It hosts
    // two things: the `servers.*` tools (used when the project has associated
    // servers) AND the `permissions.approve` tool that backs
    // `--permission-prompt-tool` — the interactive approval gate that replaced
    // `--dangerously-skip-permissions`. So we now wire it for EVERY Claude CLI run
    // (not just ones with associated servers); without it the CLI has no channel
    // to ask the user before a mutating action and would fail safe to deny.
    // Needs the panel origin + a cross-scoped token (both minted in the
    // controller). Other providers use API-mode tools / manual MCP.
    //
    // OJO con la URL: el CLI corre EN EL TARGET, así que el origen tiene que ser
    // alcanzable desde allí. `panelOrigin` es el del navegador (dominio público)
    // y es lo correcto para un target remoto — pero cuando el target es este
    // mismo host, mandarle el dominio público hace que el agente salga a
    // Internet (Cloudflare → nginx) para volver a `127.0.0.1:8080` de su propia
    // máquina, y cualquier 521/502 de ese rodeo tumba el canal MCP del run
    // entero. `resolveCrossChannelOrigin` lo comprueba con una sonda y, si hay
    // co-localización, entrega el loopback. Si no, devuelve `panelOrigin` tal
    // cual (comportamiento de siempre).
    const crossChannelOrigin =
      provider.mode === "cli" && panelOrigin
        ? await resolveCrossChannelOrigin(runExecutor, panelOrigin)
        : panelOrigin;
    const crossServerMcp =
      (provider.id === "claude" || provider.id === "minimax") && provider.mode === "cli" && crossChannelOrigin && crossMcpToken
        ? { url: `${crossChannelOrigin}/api/ai/mcp/cross`, token: crossMcpToken }
        : undefined;

    // Code-graph channel. Unlike `crossServerMcp` this is wired for EVERY CLI
    // provider that can take an MCP server (claude, minimax, codex) — the graph
    // used to be attached to all three as a raw stdio binary, and dropping it
    // for two of them would be a silent feature regression. Needs the panel
    // origin + a graph-scoped token; without either, no graph (fail-closed:
    // never fall back to handing over the binary).
    const graphMcp =
      built.graphMcp && provider.mode === "cli" && panelOrigin && graphMcpToken
        ? {
            url: `${panelOrigin}/api/ai/mcp/graph`,
            token: graphMcpToken,
            projects: built.graphMcp.projects,
          }
        : undefined;

    const moduleToken = provider.mode === "cli" ? mintModuleMcpToken(user, conversationId) : undefined;
    const modulesMcp = moduleToken && crossChannelOrigin ? { url: `${crossChannelOrigin}/api/ai/mcp/modules`, token: moduleToken } : undefined;
    const baseRunOpts = {
      systemPrompt,
      systemContext,
      tools,
      signal,
      cwd,
      // CLI team-leader marker: lets the bridge exempt the team.* MCP tools
      // from its "no background work" headless note (they're panel-managed).
      ...(cliTeamLeader ? { teamLeader: true } : {}),
      // Forward the file-jail to CLI providers so Claude Code's sandbox
      // (active when ANTHROPIC_API_KEY is set) can reach project / ancestor
      // / agent paths — same list we just enforced on the backend's file
      // tools via `setContextFileJail` above. CLI providers (claude /
      // claude-minimax) turn this into repeated `--add-dir <path>` flags;
      // API providers ignore it.
      ...(jailPaths.length ? { jailPaths: [...jailPaths] } : {}),
      // Forward the user's approval mode so the CLI bridge actually honors
      // it (auto = --dangerously-skip-permissions, plan = --permission-mode
      // plan, manual = the default --permission-prompt-tool gate).
      // `approvalModeOverride` (from scheduled jobs / security-audit) wins
      // over the user's global `config.approval.mode` — background callers
      // must NOT inherit an interactive "auto".
      approvalMode: effectiveApprovalMode,
      attachments: effectiveAttachments,
      conversationId,
      ...(crossServerMcp ? { crossServerMcp } : {}),
      ...(modulesMcp ? { modulesMcp } : {}),
      // Canal MCP del grafo, servido por el panel (NO el binario del target).
      // El bridge lo mergea como server HTTP en el mcp.json per-run
      // (claude/minimax) o en el config.toml per-conversación (codex).
      ...(graphMcp ? { graphMcp } : {}),
    };
    // Multi-agent: decompose → parallel fan-out → synthesize. Only for the
    // hardest, decomposable turns on an API provider; falls back to a single
    // run internally if decomposition isn't viable. Otherwise, a single run at
    // the router-chosen model + effort.
    // Confine the file tools to the agent/project working dirs for the rest of
    // this run (mutates the ambient run store; survives stream iteration). Empty
    // jailPaths → no restriction (normal chats unaffected).
    setContextFileJail(jailPaths);
    const releaseModuleScope = conversationId && user && runExecutor ? bindModuleToolRun(conversationId, runExecutor, user, moduleAllowlists, agentId, signal) : () => {};
    // Gate de SOLO-LECTURA del multi-agente: el fan-out comparte el toolset
    // completo entre N sub-agentes ciegos entre sí sobre el mismo cwd; con
    // herramientas mutantes se degrada a run único (evita escrituras
    // concurrentes sin coordinación — para eso está team.assign+worktrees).
    let multiAllowed = Boolean(decision?.multiAgent) && provider.mode === "api";
    if (multiAllowed && hasMutatingTools(tools)) {
      multiAllowed = false;
      log.info(
        { mutating: tools.filter((t) => t.kind === "action" || t.dangerous).slice(0, 5).map((t) => t.name) },
        "multi-agent degraded to single run (mutating tools present)",
      );
      yield {
        type: "text",
        delta:
          "ℹ️ Modo multi-agente omitido: hay herramientas de escritura activas; se ejecuta un solo agente " +
          "para evitar cambios concurrentes (usa un equipo con team.assign para trabajo paralelo aislado).\n\n",
      };
    }
    try {
    const eventStream =
      multiAllowed && decision
        ? orchestratorService.run({
            config,
            providerId: effId,
            // Fan sub-agents across the agent's providers (primary + extras),
            // keeping only API-mode ones. Empty → orchestrator uses just effId.
            fanoutProviders: [...new Set([effId, ...(agent?.providerIds ?? [])])].filter(
              (pid) => config.providers[pid]?.mode === "api",
            ),
            baseOpts: baseRunOpts,
            messages: effectiveMessages,
            tier: decision.tier,
            maxTier: config.autoRouting?.maxTier ?? "max",
            hasAttachments,
            // Agent "multi" mode = replicate THIS agent N times (its copy count).
            ...(agent?.agentMode === "multi" && agent.multiAgentCount ? { copies: agent.multiAgentCount } : {}),
          })
        : provider.run(effectiveMessages, { ...baseRunOpts, effort: runEffort });
    for await (const ev of eventStream) {
      // A leader run forced from CLI to API can hit a dead/quota-less key the
      // CLI never uses (it runs on the subscription). Make the failure
      // actionable instead of a bare 4xx: the user must either fund the key or
      // move the leader to a provider whose team flow works.
      if (forcedApiForLeader && ev.type === "error" && /\b(401|402|429)\b|quota|api key/i.test(ev.message)) {
        yield {
          type: "error",
          message:
            ev.message +
            "\n\nEste agente es LÍDER de equipo: la coordinación (team.plan/assign/collect) requiere el modo API, " +
            `así que este turno se ejecutó por API aunque "${effId}" está configurado en CLI — y la API key falló. ` +
            "Opciones: añade saldo/credenciales API válidas para ese proveedor, o cambia el proveedor del líder a " +
            "claude (su CLI sí soporta el modo equipo vía MCP) o a un proveedor API con saldo (p. ej. gemini/deepseek).",
        };
        return;
      }
      if (ev.type === "tool_use") {
        pending.set(ev.id, { tool: ev.name, startedAt: Date.now() });
      } else if (ev.type === "tool_result") {
        const tracked = pending.get(ev.id);
        if (tracked) {
          pending.delete(ev.id);
          // `servers.*` tools write their own rich cross-server access record;
          // skip the generic entry to avoid a duplicate in the Access tab.
          if (!tracked.tool.startsWith("servers.") && !tracked.tool.startsWith("modules.")) {
            void assistantAuditRepository.append(
              {
                ts: new Date().toISOString(),
                provider: `${provider.id}:${provider.mode}`,
                tool: tracked.tool,
                success: ev.success,
                durationMs: Date.now() - tracked.startedAt,
                userId,
                outputPreview: ev.output.slice(0, 200),
              },
              executor,
            );
          }
        }
      }
      yield ev.type === "tool_use" ? { ...ev, input: redactModuleData(ev.input) as Record<string, unknown> } : ev;
    }
    } finally { releaseModuleScope(); }
  },

  /** Health check across the active provider — used by the Diagnostics tab. */
  async ping(executor?: Executor | null): Promise<{ ok: boolean; detail?: string }> {
    const config = await assistantConfigRepository.load(executor);
    if (!config.enabled) return { ok: false, detail: "Asistente deshabilitado en este target" };
    try {
      const provider = buildProvider(config);
      return provider.ping();
    } catch (err) {
      const detail =
        err instanceof ProviderUnavailableError ? err.message : (err as Error).message;
      return { ok: false, detail };
    }
  },
};
