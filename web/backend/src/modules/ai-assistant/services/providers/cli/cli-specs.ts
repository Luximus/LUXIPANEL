// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-provider CLI specs for the CLI bridge: which binary runs, how the
 * detached launch command is built (flags, session resume, approval mode,
 * MCP config, steering FIFO), the human-readable command header, and the
 * structured-stream hooks (`makeTransform` / `parseFinalAnswer` /
 * `parseUsage`). Consumed by `cli-bridge.provider.ts` (runner/orquestador).
 */

import {
  createClaudeStreamTransformer,
  parseClaudeFinalAnswer,
  parseClaudeUsage,
  createCodexStreamTransformer,
  parseCodexFinalAnswer,
  parseCodexUsage,
  createGeminiStreamTransformer,
  parseGeminiFinalAnswer,
  parseGeminiUsage,
} from "../../cli-stream-format.js";
import { quoteArg, modelFlag, buildNohupLaunch, shortId } from "./shell.js";
import type { AssistantProviderId } from "../../../models/assistant-config.types.js";

/** Per-launch context — carries session continuity so each turn resumes. */
export interface CliBuildCtx {
  promptFile: string;
  logFile: string;
  exitFile: string;
  cwd?: string;
  /** Paths the CLI sandbox should allow access to (forwarded as `--add-dir`).
   *  Mirrors the BACKEND file-jail so the subprocess sandbox matches. */
  jailPaths?: string[];
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  apiKey?: string;
  /** True when continuing an existing upstream session (memory). */
  resume: boolean;
  /** Claude session UUID (passed as --session-id / --resume). */
  sessionId?: string;
  /** Env exports injected before the CLI (e.g. sudo askpass PATH/SUDO_ASKPASS). */
  envPrefix?: string;
  /** Command run after the CLI exits to clean up secrets (e.g. rm -rf …). */
  cleanup?: string;
  /** Path on the target of a temp MCP config (cross-server channel). Only the
   *  claude launch consumes it (--mcp-config). Absent → no extra MCP servers. */
  mcpConfigFile?: string;
  /** True when the per-run MCP config also carries the target's codebase-graph
   *  server (`codebase-memory-mcp`, stdio). Adds an `--allowedTools` allowlist
   *  of its READ-ONLY tools so manual approval mode doesn't prompt for every
   *  graph lookup (index_repository/delete_project stay gated). */
  graphMcpAttached?: boolean;
  modulesMcpAttached?: boolean;
  /** Path on the target of a temp file holding the full system directive (base
   *  prompt + project/ancestor context). On a RESUMED claude turn the upstream
   *  session may have compacted away the original directive (or the chat's
   *  project was set after turn 1), so we re-append it every turn via
   *  `--append-system-prompt`. Absent on fresh turns (already in the prompt body). */
  appendSystemPromptFile?: string;
  /** Approval mode forwarded to the CLI. See ProviderRunOptions.approvalMode. */
  approvalMode?: "auto" | "manual" | "plan";
  /**
   * Live-steering (ASSISTANT_LIVE_STEERING, claude/minimax only): path of a stdin
   * FIFO on the target. When set, the CLI runs `--input-format stream-json`
   * reading user messages (prompt + later addenda) as NDJSON from the FIFO,
   * instead of taking the prompt as an argv with `</dev/null`. The process then
   * stays alive across the turn so mid-run input can be injected; the FIFO holder
   * is killed (forcing EOF) once the turn's `result` event lands.
   */
  stdinFifo?: string;
  /** Uploaded Codex app-server bridge and per-turn config on the target. */
  codexAdapterFile?: string;
  codexConfigFile?: string;
}

export interface CliSpec {
  bin: string;
  /**
   * Returns the shell command that runs the CLI with the prompt sourced from
   * a temp file path on the target. stdout+stderr go to the log file; exit
   * code goes to the exit file. Must NOT block — wrap in nohup + &.
   */
  buildLaunch(ctx: CliBuildCtx): string;
  /** Short, human-readable command shown as the first line in the mini-terminal. */
  describe(ctx: { resume: boolean; sessionId?: string; model?: string }): string;
  /**
   * Per-provider hooks that put every CLI on ONE structure. When the provider
   * emits a structured event stream (claude `stream-json`, codex `--json`):
   *  • `makeTransform` turns raw stdout chunks into live ANSI terminal lines so
   *    the mini-terminal shows activity instead of buffering to the end;
   *  • `parseFinalAnswer` extracts the clean answer from the raw log (for the
   *    bubble text + ask detection);
   *  • `parseUsage` reads real token counts.
   * Providers without a structured stream (gemini/minimax) leave these unset →
   * the raw terminal output is streamed as-is and ANSI-stripped for the answer.
   */
  makeTransform?: () => (rawChunk: string) => string;
  parseFinalAnswer?: (raw: string) => string;
  parseUsage?: (raw: string) => { inputTokens: number; outputTokens: number } | null;
}

