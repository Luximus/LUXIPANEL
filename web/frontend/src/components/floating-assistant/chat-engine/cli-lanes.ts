// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { CliLane, ToolTrace } from "./types";

/** Strip ANSI escape sequences so the bubble's final text reads cleanly. */
const ESC = String.fromCharCode(27);
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g");
function stripAnsi(s: string): string {
  if (typeof s !== "string") return "";
  return s.replace(ANSI_RE, "");
}

/** Drop the ask sentinel block from CLI text derived locally from the terminal
 *  (the backend already strips it from the persisted answer + tool_result). */
const ASK_BLOCK_RE = /<<<LXP_ASK>>>[\s\S]*?<<<LXP_ASK_END>>>/g;
function stripAskBlock(s: string): string {
  if (typeof s !== "string") return "";
  return s.includes("<<<LXP_ASK>>>") ? s.replace(ASK_BLOCK_RE, "").trim() : s;
}

// ── CLI multi-agent lane demux ──────────────────────────────────────────────
// The backend embeds NUL-delimited control tokens in the CLI text stream:
//   \0{"l":"<lane>"}\0          → route subsequent text to <lane>
//   \0{"l":"<lane>","m":{…}}\0  → register / update a lane's title/type/status
// NUL never occurs in real terminal output, so splitting on it is unambiguous.
const NUL = String.fromCharCode(0);
const LANE_TOKEN_RE = new RegExp(NUL + "\\{[^" + NUL + "]*\\}" + NUL, "g");
/** Strip any lane control tokens (used for the raw transcript + clean answer). */
export function stripLaneTokens(s: string): string {
  if (typeof s !== "string") return "";
  return s.includes(NUL) ? s.replace(LANE_TOKEN_RE, "") : s;
}

/** Agent prose from the formatted CLI transcript. Tool calls and their output
 * stay in the terminal; these short narration blocks feed ThoughtLine. */
export function extractCliProgress(raw: string, finalAnswer = ""): string[] {
  const lines = stripAnsi(stripLaneTokens(raw)).replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  const flush = () => {
    // Keep the agent's own line breaks: joining with spaces turns a numbered
    // update or a short summary into one long paragraph in ThoughtLine.
    const message = current.join("\n").trim();
    if (message && message !== blocks[blocks.length - 1]) blocks.push(message);
    current = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^─{3,}$/.test(trimmed)) { flush(); continue; }
    if (/^(?:\$ |⏺ |● |⎿ |↳ |Reading additional input from stdin\.\.\.|\[error\])/.test(trimmed)) {
      flush();
      continue;
    }
    // A tool result's continuation is indented; agent narration is not.
    if (/^\s{2,}/.test(line)) { flush(); continue; }
    current.push(trimmed);
  }
  flush();
  // A persisted final answer may have different whitespace from the terminal.
  // Compare normalized text only for deduplication; do not change display text.
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  const answer = normalize(finalAnswer);
  if (answer && normalize(blocks.at(-1) ?? "") === answer) blocks.pop();
  return blocks;
}

export function freshMainLane(): CliLane {
  return { id: "main", title: "Orquestador", status: "running", output: "" };
}

/**
 * Apply one streamed CLI text delta to a tool's lanes. Splits the delta on NUL
 * into alternating [text, control, text, …] segments, routes text into the
 * active lane, and upserts lane metadata from control tokens. Returns a new
 * ToolTrace (the `main` lane is mirrored into `.terminal` for legacy consumers).
 */
export function applyCliDelta(tool: ToolTrace, delta: string): ToolTrace {
  const lanes: Record<string, CliLane> = { ...(tool.lanes ?? { main: freshMainLane() }) };
  const order = [...(tool.laneOrder ?? ["main"])];
  let active = tool.activeLane ?? "main";
  let terminal = tool.terminal ?? "";

  const ensure = (id: string, seed?: Partial<CliLane>) => {
    if (!lanes[id]) {
      lanes[id] = {
        id,
        // Sub-agent fallback is empty so the view renders a LOCALIZED "subagent"
        // label (CliTerminalView's `lane.title || tt.subagent`); "main" is always
        // overridden there with the localized "orchestrator" label.
        title: seed?.title ?? (id === "main" ? "Orquestador" : ""),
        subagentType: seed?.subagentType,
        status: seed?.status ?? "running",
        output: "",
      };
      order.push(id);
    }
  };
  const appendText = (id: string, txt: string) => {
    ensure(id);
    lanes[id] = { ...lanes[id]!, output: lanes[id]!.output + txt };
    if (id === "main") terminal += txt;
  };

  const parts = delta.split(NUL);
  for (let k = 0; k < parts.length; k++) {
    const seg = parts[k] ?? "";
    if (k % 2 === 0) {
      if (seg) appendText(active, seg);
      continue;
    }
    // Odd segment: a control token's JSON body. If it doesn't parse, it was a
    // stray NUL — treat the whole thing as literal text so nothing is lost.
    let ctrl: { l?: string; m?: { title?: string; subagentType?: string; status?: CliLane["status"] } } | null = null;
    try { ctrl = JSON.parse(seg); } catch { ctrl = null; }
    if (!ctrl || typeof ctrl.l !== "string") { appendText(active, NUL + seg); continue; }
    const id = ctrl.l;
    if (ctrl.m) {
      ensure(id, { title: ctrl.m.title, subagentType: ctrl.m.subagentType, status: ctrl.m.status });
      lanes[id] = {
        ...lanes[id]!,
        ...(ctrl.m.title ? { title: ctrl.m.title } : {}),
        ...(ctrl.m.subagentType ? { subagentType: ctrl.m.subagentType } : {}),
        ...(ctrl.m.status ? { status: ctrl.m.status } : {}),
      };
    } else {
      ensure(id);
      active = id;
    }
  }

  return { ...tool, lanes, laneOrder: order, activeLane: active, terminal };
}

