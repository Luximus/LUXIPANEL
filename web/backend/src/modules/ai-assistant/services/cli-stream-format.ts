// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Live formatter for Claude Code `--output-format stream-json --verbose`.
 *
 * In print/text mode Claude emits nothing until it finishes (tools run
 * silently), so the chat's mini-terminal stays black. stream-json emits one
 * JSON object per line as each step happens — this turns those events into
 * compact, ANSI-colored terminal lines so the user watches the agent work in
 * real time, the same way they would in a real CLI session.
 *
 * Robustness: unknown event shapes are skipped (never throw); partial trailing
 * lines are buffered until the newline arrives.
 */

const ESC = String.fromCharCode(27);
const DIM = `${ESC}[2m`;
const CYAN = `${ESC}[36m`;
const RESET = `${ESC}[0m`;

/** Visual divider between sections. A "section" is one step of the agent's work:
 *  its narration (a prose `text` block) plus the tool calls/results that follow
 *  it, until the next narration. Emitted before each prose block except the
 *  first on a lane, so the console reads as clearly separated steps. A blank
 *  line above gives the rule breathing room. (Display-only — never added to the
 *  raw stream-json the final-answer/usage parsers read.) */
const SECTION_RULE = `\r\n${DIM}${"─".repeat(44)}${RESET}\r\n`;

function oneLine(s: unknown, max = 120): string {
  const str = typeof s === "string" ? s : JSON.stringify(s ?? "");
  const firstLine = str.replace(/\r?\n/g, " ").trim();
  return firstLine.length > max ? `${firstLine.slice(0, max)}…` : firstLine;
}

/** Pull a readable summary of a tool_use input (Bash/Read/Edit/… or JSON). */
function toolInputSummary(input: Record<string, unknown> | undefined): string {
  if (!input) return "";
  if (typeof input.command === "string") return oneLine(input.command);
  if (typeof input.file_path === "string") return oneLine(input.file_path);
  if (typeof input.path === "string") return oneLine(input.path);
  if (typeof input.pattern === "string") return oneLine(input.pattern);
  return oneLine(input, 100);
}

/** Extract text from a tool_result content (string | block array). */
function toolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text ?? "") : ""))
      .join("");
  }
  return "";
}

/**
 * Multi-agent lanes
 * -----------------
 * Claude Code stream-json tags every event with `parent_tool_use_id`: the
 * orchestrator's own events have it null/absent, while events produced by a
 * sub-agent it spawned via the Agent/Task tool carry the *spawning tool_use id*.
 * `system` events of subtype `task_started|task_progress|task_notification`
 * describe each sub-agent (its `tool_use_id`, `description`, `subagent_type`,
 * status). We use that to split the single stdout stream into per-agent
 * "lanes" so the chat can render one terminal TAB per agent (main = orchestrator).
 *
 * The lane is carried to the browser IN-BAND, as compact NUL-delimited control
 * tokens embedded in the display text (`\0{json}\0`). NUL never occurs in real
 * terminal output, so the client splits on it safely. This keeps the whole
 * SSE / registry / resume path byte-for-byte unchanged — only the two ends
 * (this transformer and the chat engine) understand lanes. `accumulated` (raw
 * stream-json) is never touched, so the final-answer / usage parsers below
 * keep working verbatim.
 */

const NUL = String.fromCharCode(0);
export const LANE_MAIN = "main";

interface LaneMeta {
  title?: string;
  subagentType?: string;
  status?: "running" | "done" | "failed";
}

/** Route token: text that follows belongs to <lane> until the next route. */
function routeToken(lane: string): string {
  return `${NUL}${JSON.stringify({ l: lane })}${NUL}`;
}
/** Meta token: register/update a lane's title/type/status (no text routing). */
function metaToken(lane: string, m: LaneMeta): string {
  return `${NUL}${JSON.stringify({ l: lane, m })}${NUL}`;
}

/** Format the content blocks of an assistant/user message event into text. */
function formatMessageBlocks(ev: Record<string, unknown>): string {
  const msg = (ev.message ?? {}) as { content?: unknown };
  const content = Array.isArray(msg.content) ? msg.content : [];
  let out = "";
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string") {
      out += `${b.text}\r\n`;
    } else if (b.type === "tool_use") {
      const name = typeof b.name === "string" ? b.name : "tool";
      const summary = toolInputSummary(b.input as Record<string, unknown> | undefined);
      out += `${CYAN}⏺ ${name}${RESET}${summary ? ` ${DIM}${summary}${RESET}` : ""}\r\n`;
    } else if (b.type === "tool_result") {
      const txt = oneLine(toolResultText(b.content), 160);
      const err = b.is_error ? `${ESC}[33m` : DIM;
      if (txt) out += `${err}  ⎿ ${txt}${RESET}\r\n`;
    }
  }
  return out;
}

