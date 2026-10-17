// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Provider contract — every backend (claude/codex/gemini/deepseek, in either
 * API or CLI mode) implements this.
 */

import type { AgentTool } from "../../../../shared/agent-capability/index.js";
import type { AskQuestion } from "../../models/ask.types.js";
import type { AssistantProviderId } from "../../models/assistant-config.types.js";
import type { TeamTaskView } from "../../models/team-task.types.js";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

// AUTHORITATIVE 12-variant AgentEvent union (SSOT, backend side).
// CROSS-REFERENCE: the frontend keeps a hand-maintained TWIN of this union in
// `frontend/src/components/floating-assistant/assistant-api/agent-stream.ts`.
// The two build systems can't share this type, so ANY change here (new variant,
// renamed `type` string, changed fields) MUST be mirrored there or the stream
// parser drifts. Do not add variants without updating both.
export type AgentEvent =
  | { type: "text"; delta: string; phase?: "commentary" | "final_answer" }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; success: boolean; output: string }
  // `headroomSavedTokens` = input tokens that the Headroom compression layer
  // removed from tool outputs SINCE the previous `usage` event (incremental, so
  // the recorder can simply sum them). Absent/0 when Headroom is off or no tool
  // output crossed the size threshold.
  | { type: "usage"; model: string; inputTokens: number; outputTokens: number; estimated?: boolean; headroomSavedTokens?: number }
  // CLI mode: the agent stopped to ask the user a decision (single/multi/text).
  // The chat renders selectable controls and resumes the session with the answer.
  // `kind: "plan-approval"` marks a plan-approval ask (approval mode "plan"):
  // answering with the FIRST option sends `planDecision: "approve"` so the next
  // turn runs with the manual gate instead of `--permission-mode plan`.
  | { type: "ask"; id: string; questions: AskQuestion[]; kind?: "plan-approval" }
  // Transient progress, including provider commentary and background translation.
  // When translation is active, live English text deltas are
  // suppressed; the client shows this transient state instead, and the final
  // answer arrives as ONE already-translated `text` event before `done`.
  // "working" = producing the (hidden) English answer · "translating" = final
  // pass to the user's language. Unknown to old clients → harmlessly ignored.
  | { type: "status"; state: "working" | "translating" }
  // Background translation degraded after retries: the answer is delivered
  // UNtranslated (English fallback) and this carries the human reason why the
  // translation was not performed. The client shows it as a collapsed notice;
  // the run still completes normally. Unknown to old clients → ignored.
  | { type: "translation_error"; message: string }
  // Interactive permission gate (Claude CLI): the agent wants to run a mutating
  // tool. The permission broker injects this into the live run so the chat
  // renders approve/deny buttons; the user's decision returns to the CLI via
  // the `permissions.approve` MCP tool and the SAME turn continues. `tool` is the
  // CLI tool name, `title`/`detail` a human summary. Unknown to old clients →
  // ignored (the run just stays paused until it times out → deny).
  | { type: "permission_request"; id: string; tool: string; title: string; detail?: string }
  // The pending permission_request `id` was settled (clicked / timed out). Lets
  // every attached client clear the buttons; also fires on buffer replay so a
  // reconnecting client never re-shows an already-answered prompt.
  | { type: "permission_resolved"; id: string; decision: "allow" | "deny" }
  // Team delegation (leader agents): a task the leader assigned to a subordinate
  // via `team.assign` changed state. Injected into the LEADER's live run by
  // team-tasks.service (same mechanism as permission_request) so the chat can
  // render live progress cards. Providers never emit it. Unknown to old
  // clients → harmlessly ignored; the UI also rehydrates from
  // `GET /api/ai/team/tasks`.
  | { type: "team_task_update"; task: TeamTaskView }
  // The provider stream ended while background/delegated work needs collection.
  // No final answer is published in that case; team cards remain authoritative.
  | { type: "done"; pending?: true }
  | { type: "error"; message: string };