/** Flip every still-running lane of a CLI tool to a terminal status. */
export function settleLanes(tool: ToolTrace, status: "done" | "failed"): ToolTrace {
  if (!tool.lanes) return tool;
  const lanes: Record<string, CliLane> = {};
  for (const [id, lane] of Object.entries(tool.lanes)) {
    lanes[id] = lane.status === "running" ? { ...lane, status } : lane;
  }
  return { ...tool, lanes };
}

/** Strip a CLI raw log down to its clean final answer — mirror of the live
 *  `done` path (drop lane tokens + ANSI, the synthetic `$ …` header line and any
 *  ask sentinel block) so a reloaded turn reads the same as it did live. */
export function cleanCliLog(raw: string): string {
  // Defensive: malformed streamed chunks can land an undefined body. Treat as
  // empty so the bubble renders a clean empty string instead of crashing the
  // whole turn with "Cannot read properties of undefined (reading 'replace')".
  const safe = typeof raw === "string" ? raw : "";
  return stripAskBlock(
    stripAnsi(stripLaneTokens(safe))
      .replace(/\r\n?/g, "\n") // normalize terminal CRLF → LF before line matching
      .replace(/^\s*\$ .*\n/, "")
      // Drop the console section-divider rules + collapse the gaps they leave —
      // they belong to the terminal view, not the clean summary.
      .replace(/^[ \t]*─{3,}[ \t]*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function extractCliFinalNarrative(cleaned: string): string {
  // The clean answer is the LAST narrative block the agent wrote: a run of
  // unindented prose lines that is neither a tool marker (`⏺ …`, `  ⎿ …`,
  // `$ …`, `● …`, stdin banner) nor the indented continuation of one. A run
  // that ended mid-tool (timeout / stop / overflow) has no prose after the
  // last marker — we must then fall back to the previous narrative block, and
  // to "" when there is none. NEVER return the whole log: the bubble would
  // render the raw console stream (unreadable), which is exactly the bug seen
  // on reloaded team-orchestration chats (2026-08-25).
  const lines = cleaned.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inMarker = false;
  const flush = () => {
    const text = current.join("\n").trim();
    if (text) blocks.push(text);
    current = [];
  };
  for (const line of lines) {
    const isMarker = /^(?:⏺ | {2}⎿ |\$ |Reading additional input from stdin\.\.\.|● )/.test(line);
    if (isMarker) { flush(); inMarker = true; continue; }
    if (inMarker && /^\s/.test(line)) continue; // indented continuation of a tool line
    if (inMarker && !line.trim()) continue; // blank gap right after a tool block
    inMarker = false;
    current.push(line);
  }
  flush();
  return blocks.length ? blocks[blocks.length - 1]! : "";
}

export function looksLikeCliTranscript(text: string): boolean {
  return /(?:^|\n)(?:⏺ |  ⎿ |Reading additional input from stdin\.\.\.|● )/.test(text);
}

/** Clean summary for a reloaded CLI turn. Prefer a genuine translated answer
 *  (background translation stores it in `textTranslated`); otherwise derive it
 *  from the raw log. Older runs translated the WHOLE log (it still carries the
 *  `$ …` header) — clean those too rather than dumping the header in the bubble. */
export function deriveCliSummary(translated: string | undefined, rawLog: string): string {
  const t = translated?.trim();
  if (t && !t.startsWith("$ ") && t !== rawLog.trim()) return t;
  return extractCliFinalNarrative(cleanCliLog(t && t.startsWith("$ ") ? t : rawLog));
}