interface Classified {
  /** Lane the text content belongs to. */
  lane: string;
  /** Lane metadata updates to emit before the text (registration/status). */
  metas: Array<{ lane: string; meta: LaneMeta }>;
  /** Display text for this event (may be empty). */
  text: string;
  /** When set, the text is a progress heartbeat: skip it if identical to the
   *  lane's previous dedupKey (collapses repeated, unchanged progress lines). */
  dedupKey?: string;
  /** True when this event begins a new section (carries agent prose) — the
   *  transformer prepends a {@link SECTION_RULE} divider (except the lane's first). */
  section?: boolean;
}

/** True when an assistant message carries visible prose (a non-empty `text`
 *  block) — the marker that the agent is narrating a new step of work. */
function messageHasProse(ev: Record<string, unknown>): boolean {
  const msg = (ev.message ?? {}) as { content?: unknown };
  const content = Array.isArray(msg.content) ? msg.content : [];
  return content.some((b) => {
    if (!b || typeof b !== "object") return false;
    const block = b as Record<string, unknown>;
    return block.type === "text" && typeof block.text === "string" && block.text.trim() !== "";
  });
}

const EMPTY: Classified = { lane: LANE_MAIN, metas: [], text: "" };

/** Classify one parsed stream-json event into lane + metadata + display text. */
function classifyEvent(ev: Record<string, unknown>): Classified {
  const type = ev.type;

  if (type === "system" && ev.subtype === "init") {
    const model = typeof ev.model === "string" ? ` · ${ev.model}` : "";
    return { lane: LANE_MAIN, metas: [], text: `${DIM}● Claude Code${model}${RESET}\r\n` };
  }

  // Sub-agent lifecycle markers — register the lane + drive its tab status.
  if (type === "system" && typeof ev.subtype === "string" && ev.subtype.startsWith("task")) {
    const lane = typeof ev.tool_use_id === "string" ? ev.tool_use_id : "";
    if (!lane) return EMPTY;
    const subagentType = typeof ev.subagent_type === "string" ? ev.subagent_type : undefined;
    if (ev.subtype === "task_started") {
      const title = oneLine(ev.description ?? subagentType ?? "subagente", 48);
      return {
        lane,
        metas: [{ lane, meta: { title, subagentType, status: "running" } }],
        text: `${DIM}● subagente · ${title}${subagentType ? ` (${subagentType})` : ""}${RESET}\r\n`,
      };
    }
    if (ev.subtype === "task_notification") {
      const status: LaneMeta["status"] =
        ev.status === "completed" ? "done" : ev.status === "failed" || ev.status === "error" ? "failed" : "running";
      return { lane, metas: [{ lane, meta: { status } }], text: "" };
    }
    // task_progress carries the sub-agent's live activity — the only per-agent
    // signal when its inner assistant/user events aren't streamed with a matching
    // parent_tool_use_id. Surface `description` + `last_tool_name` as a dim
    // progress line so EVERY lane shows what its agent is doing (deduped so
    // repeated identical heartbeats don't spam the lane).
    const desc = oneLine(ev.description ?? "", 80);
    const lastTool = typeof ev.last_tool_name === "string" ? ev.last_tool_name : "";
    const body = [lastTool, desc].filter(Boolean).join(" · ");
    return {
      lane,
      metas: [{ lane, meta: { status: "running", ...(subagentType ? { subagentType } : {}) } }],
      text: body ? `${DIM}  ↳ ${body}${RESET}\r\n` : "",
      dedupKey: body || undefined,
    };
  }

  if (type === "assistant" || type === "user") {
    const parent = ev.parent_tool_use_id;
    const lane = typeof parent === "string" && parent ? parent : LANE_MAIN;
    return { lane, metas: [], text: formatMessageBlocks(ev), section: type === "assistant" && messageHasProse(ev) };
  }

  // result / rate_limit_event / unknown → surfaced elsewhere or ignored.
  return EMPTY;
}

/**
 * Stateful, line-buffered transformer. Feed raw stdout chunks; get back
 * display text (with in-band lane tokens) for whatever complete JSON lines
 * arrived. A route token is emitted only when the active lane changes, so the
 * common single-agent stream carries almost no overhead.
 */