// Headless `claude -p` runs exactly ONE turn and then the process exits. Tools
// that push work into the BACKGROUND outlive that turn: the `Workflow`
// orchestrator (and any `run_in_background` task) keeps running after `claude`
// exits, so the run is orphaned/"interrupted" and the NEXT `--resume` greets the
// user with "The workflow was interrupted when the previous process exited. Let
// me resume it…" — a confusing, stuttering multi-turn restart. We hard-disallow
// `Workflow` on every claude launch so complex work runs SYNCHRONOUSLY within the
// turn (foreground sub-agents via the Agent tool still work and finish before the
// process exits). True long-running multi-agent belongs in API mode, where the
// server-side orchestrator (orchestrator.service.ts) keeps the job alive.
/**
 * `Bash(codebase-memory-mcp:*)` closes the shell bypass around the scoped graph
 * channel: the graph binary lives ON the target, so an agent could otherwise run
 * `codebase-memory-mcp cli search_graph '{"project":"var-www"}'` from Bash and
 * read any project's code without ever touching our MCP guard. In `manual` mode
 * the Bash permission gate would at least prompt, but in `auto`
 * (`--dangerously-skip-permissions`) nothing would stop it.
 *
 * BE HONEST ABOUT WHAT THIS IS: a pattern deny. It stops the accidental and the
 * lazy path, NOT a model that is actively trying to get around it (`sh -c …`, an
 * absolute path, a shell variable). Real isolation of the graph from the shell
 * needs a separate UNIX user or container per agent — a different, costlier
 * design. The MCP-side enforcement is the strong control; this is defence in
 * depth on top of it.
 */
export const CLAUDE_DISALLOWED_TOOLS = "Workflow,Bash(codebase-memory-mcp:*)";
// quoteArg NO es opcional: el valor lleva `(`, `)` y `*`, y este flag acaba dentro
// de un `bash -c` — sin comillas, bash corta con "syntax error near unexpected
// token `('" y el run muere antes de arrancar el CLI.
export const claudeDisallowFlag = `--disallowedTools=${quoteArg(CLAUDE_DISALLOWED_TOOLS)} `;

/** Server key the bridge writes into the per-run MCP config for the target's
 *  codebase graph (stdio `codebase-memory-mcp`). Wire names derive from it. */
export const GRAPH_MCP_SERVER_KEY = "codebase-graph";
// READ-ONLY graph tools pre-allowed in manual mode. Mutating ones
// (index_repository, delete_project, manage_adr, ingest_traces) are NOT listed
// → they keep flowing through the normal permission gate.
const GRAPH_READONLY_TOOLS = [
  "search_graph",
  "search_code",
  "get_code_snippet",
  "trace_path",
  "get_architecture",
  "query_graph",
  "get_graph_schema",
  "index_status",
  "list_projects",
  "detect_changes",
];
export const graphAllowedToolsFlag = `--allowedTools ${GRAPH_READONLY_TOOLS.map(
  (t) => `mcp__${GRAPH_MCP_SERVER_KEY}__${t}`,
).join(",")} `;

/**
 * Build the repeated `--add-dir <path>` flags for the Claude CLI sandbox.
 * When `ANTHROPIC_API_KEY` is set (the wrapper always sets it for MiniMax
 * and most users set it for direct Claude), Claude Code enables its OS-level
 * sandbox that defaults to cwd + $HOME. To let the agent reach the project
 * paths the user picked in the assistant UI (and the related agent paths /
 * ancestors / children), the bridge forwards the file-jail list as repeated
 * `--add-dir` flags. De-duped and filtered against the cwd (Claude Code
 * already includes cwd).
 *
 * Empty/undefined → empty string (no flag added, sandbox stays at default).
 */
