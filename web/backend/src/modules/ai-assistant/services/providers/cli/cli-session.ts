// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Session-continuity helpers for the CLI bridge: upstream Claude session
 * measurement (overflow guard), codex per-conversation HOME + session-id
 * capture, and the transcript-in-prompt builder used by fresh launches and
 * the self-heal replays. Split out of `cli-bridge.provider.ts` (behaviour
 * unchanged).
 */

import type { Executor } from "../../../../../shared/executor/index.js";
import type { AgentMessage } from "../provider.types.js";
import { quoteArg, loginShell, safePathFragment, sleep } from "./shell.js";

/**
 * Best-effort byte size of the upstream Claude session transcript the next
 * `--resume` would replay. Claude stores it at
 * `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`; we locate it by file name
 * (slug-independent) so a project-less tmp cwd still resolves. Returns 0 when it
 * can't be found/measured — the caller treats 0 as "don't reset" (fail-open to
 * the legacy resume behaviour). See `upstreamSessionResetBytes()` for the budget.
 */
export async function measureClaudeSessionBytes(executor: Executor, sessionId: string): Promise<number> {
  if (!sessionId) return 0;
  try {
    const r = await executor.exec(
      `find "$HOME/.claude/projects" -type f -name ${quoteArg(`${sessionId}.jsonl`)} -printf '%s\\n' 2>/dev/null | sort -nr | head -1`,
      { timeoutMs: 8_000 },
    );
    const n = parseInt(r.stdout.trim(), 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function ensureCodexConversationHome(
  executor: Executor,
  conversationId: string,
  graphMcp?: { url: string; token: string },
  modulesMcp?: { url: string; token: string },
): Promise<string> {
  const fragment = safePathFragment(conversationId);
  // Graph MCP wiring on the PER-CONVERSATION config copy (never the shared one):
  //  - always STRIP inherited graph and `luxipanel` MCP tables first. This is
  //    a SECURITY CONTROL, not just hygiene: if the user
  //    has the raw stdio binary configured in their shared ~/.codex/config.toml,
  //    it would be copied into the per-conversation home and hand the model an
  //    UNSCOPED graph — every project on the box, bypassing the panel's channel
  //    entirely. The installed `luxipanel` token can outlive its bridge session
  //    and must not be inherited by panel runs, which use fresh scoped channels.
  //    (It also stops a codex run whose cwd is an ephemeral
  //    /tmp/lxp-cli-* dir from auto-indexing that empty dir into the graph.)
  //    Do not remove this awk.
  //  - when the run has an indexed project in scope, append a clean
  //    `[mcp_servers.codebase-graph]` pointing at the PANEL's HTTP channel —
  //    never at the target's binary (see cli-bridge.provider for why).
  // Same TOML shape the panel already emits for the `luxipanel` server in
  // `buildCliMcpSnippet` (mcp.controller.ts): transport/url/headers.
  const graphAppend = graphMcp
    ? `printf '\\n[mcp_servers.codebase-graph]\\nurl = %s\\nhttp_headers = { Authorization = %s }\\n' ${quoteArg(JSON.stringify(graphMcp.url))} ${quoteArg(JSON.stringify(`Bearer ${graphMcp.token}`))} >> "$conv/config.toml"`
    : ": no-graph";
  const moduleAppend = modulesMcp
    ? `printf '\\n[mcp_servers.luxipanel-modules]\\nurl = %s\\nhttp_headers = { Authorization = %s }\\ntool_timeout_sec = 300\\n' ${quoteArg(JSON.stringify(modulesMcp.url))} ${quoteArg(JSON.stringify(`Bearer ${modulesMcp.token}`))} >> "$conv/config.toml"`
    : ": no-module-channel";
  const script = [
    'shared="$HOME/.codex"',
    `conv="$shared/luxipanel/homes/${fragment}"`,
    'mkdir -p "$conv" "$conv/sessions" "$conv/log" "$conv/shell_snapshots" "$conv/memories" "$conv/tmp" "$conv/.tmp"',
    'chmod 700 "$shared" "$shared/luxipanel" "$shared/luxipanel/homes" "$conv" 2>/dev/null || true',
    'for name in auth.json config.toml installation_id version.json models_cache.json; do',
    '  if [ -e "$shared/$name" ]; then rm -f "$conv/$name"; cp -p "$shared/$name" "$conv/$name" 2>/dev/null || ln -s "$shared/$name" "$conv/$name"; fi',
    "done",
    'for name in rules skills plugins cache; do',
    '  if [ -e "$shared/$name" ] && [ ! -e "$conv/$name" ]; then ln -s "$shared/$name" "$conv/$name" 2>/dev/null || cp -a "$shared/$name" "$conv/$name"; fi',
    "done",
    // Materialize a symlinked config copy before mutating it (mutating through
    // the link would edit the SHARED config).
    'if [ -L "$conv/config.toml" ]; then cp -L "$conv/config.toml" "$conv/config.toml.real" 2>/dev/null && mv "$conv/config.toml.real" "$conv/config.toml"; fi',
    'if [ -f "$conv/config.toml" ]; then awk \'BEGIN{skip=0} /^\\[/{skip=($0 ~ /^\\[mcp_servers\\.(codebase[-_]?(memory|graph)|luxipanel(-modules)?)(\\]|\\.)/)} !skip{print}\' "$conv/config.toml" > "$conv/config.toml.tmp" 2>/dev/null && mv "$conv/config.toml.tmp" "$conv/config.toml"; fi',
    graphAppend,
    moduleAppend,
    'chmod 600 "$conv/auth.json" "$conv/config.toml" 2>/dev/null || true',
    'printf "__LXP_CODEX_HOME__%s\\n" "$conv"',
  ].join("\n");
  const r = await executor.exec(loginShell(script), { timeoutMs: 10_000 });
  const marker = r.stdout
    .split("\n")
    .find((line) => line.startsWith("__LXP_CODEX_HOME__"))
    ?.slice("__LXP_CODEX_HOME__".length)
    .trim();
  if (!marker || !marker.startsWith("/")) {
    throw new Error("No se pudo preparar un CODEX_HOME absoluto para la conversación.");
  }
  return marker;
}

export async function readCodexSessionId(executor: Executor, codexHome: string): Promise<string | null> {
  const findCmd = `find ${quoteArg(`${codexHome}/sessions`)} -type f -name '*.jsonl' 2>/dev/null | sort | tail -n 1`;
  const latest = (await executor.exec(loginShell(findCmd), { timeoutMs: 5_000 })).stdout.trim().split("\n").pop()?.trim() ?? "";
  if (!latest) return null;

  const firstLine = (await executor.exec(loginShell(`sed -n '1p' ${quoteArg(latest)}`), { timeoutMs: 5_000 })).stdout.trim();
  if (!firstLine) return null;

  try {
    const parsed = JSON.parse(firstLine) as { type?: string; payload?: { id?: string } };
    return parsed.type === "session_meta" && typeof parsed.payload?.id === "string"
      ? parsed.payload.id
      : null;
  } catch {
    return null;
  }
}

export async function captureCodexSessionId(
  executor: Executor,
  codexHome: string,
  existingSessionId?: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const sessionId = await readCodexSessionId(executor, codexHome).catch(() => null);
    if (sessionId && sessionId !== existingSessionId) return sessionId;
    await sleep(250);
  }
  return null;
}

/** A prior detached Codex run can outlive the panel process and its in-memory
 * registry. Check the actual target process before resuming the same thread.
 * `ps -C codex` excludes the shell running this probe; inspect only the command
 * prefix so a prompt quoting an old thread id cannot count as its writer. */
export async function activeCodexWriterSessions(executor: Executor): Promise<Set<string>> {
  const sessions = new Set<string>();
  try {
    const { stdout } = await executor.exec("ps -ww -C codex -o pid=,stat=,args=", { timeoutMs: 5_000 });
    for (const line of stdout.split("\n")) {
      const match = line.match(/^\s*\d+\s+(\S+)\s+\S*\bcodex\s+exec\s+resume\s+([0-9a-f-]{36})(?:\s|$)/i);
      if (match && !match[1]!.startsWith("Z")) sessions.add(match[2]!);
    }
  } catch {
    // No Codex process on this target, or process inspection unavailable.
  }
  return sessions;
}

export async function codexThreadHasWriter(executor: Executor, sessionId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return false;
  return (await activeCodexWriterSessions(executor)).has(sessionId);
}

/** Recover the nohup job behind a live Codex writer when its descriptor was
 * overwritten by a competing failed resume. Only trust our own /tmp job-id
 * pattern and a process whose argv starts with this exact session id. */
export async function discoverCodexOrphanJob(
  executor: Executor,
  sessionId: string,
): Promise<{ jobId: string; pid: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  try {
    const { stdout } = await executor.exec("ps -ww -C codex -o pid=,ppid=,stat=,args=", { timeoutMs: 5_000 });
    for (const line of stdout.split("\n")) {
      const match = line.match(/^\s*\d+\s+(\d+)\s+(\S+)\s+\S*\bcodex\s+exec\s+resume\s+([0-9a-f-]{36})(?:\s|$)/i);
      if (!match || match[2]!.startsWith("Z") || match[3] !== sessionId) continue;
      let parent = match[1]!;
      for (let depth = 0; depth < 4 && /^\d+$/.test(parent) && parent !== "1"; depth++) {
        const { stdout: parentLine } = await executor.exec(`ps -ww -p ${parent} -o ppid=,args=`, { timeoutMs: 5_000 });
        const jobId = parentLine.match(/\/tmp\/(lxp-cli-\d+-[a-z0-9]+)-prompt\.txt/)?.[1];
        if (jobId) {
          const { stdout: exists } = await executor.exec(`test -f /tmp/${jobId}.log && echo Y`, { timeoutMs: 5_000 });
          return exists.trim() === "Y" ? { jobId, pid: parent } : null;
        }
        parent = parentLine.match(/^\s*(\d+)\s/)?.[1] ?? "";
      }
    }
  } catch {
    // Process may have exited during discovery; normal resume is then safe.
  }
  return null;
}

export const TRANSCRIPT_TURNS = 8;
/** Char budget for the in-prompt transcript. The prompt is written to a file on
 *  the target (no argv limit), so this only guards the model's context window —
 *  generous on purpose, especially for the self-heal replay below. */
export const TRANSCRIPT_MAX_CHARS = 24_000;
/** Per-turn cap inside the replayed transcript. CLI runs persist the WHOLE
 *  terminal output as the assistant `content` (25k+ is routine), so without a
 *  per-turn clamp the newest prior turn alone can exceed `maxChars` and the
 *  walk below aborts with an EMPTY transcript — an overflow-reseeded session
 *  then starts knowing nothing but the latest message (the "empezó a trabajar
 *  y luego olvidó" amnesia of 2026-07-22). Head+tail keeps both the start of
 *  the turn and its conclusion (a CLI turn buries the real answer at the end,
 *  after the banner/tool noise). */
export const TRANSCRIPT_TURN_CLAMP = 6_000;

function clampTranscriptTurn(content: string): string {
  if (content.length <= TRANSCRIPT_TURN_CLAMP) return content;
  const half = Math.floor(TRANSCRIPT_TURN_CLAMP / 2);
  return `${content.slice(0, half)}\n… [turno truncado: ${content.length} caracteres en total] …\n${content.slice(-half)}`;
}

export function buildPromptWithContext(
  messages: AgentMessage[],
  systemPrompt: string,
  opts: { maxTurns?: number; maxChars?: number } = {},
): string {
  if (messages.length === 0) return "";
  const last = messages[messages.length - 1];
  if (!last) return "";
  if (messages.length === 1) return `${systemPrompt}\n\nUsuario: ${last.content}`;

  const maxTurns = opts.maxTurns ?? TRANSCRIPT_TURNS;
  const maxChars = opts.maxChars ?? TRANSCRIPT_MAX_CHARS;

  // Walk the prior turns (all but the latest) from newest to oldest, including
  // as many as fit within BOTH the turn cap and the char budget. Each turn is
  // clamped first so a single oversized one can't blank the whole window. The
  // latest user turn is always sent in full below.
  const prior = messages.slice(0, -1);
  const picked: string[] = [];
  let used = 0;
  for (let i = prior.length - 1; i >= 0 && picked.length < maxTurns; i--) {
    const m = prior[i]!;
    const line = `${m.role === "user" ? "Usuario" : "Asistente"}: ${clampTranscriptTurn(m.content)}`;
    if (used + line.length > maxChars) break;
    used += line.length;
    picked.unshift(line);
  }

  return [
    systemPrompt,
    "Conversación previa:",
    picked.join("\n"),
    "",
    `Usuario: ${last.content}`,
  ].join("\n");
}