export function createClaudeStreamTransformer(): (chunk: string) => string {
  let buffer = "";
  let lastLane = LANE_MAIN;
  // Per-lane last progress dedupKey — suppresses repeated identical heartbeats.
  const lastProgress = new Map<string, string>();
  // Lanes that have already opened a section — first prose gets no leading rule.
  const seenSection = new Set<string>();
  return (chunk: string): string => {
    buffer += chunk;
    let nl = buffer.indexOf("\n");
    let out = "";
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf("\n");
      if (!line) continue;
      let ev: Record<string, unknown> | null = null;
      try { ev = JSON.parse(line) as Record<string, unknown>; } catch { ev = null; }
      if (!ev) {
        // Not JSON (stderr noise, banners) — show dim in whatever lane is active.
        out += `${DIM}${oneLine(line, 200)}${RESET}\r\n`;
        continue;
      }
      const { lane, metas, text, dedupKey, section } = classifyEvent(ev);
      for (const m of metas) out += metaToken(m.lane, m.meta);
      // Collapse consecutive identical progress heartbeats on the same lane.
      let body = text;
      if (dedupKey !== undefined) {
        if (lastProgress.get(lane) === dedupKey) body = "";
        else lastProgress.set(lane, dedupKey);
      }
      if (body) {
        if (lane !== lastLane) { out += routeToken(lane); lastLane = lane; }
        // Divider between sections: before a new prose block, once a section
        // already exists on this lane (no leading rule under the header).
        if (section) {
          if (seenSection.has(lane)) out += SECTION_RULE;
          seenSection.add(lane);
        }
        out += body;
      }
    }
    return out;
  };
}

/**
 * Pull the REAL token usage from Claude's terminal `result` event (stream-json).
 * `usage` carries `input_tokens` / `output_tokens` plus cache counters.
 *
 * Cache weighting (so the usage bars track real account consumption):
 * Claude Code re-reads the cached system prompt + transcript + file context on
 * EVERY turn, so `cache_read_input_tokens` is huge (100k–200k) even for a tiny
 * reply. Anthropic bills those reads at 0.1x of base input — counting them at
 * full weight inflated the bars ~10x above what the account actually consumes.
 * We therefore fold cache reads in at their 0.1x billing weight. Fresh input
 * (`input_tokens`) and cache *creation* (one-time writes) count at full weight.
 *
 * Returns null if no result/usage found (caller falls back to a char-based
 * estimate). Scans from the end — `result` is the last line of a finished run.
 */
const CACHE_READ_WEIGHT = 0.1;

export function parseClaudeUsage(raw: string): { inputTokens: number; outputTokens: number } | null {
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]!.trim();
    if (!t || !t.includes('"result"')) continue;
    let ev: Record<string, unknown>;
    try { ev = JSON.parse(t) as Record<string, unknown>; } catch { continue; }
    if (ev.type !== "result") continue;
    const u = ev.usage as Record<string, unknown> | undefined;
    if (!u) return null;
    const num = (k: string) => (typeof u[k] === "number" ? (u[k] as number) : 0);
    const inputTokens =
      num("input_tokens") +
      num("cache_creation_input_tokens") +
      Math.round(num("cache_read_input_tokens") * CACHE_READ_WEIGHT);
    const outputTokens = num("output_tokens");
    if (inputTokens === 0 && outputTokens === 0) return null;
    return { inputTokens, outputTokens };
  }
  return null;
}

/** Parse the clean final answer from a complete stream-json log. */
export function parseClaudeFinalAnswer(raw: string): string {
  const lines = raw.split("\n");
  let result = "";
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let ev: Record<string, unknown>;
    try { ev = JSON.parse(t) as Record<string, unknown>; } catch { continue; }
    if (ev.type === "result") {
      result = ev.is_error === true || (ev.subtype !== undefined && ev.subtype !== "success") || typeof ev.result !== "string" ? "" : ev.result;
    }
  }
  return result.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Codex CLI (`codex exec --json`)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Codex's `--json` mode emits the SAME shape of event stream Claude's
 * `stream-json` does — one JSON object per line — so it gets the SAME treatment:
 * a stateful transformer turns the events into compact ANSI terminal lines (so
 * the mini-terminal shows live activity instead of a black box that only fills
 * in at the very end), plus final-answer / usage parsers over the raw log. This
 * keeps every CLI provider on ONE structure (see `CliSpec` in cli-bridge).
 *
 * Event shapes (codex-cli ≥ 0.139):
 *   {"type":"thread.started","thread_id":"…"}
 *   {"type":"turn.started"}
 *   {"type":"item.started","item":{"type":"command_execution","command":"…",…}}
 *   {"type":"item.completed","item":{"type":"command_execution","aggregated_output":"…","exit_code":0,…}}
 *   {"type":"item.completed","item":{"type":"agent_message","text":"…"}}
 *   {"type":"turn.completed","usage":{"input_tokens":…,"cached_input_tokens":…,"output_tokens":…,"reasoning_output_tokens":…}}
 *
 * Codex has no multi-agent sub-tasks here, so everything stays on the `main`
 * lane (no lane control tokens) — the chat engine handles that transparently.
 */