export interface ProviderAttachment {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export interface ProviderRunOptions {
  /** Stable system prompt (base directives + project/marketplace/language).
   *  Kept free of per-turn volatile content so it can sit in the prompt-cache
   *  prefix. The volatile server snapshot goes in `systemContext`. */
  systemPrompt: string;
  /** Per-turn volatile context (server state / recent logs). Placed AFTER the
   *  cached system prefix (claude API) or concatenated (other providers) so it
   *  never invalidates the cache. */
  systemContext?: string;
  tools: AgentTool[];
  /** AbortController.signal — providers should pass it to fetch() and PTY spawns. */
  signal?: AbortSignal;
  /** Working directory on the target (project path) — CLI providers `cd` here first. */
  cwd?: string;
  /**
   * Extra paths the CLI sandbox should allow access to. Forwarded as repeated
   * `--add-dir <path>` flags to `claude` / `claude-minimax` (Claude Code's
   * sandbox defaults to cwd + $HOME only when `ANTHROPIC_API_KEY` is set, so
   * the agent can otherwise be locked out of the project tree the user picked
   * in the assistant UI). Mirrors the BACKEND file-jail (`setContextFileJail`)
   * but is plumbed through to the subprocess so its own sandbox matches.
   */
  jailPaths?: string[];
  /** Files attached to the latest user message (images/pdf/etc). */
  attachments?: ProviderAttachment[];
  /**
   * Conversation this run belongs to. CLI providers use it to resume the
   * upstream agent's session (memory) across turns. Absent for ephemeral
   * (unsaved) chats — providers then fall back to transcript-in-prompt.
   */
  conversationId?: string;
  /**
   * Per-run cross-server MCP channel. Set when the project has associated
   * servers (CLI/claude only): the CLI bridge writes a temp MCP config on the
   * target pointing the Claude CLI at `url` with `Bearer token`, so the agent
   * gets the `servers.*` tools to act on the associated servers. Short-lived
   * token; config file is 0600 and removed after the run.
   */
  crossServerMcp?: { url: string; token: string };
  /**
   * Canal MCP del grafo de código, servido POR EL PANEL (`/api/ai/mcp/graph`).
   *
   * Antes esto era el binario `codebase-memory-mcp` enchufado al CLI por stdio
   * (`command` = binPath). Eso no era acotable: el modelo recibía un
   * `list_projects` que enumeraba TODOS los grafos del target y un `project`
   * libre en cada consulta, así que cualquier agente podía leerse el código de
   * otro con un Cypher. Ahora el binario NO se le entrega: el panel atiende cada
   * llamada, resuelve el agente desde el conversationId FIRMADO del token y
   * valida el `project` contra los proyectos de ese agente.
   *
   * `projects` = nombres que el prompt anuncia (solo los del agente).
   */
  modulesMcp?: { url: string; token: string };
  graphMcp?: { url: string; token: string; projects: string[] };
  /**
   * Approval mode for the agent. CLI providers translate this into the right
   * Claude Code flag combination (replaces the hardcoded
   * `--permission-prompt-tool` gate so the user's "auto" / "plan" choice is
   * actually honored — without this the gate asked for every mutating tool
   * regardless of mode, leaving "auto" effectively manual).
   *   • "auto"   → `--dangerously-skip-permissions` (no gate, agent runs free)
   *   • "plan"   → `--permission-mode plan` (read-only planning)
   *   • "manual" → `--permission-prompt-tool mcp__luxipanel-servers__permissions__approve` (current behavior)
   * Omitted → defaults to "manual" inside the bridge.
   */
  approvalMode?: "auto" | "manual" | "plan";
  /**
   * Reasoning effort chosen by the auto-router for this run. Each provider maps
   * it to its own wire param ONLY when its current model supports it (Anthropic
   * `output_config.effort` + adaptive thinking on Opus/Sonnet-4.6; OpenAI-compat
   * `reasoning_effort` on reasoning models). Absent → provider sends nothing.
   */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /**
   * CLI TEAM-LEADER run: the system prompt carries the delegation protocol and
   * the `team.*` tools ride the cross MCP channel. The CLI bridge must carve
   * those tools out of its "headless — no background work" note: `team.assign`
   * spawns PANEL-managed background chats that survive this process, so they
   * are the correct flow — without the carve-out that note (appended LAST)
   * overrides the protocol and the leader does the work itself.
   */
  teamLeader?: boolean;
}

export interface AgentProvider {
  /** Stable id used for logging / telemetry. */
  id: AssistantProviderId;
  mode: "api" | "cli";
  /** Stream of SSE-shaped events. */
  run(messages: AgentMessage[], opts: ProviderRunOptions): AsyncGenerator<AgentEvent>;
  /** Cheap health-check (no token cost). */
  ping(): Promise<{ ok: boolean; detail?: string }>;
}

export interface ProviderApiConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}
