// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Public types for the system-prompt builder — the run inputs it consumes and
 * the assembled result it returns. Kept in their own module so both the main
 * assembler and the delegation-tool builders can share `RunAgent` without a
 * runtime cycle back into agent.service.
 */

import type { Executor } from "../../../../shared/executor/index.js";
import type { SessionUser } from "../../../../shared/types/index.js";
import type { AssistantConfig } from "../../models/assistant-config.types.js";
import type { AssistantAgent } from "../../models/assistant-agent.types.js";
import type { AssistantRole } from "../../models/assistant-role.types.js";
import type { AgentTool } from "../../../../shared/agent-capability/index.js";
import type { AgentEvent, AgentMessage, AgentProvider } from "../providers/provider.types.js";
import type { AgentRunOptions } from "../agent.service.js";

/**
 * Runner injected by agent.service (a lambda over `agentService.run`) so the
 * delegate/spawn/team tools built here can run other agents without a runtime
 * module cycle back into agent.service. Type-compatible with the narrower
 * `RunAgentFn` that team-tasks/team-tools expect.
 */
export type RunAgent = (
  messages: AgentMessage[],
  options: AgentRunOptions,
) => AsyncGenerator<AgentEvent>;

/** Everything the prompt assembly consumes — resolved by `agentService.run`
 *  BEFORE the prompt is built (config, provider, agent/role, tool set…). */
export interface SystemPromptBuildInput {
  /** Per-request executor scope (may be null/absent on ephemeral runs). */
  executor: Executor | null | undefined;
  /** Logged-in user — forwarded to the delegation/team tool handlers. */
  user: SessionUser | undefined;
  /** Caller id — forwarded to the delegation/team tool handlers. */
  userId: string | undefined;
  /** Loaded assistant config (its approval mode shapes the prompt). */
  config: AssistantConfig;
  /** Approval mode efectivo de ESTE run (`approvalModeOverride ?? config.approval.mode`).
   *  Puede diferir del persistido para ejecuciones con override explícito.
   *  Ausente = usar `config.approval.mode`. */
  effectiveApprovalMode?: AssistantConfig["approval"]["mode"];
  /** Resolved provider — its id/mode gate the CLI/API-specific blocks. */
  provider: AgentProvider;
  /** Tool set resolved so far; an extended COPY is returned in the result. */
  tools: AgentTool[];
  /** Custom agent driving this run (null = loose run). */
  agent: AssistantAgent | null;
  /** The agent's assigned role (null = none). */
  role: AssistantRole | null;
  /** Project whose path (cwd) + instructions scope this run. */
  projectId: string | undefined;
  /** Explicit working directory for this run (a project path wins). */
  cwdOverride: string | undefined;
  /** cwd FORZADO (worktree de tarea de equipo): gana sobre project.path pero
   *  conserva el contexto del proyecto. Ver AgentRunOptions.forcedCwd. */
  forcedCwd: string | undefined;
  /** Conversation id — anchors the team task board (team.* tools). */
  conversationId: string | undefined;
  /** When true, collects the volatile server snapshot into systemContext. */
  withContext: boolean;
  /** Background-translation run → appends the LANGUAGE OVERRIDE block. */
  outputEnglish: boolean | undefined;
  /** Panel origin — gates the CLI cross-server MCP channel notes. */
  panelOrigin: string | undefined;
  /** Cross-scoped MCP token — gates the CLI cross-server MCP channel notes. */
  crossMcpToken: string | undefined;
  /** Recursion depth of inter-agent delegation (top-level chat run = 0). */
  delegationDepth: number;
  /** AbortSignal — wired through to the team tools. */
  signal: AbortSignal | undefined;
  /** Lambda over `agentService.run` (see {@link RunAgent}). */
  runAgent: RunAgent;
}

export interface SystemPromptBuildResult {
  /** Stable system prompt (prompt-cache prefix — byte-identical per inputs). */
  systemPrompt: string;
  /** Volatile block (server snapshot + project vault) — placed after the
   *  cache breakpoint by the provider. Empty string when absent. */
  systemContext: string;
  /** The input tool set plus the run-scoped tools appended during assembly
   *  (lxp_ask, agents.delegate, chats.create, team.*). */
  tools: AgentTool[];
  /** Working directory for CLI providers (cwd override / project / agent). */
  cwd: string | undefined;
  /** FILE-ACCESS JAIL allowlist accumulated from every source (empty = none). */
  jailPaths: string[];
  /** True when this is a CLI TEAM-LEADER run (the roster + delegation
   *  protocol block was injected and the team.* tools are served over the
   *  cross MCP channel). The CLI bridge uses it to carve the team tools out
   *  of its "no background work" headless note — otherwise that note (placed
   *  LAST in the system prompt) overrides the protocol and the model does the
   *  work itself instead of delegating. */
  cliTeamLeader: boolean;
  /** Codebase-graph MCP for CLI runs: present only when the target ships
   *  `codebase-memory-mcp` AND the project tree has an indexed project.
   *  Consumed by the CLI bridge (per-run mcp.json / codex config.toml). */
  graphMcp?: { command: string; projects: string[] };
}