/** Convert LF/CRLF text to terminal CRLF so the xterm renders line breaks. */
function crlf(s: string): string {
  return s.replace(/\r?\n/g, "\r\n");
}

/** A readable one-line label for a codex `item` of a non-message type. */
function codexItemLabel(item: Record<string, unknown>): string {
  const type = typeof item.type === "string" ? item.type : "item";
  switch (type) {
    case "command_execution":
      return `${CYAN}⏺ bash${RESET}${item.command ? ` ${DIM}${oneLine(item.command)}${RESET}` : ""}`;
    case "mcp_tool_call": {
      const server = typeof item.server === "string" ? item.server : "";
      const tool = typeof item.tool === "string" ? item.tool : "tool";
      return `${CYAN}⏺ ${server ? `${server}.` : ""}${tool}${RESET}`;
    }
    case "file_change": {
      const changes = Array.isArray(item.changes) ? item.changes : [];
      const paths = changes
        .map((c) => (c && typeof c === "object" && "path" in c ? String((c as { path: unknown }).path ?? "") : ""))
        .filter(Boolean)
        .join(", ");
      return `${CYAN}⏺ edit${RESET}${paths ? ` ${DIM}${oneLine(paths)}${RESET}` : ""}`;
    }
    case "web_search":
      return `${CYAN}⏺ web search${RESET}${item.query ? ` ${DIM}${oneLine(item.query)}${RESET}` : ""}`;
    default:
      return `${CYAN}⏺ ${type}${RESET}`;
  }
}

/** Display text for ONE codex event (may be empty). */
function classifyCodexEvent(ev: Record<string, unknown>): string {
  const type = ev.type;
  if (type === "lxp.startup") {
    const labels: Record<string, string> = {
      initializing: "Preparando motor IA",
      resuming: "Recuperando historial de la conversación",
      creating: "Preparando conversación",
      submitting: "Enviando solicitud a la IA",
      ready: "Turno iniciado; esperando la respuesta de la IA",
    };
    const label = typeof ev.stage === "string" ? labels[ev.stage] : undefined;
    if (!label) return "";
    const seconds = typeof ev.elapsedMs === "number" && Number.isFinite(ev.elapsedMs) && ev.elapsedMs >= 0 ? ` · ${(ev.elapsedMs / 1000).toFixed(1)} s` : "";
    return `${DIM}[LUXIPANEL] ${label}${seconds}${RESET}\r\n`;
  }
  if (type === "thread.started") return `${DIM}● Codex${RESET}\r\n`;
  if (type === "error") {
    const msg = typeof ev.message === "string" ? ev.message : oneLine(ev, 160);
    return `${ESC}[33m${oneLine(msg, 200)}${RESET}\r\n`;
  }
  if (type !== "item.started" && type !== "item.completed") return "";

  const item = (ev.item ?? {}) as Record<string, unknown>;
  const itemType = item.type;

  // The agent's prose (preamble + final answer) — show in full, once.
  if (itemType === "agent_message") {
    if (type !== "item.completed") return "";
    return typeof item.text === "string" && item.text ? `${crlf(item.text)}\r\n` : "";
  }
  // Reasoning summaries — dim, like Claude's thinking trace.
  if (itemType === "reasoning") {
    if (type !== "item.completed") return "";
    return typeof item.text === "string" && item.text.trim()
      ? `${DIM}${crlf(item.text.trim())}${RESET}\r\n`
      : "";
  }
  // Commands / tool calls / edits: announce on start; show a result line on
  // completion (amber when a command exited non-zero).
  if (type === "item.started") return `${codexItemLabel(item)}\r\n`;
  // item.completed for a non-message item → result line.
  if (itemType === "command_execution") {
    const out = typeof item.aggregated_output === "string" ? item.aggregated_output : "";
    const first = oneLine(out, 160);
    if (!first) return "";
    const exit = typeof item.exit_code === "number" ? item.exit_code : 0;
    const color = exit === 0 ? DIM : `${ESC}[33m`;
    return `${color}  ⎿ ${first}${RESET}\r\n`;
  }
  return "";
}