export function buildClaudeAddDirFlag(cwd: string | undefined, jailPaths: string[] | undefined): string {
  if (!jailPaths || jailPaths.length === 0) return "";
  const cwdNorm = cwd?.replace(/\/+$/, "") || "";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of jailPaths) {
    if (typeof raw !== "string") continue;
    const p = raw.trim();
    if (!p) continue;
    const norm = p.replace(/\/+$/, "") || "/";
    if (norm === cwdNorm) continue;          // cwd is implicit; skip dup
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(`--add-dir ${quoteArg(norm)}`);
  }
  return out.length ? out.join(" ") + " " : "";
}

/** @internal — exported for unit tests of buildLaunch (3 approval modes × add-dir wiring). */
export const CLI_SPECS: Record<AssistantProviderId, CliSpec | null> = {
  claude: {
    bin: "claude",
    // First turn pins a fixed --session-id (UUID we minted); later turns
    // --resume that id so the upstream Claude session keeps full memory.
    buildLaunch: ({ promptFile, logFile, exitFile, cwd, jailPaths, model, effort, resume, sessionId, envPrefix, cleanup, mcpConfigFile, graphMcpAttached, modulesMcpAttached, appendSystemPromptFile, approvalMode = "manual", stdinFifo }) => {
      const addDirFlag = buildClaudeAddDirFlag(cwd, jailPaths);
      const sessionFlag = resume
        ? `--resume ${quoteArg(sessionId ?? "")}`
        : sessionId
          ? `--session-id ${quoteArg(sessionId)}`
          : "";
      // On resume, re-assert the system directive (project + ancestor context)
      // so it survives upstream compaction / a project assigned after turn 1.
      // Fresh turns already carry it in the prompt body → no flag (avoid dup).
      const appendSystemFlag = appendSystemPromptFile
        ? `--append-system-prompt "$(cat ${quoteArg(appendSystemPromptFile)})" `
        : "";
      // Per-run MCP config: load ONLY the servers we wrote into the file
      // (--strict-mcp-config ignores the user's own ~/.claude.json servers) so
      // the agent gets servers.*/codebase-graph without us silently enabling
      // the user's full toolset. WITHOUT a per-run file the flag stays on
      // (zero MCP servers): otherwise the CLI inherits the user's installed
      // config — including a possibly STALE `luxipanel` token (bound to a dead
      // bridge session) whose first tool call fails the run mid-answer with
      // MCP_SESSION_EXPIRED. Panel runs are hermetic; panel tools arrive only
      // via the per-run channels (cross + graph), which carry fresh tokens.
      const mcpFlag = mcpConfigFile
        ? `--mcp-config ${quoteArg(mcpConfigFile)} --strict-mcp-config `
        : "--strict-mcp-config ";
      // Graph read tools pre-allowed → manual mode doesn't prompt per lookup.
      // Gateway calls are already gated by the panel's per-operation broker.
      // Permit the transport itself so manual mode prompts exactly once for
      // the discovered operation, preserving graph allowlists in the same flag.
      const moduleAllowed = modulesMcpAttached ? ["list", "describe", "read", "execute"].map(name => `mcp__luxipanel-modules__modules__${name}`) : [];
      const graphAllowed = graphMcpAttached ? GRAPH_READONLY_TOOLS.map(name => `mcp__${GRAPH_MCP_SERVER_KEY}__${name}`) : [];
      const graphFlag = mcpConfigFile && (moduleAllowed.length || graphAllowed.length) ? `--allowedTools ${[...graphAllowed, ...moduleAllowed].join(",")} ` : "";
      // Approval gate, MODE-AWARE: until this fix the bridge hardcoded
      // `--permission-prompt-tool` for every CLI run, so the user's "auto"
      // setting (which the config says should "auto-approve everything, the
      // agent runs uninterrupted") was effectively a no-op for CLI providers
      // and the agent kept pausing on every mutating tool. Now:
      //   • "auto"   → --dangerously-skip-permissions (no gate; user opted in)
      //   • "plan"   → --permission-mode plan (read-only planning, no mutations)
      //   • "manual" → --permission-prompt-tool mcp__luxipanel-servers__permissions__approve
      // `mcpFlag` is intentionally KEPT in "auto"/"plan" so the cross-server
      // `servers.*` tools still load — only the permission gate changes.
      const permissionFlag = approvalMode === "auto"
        ? "--dangerously-skip-permissions "
        : approvalMode === "plan"
          ? "--permission-mode plan "
          : mcpConfigFile
            ? `--permission-prompt-tool mcp__luxipanel-servers__permissions__approve `
            : "";
      // Steering: read user messages as NDJSON from the stdin FIFO instead of
      // passing the prompt as an argv with `</dev/null`. The process then stays
      // alive for mid-run input. Otherwise the legacy one-shot (byte-identical).
      const inputPart = stdinFifo
        ? `--input-format stream-json < ${quoteArg(stdinFifo)}`
        : `"$(cat ${quoteArg(promptFile)})" </dev/null`;
      return buildNohupLaunch(
        // stream-json (requires --verbose) emits one JSON event per step so
        // the mini-terminal shows live activity; text mode buffers until done.
        `claude -p --output-format stream-json --verbose ${claudeDisallowFlag}${addDirFlag}${mcpFlag}${graphFlag}${permissionFlag}${appendSystemFlag}${sessionFlag}${modelFlag("--model", model)} ${inputPart}`,
        logFile,
        exitFile,
        cwd,
        [envPrefix, effort ? `export CLAUDE_CODE_EFFORT_LEVEL=${quoteArg(effort)};` : ""].filter(Boolean).join(" "),
        cleanup,
      );
    },
    describe: ({ resume, sessionId, model }) =>
      `claude -p ${resume ? `--resume ${shortId(sessionId)}` : `--session-id ${shortId(sessionId)}`}${model ? ` --model ${model}` : ""}`,
    makeTransform: createClaudeStreamTransformer,
    parseFinalAnswer: parseClaudeFinalAnswer,
    parseUsage: parseClaudeUsage,
  },
  codex: {
    bin: "codex",
    // First turn starts a session; later turns resume the explicit session id
    // persisted for the LUXIPANEL conversation.
    buildLaunch: ({ logFile, exitFile, cwd, envPrefix, cleanup, codexAdapterFile, codexConfigFile }) => {
      if (!codexAdapterFile || !codexConfigFile) throw new Error("Codex app-server adapter is required");
      const codexCmd = `node ${quoteArg(codexAdapterFile)} ${quoteArg(codexConfigFile)} </dev/null`;
      return buildNohupLaunch(
        // Native collaboration modes and approval callbacks are exposed by
        // app-server, not by headless `codex exec`. Keep one writer per home.
        `if [ -n "\${CODEX_HOME:-}" ] && command -v flock >/dev/null 2>&1; then flock -w 3600 "$CODEX_HOME/.lxp-writer.lock" ${codexCmd}; else ${codexCmd}; fi`,
        logFile,
        exitFile,
        cwd,
        envPrefix,
        cleanup,
      );
    },
    describe: ({ resume, sessionId, model }) =>
      `codex app-server${resume ? ` · resume ${shortId(sessionId)}` : ""}${model ? ` · ${model}` : ""}`,
    makeTransform: createCodexStreamTransformer,
    parseFinalAnswer: parseCodexFinalAnswer,
    parseUsage: parseCodexUsage,
  },
  gemini: {
    bin: "gemini",
    // No reliable headless resume — memory comes from transcript-in-prompt.
    buildLaunch: ({ promptFile, logFile, exitFile, cwd, model, envPrefix, cleanup }) =>
      buildNohupLaunch(
        // `-o stream-json` emits one event per step (like claude/codex) so the
        // mini-terminal shows live activity instead of buffering to the end.
        `gemini -p "$(cat ${quoteArg(promptFile)})" --yolo -o stream-json${modelFlag("-m", model)} </dev/null`,
        logFile,
        exitFile,
        cwd,
        envPrefix,
        cleanup,
      ),
    describe: ({ model }) => `gemini -p${model ? ` -m ${model}` : ""} --yolo`,
    makeTransform: createGeminiStreamTransformer,
    parseFinalAnswer: parseGeminiFinalAnswer,
    parseUsage: parseGeminiUsage,
  },
  deepseek: null,
  grok: {
    bin: "grok",
    // grok-cli (superagent-ai) headless: `-p` runs one prompt then exits
    // (scripts/CI mode). No reliable headless session resume → memory rides in
    // the transcript-in-prompt (like gemini). We use the default human-text
    // output (NOT `--format json`, whose per-event field schema is undocumented)
    // → the raw stdout is ANSI-stripped as the answer. The model is selected via
    // the GROK_MODEL env var (grok-cli has no model flag); GROK_API_KEY + that
    // env are injected in makeCliBridgeProvider, so buildLaunch ignores `model`.
    buildLaunch: ({ promptFile, logFile, exitFile, cwd, envPrefix, cleanup }) =>
      buildNohupLaunch(
        `grok -p "$(cat ${quoteArg(promptFile)})" </dev/null`,
        logFile,
        exitFile,
        cwd,
        envPrefix,
        cleanup,
      ),
    describe: ({ model }) => `grok -p${model ? ` · ${model}` : ""}`,
  },
  minimax: {
    bin: "claude-minimax",
    // Wrapper around the real `claude` CLI that exports the MiniMax Anthropic-
    // compatible endpoint + the user's Subscription Key sourced from
    // /etc/luxipanel/claude-minimax.env. We use the SAME stream-json / parser
    // hooks as the `claude` entry (Claude Code IS what runs underneath): live
    // tool events, MCP servers, `--resume` for memory, `--disallowedTools
    // Workflow`. Auth/model/base-url are provided ONLY by the wrapper env.
    buildLaunch: ({ promptFile, logFile, exitFile, cwd, jailPaths, resume, sessionId, envPrefix, cleanup, mcpConfigFile, graphMcpAttached, modulesMcpAttached, appendSystemPromptFile, approvalMode = "manual", stdinFifo }) => {
      const addDirFlag = buildClaudeAddDirFlag(cwd, jailPaths);
      const sessionFlag = resume
        ? `--resume ${quoteArg(sessionId ?? "")}`
        : sessionId
          ? `--session-id ${quoteArg(sessionId)}`
          : "";
      const appendSystemFlag = appendSystemPromptFile
        ? `--append-system-prompt "$(cat ${quoteArg(appendSystemPromptFile)})" `
        : "";
      // Hermetic like the `claude` spec above: no per-run file → still strict
      // (zero MCP servers) so a stale installed `luxipanel` entry can't break
      // the run mid-answer (claude-minimax IS Claude Code underneath).
      const mcpFlag = mcpConfigFile
        ? `--mcp-config ${quoteArg(mcpConfigFile)} --strict-mcp-config `
        : "--strict-mcp-config ";
      // Gateway calls are already gated by the panel's per-operation broker.
      // Permit the transport itself so manual mode prompts exactly once for
      // the discovered operation, preserving graph allowlists in the same flag.
      const moduleAllowed = modulesMcpAttached ? ["list", "describe", "read", "execute"].map(name => `mcp__luxipanel-modules__modules__${name}`) : [];
      const graphAllowed = graphMcpAttached ? GRAPH_READONLY_TOOLS.map(name => `mcp__${GRAPH_MCP_SERVER_KEY}__${name}`) : [];
      const graphFlag = mcpConfigFile && (moduleAllowed.length || graphAllowed.length) ? `--allowedTools ${[...graphAllowed, ...moduleAllowed].join(",")} ` : "";
      // See the matching comment in the `claude` spec above for the rationale;
      // identical mode-aware permission flag wiring (MiniMax is just the
      // claude-code wrapper that points at the MiniMax endpoint).
      const permissionFlag = approvalMode === "auto"
        ? "--dangerously-skip-permissions "
        : approvalMode === "plan"
          ? "--permission-mode plan "
          : mcpConfigFile
            ? `--permission-prompt-tool mcp__luxipanel-servers__permissions__approve `
            : "";
      // Same steering branch as the `claude` spec (claude-minimax IS Claude Code).
      const inputPart = stdinFifo
        ? `--input-format stream-json < ${quoteArg(stdinFifo)}`
        : `"$(cat ${quoteArg(promptFile)})" </dev/null`;
      return buildNohupLaunch(
        `claude-minimax -p --output-format stream-json --verbose ${claudeDisallowFlag}${addDirFlag}${mcpFlag}${graphFlag}${permissionFlag}${appendSystemFlag}${sessionFlag} ${inputPart}`,
        logFile,
        exitFile,
        cwd,
        envPrefix,
        cleanup,
      );
    },
    describe: ({ resume, sessionId, model }) =>
      // User-facing header for the mini-terminal in the chat. The actual
      // binary on the target is still `claude-minimax` (a thin wrapper
      // around the real `claude` CLI that points at the MiniMax endpoint —
      // see the `MINIMAX_WRAPPER_SCRIPT` block). The display name
      // `minimax-cli` matches the product the user is configuring in the
      // Providers tab; "claude" prefix in the header would have leaked
      // implementation detail. Keep the binary on the target untouched.
      `minimax-cli -p ${resume ? `--resume ${shortId(sessionId)}` : `--session-id ${shortId(sessionId)}`}${model ? ` · model=${model}` : ""}`,
    makeTransform: createClaudeStreamTransformer,
    parseFinalAnswer: parseClaudeFinalAnswer,
    parseUsage: parseClaudeUsage,
  },
};