/**
 * Stateful, line-buffered transformer for `codex exec --json`. Mirrors
 * {@link createClaudeStreamTransformer}: feed raw stdout chunks, get back ANSI
 * display text for whatever complete JSON lines arrived. Non-JSON lines (stderr
 * banners / notices) are dimmed rather than dropped.
 */
export function createCodexStreamTransformer(): (chunk: string) => string {
  let buffer = "";
  return (chunk: string): string => {
    buffer += chunk;
    let nl = buffer.indexOf("\n");
    let out = "";
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf("\n");
      if (!line) continue;
      let ev: Record<string, unknown> | null = null;
      try { ev = JSON.parse(line) as Record<string, unknown>; } catch { ev = null; }
      if (!ev) {
        out += `${DIM}${oneLine(line, 200)}${RESET}\r\n`;
        continue;
      }
      out += classifyCodexEvent(ev);
    }
    return out;
  };
}

/** Pull the clean final answer from a complete `codex exec --json` log: the
 *  last `agent_message` item the run emitted. */
export function parseCodexFinalAnswer(raw: string): string {
  const lines = raw.split("\n");
  let answer = "";
  let finalAnswer = "";
  let phased = false;
  let failed = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let ev: Record<string, unknown>;
    try { ev = JSON.parse(t) as Record<string, unknown>; } catch { continue; }
    if (ev.type === "turn.failed") failed = true;
    if (ev.type === "turn.completed") failed = ev.status !== undefined && ev.status !== "completed";
    if (ev.type !== "item.completed") continue;
    const item = (ev.item ?? {}) as Record<string, unknown>;
    if (item.type === "agent_message" && typeof item.text === "string") {
      answer = item.text;
      if (typeof item.phase === "string") phased = true;
      if (item.phase === "final_answer") finalAnswer = item.text;
    }
  }
  return failed ? "" : (phased ? finalAnswer : answer).trim();
}

/**
 * Real token usage from `codex exec --json` (`turn.completed.usage`). Summed
 * across every turn of the run. Cache reads are folded in at the same 0.1x
 * billing weight Claude uses (see {@link parseClaudeUsage}); reasoning output is
 * counted as output. Returns null when no usage was reported.
 */
export function parseCodexUsage(raw: string): { inputTokens: number; outputTokens: number } | null {
  const lines = raw.split("\n");
  let inputTokens = 0;
  let outputTokens = 0;
  let found = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t || !t.includes('"turn.completed"')) continue;
    let ev: Record<string, unknown>;
    try { ev = JSON.parse(t) as Record<string, unknown>; } catch { continue; }
    if (ev.type !== "turn.completed") continue;
    const u = ev.usage as Record<string, unknown> | undefined;
    if (!u) continue;
    const num = (k: string) => (typeof u[k] === "number" ? (u[k] as number) : 0);
    const cached = num("cached_input_tokens");
    const input = num("input_tokens");
    // `input_tokens` already includes the cached portion → un-bill the cache
    // reads down to their 0.1x weight rather than double-counting.
    inputTokens += Math.max(0, input - cached) + Math.round(cached * CACHE_READ_WEIGHT);
    outputTokens += num("output_tokens") + num("reasoning_output_tokens");
    found = true;
  }
  if (!found || (inputTokens === 0 && outputTokens === 0)) return null;
  return { inputTokens, outputTokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini CLI (`gemini -o stream-json`)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Gemini's `--output-format stream-json` emits one JSON event per line, the
 * same shape Claude/codex do, so it gets the SAME treatment — one structure for
 * every agentic CLI provider.
 *
 * Event shapes (gemini-cli ≥ 0.44, from its `StreamJsonFormatter`):
 *   {"type":"init",...}
 *   {"type":"message","role":"user"|"assistant","content":"…"}
 *   {"type":"tool_use","tool_name":"…","tool_id":"…","parameters":{…}}
 *   {"type":"tool_result","tool_id":"…","status":"success"|"error","output":"…"}
 *   {"type":"error","message":"…"}
 *   {"type":"result","status":"success","stats":{"input_tokens":…,"output_tokens":…,"cached":…}}
 *
 * The clean final answer joins assistant messages after the last tool call
 * only after a successful terminal result; usage comes from its `stats`.
 */

/** Readable one-line label for a gemini non-message event. */
function geminiEventLabel(ev: Record<string, unknown>): string {
  if (ev.type === "tool_use") {
    const name = typeof ev.tool_name === "string" ? ev.tool_name : "tool";
    const params = ev.parameters as Record<string, unknown> | undefined;
    const summary = params ? toolInputSummary(params) : "";
    return `${CYAN}⏺ ${name}${RESET}${summary ? ` ${DIM}${summary}${RESET}` : ""}`;
  }
  return "";
}

/** Display text for ONE gemini stream-json event (may be empty). */
function classifyGeminiEvent(ev: Record<string, unknown>): string {
  switch (ev.type) {
    case "init":
      return `${DIM}● Gemini${RESET}\r\n`;
    case "message": {
      // Only the model's prose is shown; the echoed user turn is suppressed.
      if (ev.role !== "assistant") return "";
      return typeof ev.content === "string" && ev.content ? `${crlf(ev.content)}\r\n` : "";
    }
    case "tool_use":
      return `${geminiEventLabel(ev)}\r\n`;
    case "tool_result": {
      const out = oneLine(typeof ev.output === "string" ? ev.output : ev.output ?? "", 160);
      if (!out) return "";
      const color = ev.status === "error" ? `${ESC}[33m` : DIM;
      return `${color}  ⎿ ${out}${RESET}\r\n`;
    }
    case "error": {
      const msg = typeof ev.message === "string" ? ev.message : typeof ev.text === "string" ? ev.text : oneLine(ev, 160);
      return `${ESC}[33m${oneLine(msg, 200)}${RESET}\r\n`;
    }
    default:
      // result / unknown → no terminal text (usage parsed separately).
      return "";
  }
}

/**
 * Stateful, line-buffered transformer for `gemini -o stream-json`. Mirrors the
 * claude/codex transformers: raw stdout chunks → ANSI display lines; non-JSON
 * lines (warnings codex/gemini print to stderr) are dimmed, never dropped.
 */
export function createGeminiStreamTransformer(): (chunk: string) => string {
  let buffer = "";
  return (chunk: string): string => {
    buffer += chunk;
    let nl = buffer.indexOf("\n");
    let out = "";
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf("\n");
      if (!line) continue;
      let ev: Record<string, unknown> | null = null;
      try { ev = JSON.parse(line) as Record<string, unknown>; } catch { ev = null; }
      if (!ev) {
        out += `${DIM}${oneLine(line, 200)}${RESET}\r\n`;
        continue;
      }
      out += classifyGeminiEvent(ev);
    }
    return out;
  };
}

/** Clean final answer after the last tool call and a successful terminal result. */
export function parseGeminiFinalAnswer(raw: string): string {
  const lines = raw.split("\n");
  const parts: string[] = [];
  let completed = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let ev: Record<string, unknown>;
    try { ev = JSON.parse(t) as Record<string, unknown>; } catch { continue; }
    if (ev.type === "tool_use") parts.length = 0;
    if (ev.type === "result") completed = ev.status === "success";
    if (ev.type === "message" && ev.role === "assistant" && typeof ev.content === "string") {
      parts.push(ev.content);
    }
  }
  return completed ? parts.join("").trim() : "";
}

/** Real token usage from a `gemini -o stream-json` log's `result` event stats.
 *  Cache reads folded to 0.1x, matching {@link parseClaudeUsage}. */
export function parseGeminiUsage(raw: string): { inputTokens: number; outputTokens: number } | null {
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]!.trim();
    if (!t || !t.includes('"result"')) continue;
    let ev: Record<string, unknown>;
    try { ev = JSON.parse(t) as Record<string, unknown>; } catch { continue; }
    if (ev.type !== "result") continue;
    const s = ev.stats as Record<string, unknown> | undefined;
    if (!s) return null;
    const num = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : 0);
    const cached = num("cached");
    const input = num("input_tokens");
    const inputTokens = Math.max(0, input - cached) + Math.round(cached * CACHE_READ_WEIGHT);
    const outputTokens = num("output_tokens");
    if (inputTokens === 0 && outputTokens === 0) return null;
    return { inputTokens, outputTokens };
  }
  return null;
}
