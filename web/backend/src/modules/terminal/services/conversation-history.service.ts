// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Terminal Codex/Claude conversation history lives on the CONNECTED server (the
// same machine the user shells into), NOT on the panel host. Every read/write
// therefore goes through the request `Executor` (SSH/SFTP) and resolves `$HOME`
// on that target — never the panel host's filesystem. Falling back to the panel
// host would expose the wrong machine's history and break per-server isolation.
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";

type ConversationSource = "codex" | "claude";

interface CodexHistoryRow {
  session_id?: string;
  ts?: number;
  text?: string;
}

interface ClaudePasteRef {
  id?: number;
  type?: string;
  contentHash?: string;
}

interface ClaudeHistoryRow {
  display?: string;
  pastedContents?: Record<string, ClaudePasteRef>;
  timestamp?: number;
  project?: string;
  sessionId?: string;
}

interface ConversationEntry {
  timestamp: number;
  text: string;
}

interface ConversationDeleteRequest {
  source: ConversationSource;
  sessionIds: string[];
}

interface ConversationSummary {
  source: ConversationSource;
  sessionId: string;
  title: string;
  startedAt: number;
  updatedAt: number;
  entryCount: number;
  project?: string | null;
  preview: string;
  transcript: string;
}

interface ConversationPage {
  items: ConversationSummary[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Resolve `$HOME` for the PTY user on the connected target (mirrors
 * `bashrc-manager#resolveHome`). The history files hang off this directory on
 * the REMOTE server, never the panel host.
 */
async function resolveHome(executor: Executor): Promise<string> {
  const result = await executor.exec('printf %s "${HOME:-}"');
  const home = (result.stdout ?? "").trim();
  if (!home) throw new Error("Cannot resolve $HOME for the PTY user");
  return home;
}

function joinHome(home: string, ...parts: string[]): string {
  return [home.replace(/\/+$/, ""), ...parts].join("/");
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function squashWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  const text = squashWhitespace(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === "ENOENT") return true;
  // The SSH/SFTP executor surfaces a missing file with a message rather than a
  // POSIX errno; treat "no such file" as empty so a fresh server (no history
  // yet) reads as an empty list instead of throwing.
  const msg = String((error as Error)?.message ?? error ?? "");
  return /no such file|not found|ENOENT/i.test(msg);
}

async function readOptionalText(executor: Executor, filePath: string): Promise<string> {
  try {
    const raw = await executor.readFile(filePath, "utf-8");
    return typeof raw === "string" ? raw : raw.toString("utf-8");
  } catch (error) {
    if (isMissing(error)) return "";
    throw error;
  }
}

async function readJsonl<T>(executor: Executor, filePath: string): Promise<T[]> {
  const content = await readOptionalText(executor, filePath);
  if (!content) return [];
  const rows: T[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      // A partially-written line (the live CLI appends concurrently) must NOT
      // 500 the whole listing — drop the malformed row and keep going, matching
      // deleteJsonlSessions' tolerance.
      rows.push(JSON.parse(line) as T);
    } catch {
      // Skip corrupt / half-flushed row.
    }
  }
  return rows;
}

async function deleteJsonlSessions<T>(
  executor: Executor,
  filePath: string,
  sessionIds: Set<string>,
  getSessionId: (row: T) => string | undefined,
): Promise<number> {
  if (sessionIds.size === 0) return 0;

  const content = await readOptionalText(executor, filePath);
  if (!content) return 0;

  const keptLines: string[] = [];
  const deletedSessions = new Set<string>();

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    try {
      const row = JSON.parse(line) as T;
      const sessionId = String(getSessionId(row) ?? "").trim();
      if (sessionId && sessionIds.has(sessionId)) {
        deletedSessions.add(sessionId);
        continue;
      }
    } catch {
      // Preserve malformed rows so a partial history file is not truncated.
    }

    keptLines.push(rawLine);
  }

  // Write to a sibling temp file then `mv -f` into place: an interrupted write
  // can't leave the history truncated (the original stays intact until the
  // atomic rename), matching bashrc-manager.writeBashrcAtomic.
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  const nextContent = keptLines.length > 0 ? `${keptLines.join("\n")}\n` : "";
  await executor.writeFile(tmpPath, nextContent, { encoding: "utf-8" });
  const mv = await executor.exec(quoteCmd("mv", ["-f", tmpPath, filePath]));
  if (mv.exitCode !== 0) {
    try { await executor.exec(quoteCmd("rm", ["-f", tmpPath])); } catch { /* best effort */ }
    throw new Error(`No se pudo reescribir el historial: ${(mv.stderr || mv.stdout || "mv failed").trim()}`);
  }

  return deletedSessions.size;
}

function buildTranscriptHeader(source: ConversationSource, sessionId: string, project?: string | null): string {
  const label = source === "codex" ? "Codex" : "Claude";
  const projectLine = project ? `\nProyecto: ${project}` : "";
  return `=== ${label} ${sessionId} ===${projectLine}`;
}

function buildTranscriptEntry(timestamp: number, text: string): string {
  const iso = new Date(timestamp).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "medium",
  });
  return `[${iso}] ${normalizeText(text)}`;
}

function buildConversationSummary(
  source: ConversationSource,
  sessionId: string,
  entries: ConversationEntry[],
  project?: string | null,
): ConversationSummary {
  const ordered = entries.slice().sort((a, b) => a.timestamp - b.timestamp);
  const firstEntry = ordered[0];
  const lastEntry = ordered[ordered.length - 1];
  const titleSource = firstEntry?.text || lastEntry?.text || sessionId;
  const title = truncate(titleSource.split("\n", 1)[0] || sessionId, 80);
  const previewSource = lastEntry?.text || firstEntry?.text || sessionId;
  const preview = truncate(previewSource, 180) || sessionId;
  const startedAt = firstEntry?.timestamp || 0;
  const updatedAt = lastEntry?.timestamp || startedAt;

  const transcript = [
    buildTranscriptHeader(source, sessionId, project),
    "",
    ...ordered.map((entry) => buildTranscriptEntry(entry.timestamp, entry.text)),
  ].join("\n");

  return {
    source,
    sessionId,
    title,
    startedAt,
    updatedAt,
    entryCount: ordered.length,
    project: project ?? null,
    preview,
    transcript,
  };
}

async function readClaudePasteContent(executor: Executor, home: string, contentHash?: string): Promise<string> {
  if (!contentHash) return "";
  const content = await readOptionalText(
    executor,
    joinHome(home, ".claude", "paste-cache", `${contentHash}.txt`),
  );
  return normalizeText(content);
}

async function loadCodexHistory(executor: Executor, home: string): Promise<ConversationSummary[]> {
  const rows = await readJsonl<CodexHistoryRow>(executor, joinHome(home, ".codex/history.jsonl"));
  const grouped = new Map<string, ConversationEntry[]>();

  for (const row of rows) {
    const sessionId = String(row.session_id ?? "").trim();
    const text = normalizeText(String(row.text ?? ""));
    if (!sessionId || !text) continue;
    const timestamp = Number(row.ts ?? 0) * 1000;
    const entries = grouped.get(sessionId) ?? [];
    entries.push({
      timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
      text,
    });
    grouped.set(sessionId, entries);
  }

  return Array.from(grouped.entries())
    .map(([sessionId, entries]) => buildConversationSummary("codex", sessionId, entries))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Load Claude history. When `hydratePastes` is false (the list/page path) the
 * per-row paste-cache files are NOT read — that would be one extra SFTP read
 * per row (N+1). The transcript still carries the inline `display` text; the
 * full pasted blobs are only materialized on the detail/transcript path.
 * TODO(perf): expose a detail endpoint that hydrates a single session's pastes
 * on demand, and keep the list path paste-free.
 */
async function loadClaudeHistory(
  executor: Executor,
  home: string,
  hydratePastes = false,
): Promise<ConversationSummary[]> {
  const rows = await readJsonl<ClaudeHistoryRow>(executor, joinHome(home, ".claude/history.jsonl"));
  const grouped = new Map<string, { entries: ConversationEntry[]; project?: string | null }>();

  for (const row of rows) {
    const sessionId = String(row.sessionId ?? "").trim();
    const display = normalizeText(String(row.display ?? ""));
    if (!sessionId || !display) continue;

    const chunks = [display];
    if (hydratePastes) {
      const pastedContents = row.pastedContents ?? {};
      const pasteKeys = Object.keys(pastedContents).sort((a, b) => Number(a) - Number(b));

      for (const key of pasteKeys) {
        const pasteRef = pastedContents[key];
        if (!pasteRef) continue;
        const pastedText = await readClaudePasteContent(executor, home, pasteRef.contentHash);
        if (pastedText) {
          chunks.push(`[Pasted text #${pasteRef.id ?? key}]\n${pastedText}`);
        }
      }
    }

    const timestamp = Number(row.timestamp ?? 0);
    const bucket = grouped.get(sessionId) ?? { entries: [], project: row.project ?? null };
    bucket.entries.push({
      timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
      text: chunks.join("\n\n"),
    });
    bucket.project = bucket.project ?? row.project ?? null;
    grouped.set(sessionId, bucket);
  }

  return Array.from(grouped.entries())
    .map(([sessionId, value]) => buildConversationSummary("claude", sessionId, value.entries, value.project))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

async function deleteCodexHistory(executor: Executor, home: string, sessionIds: string[]): Promise<number> {
  return deleteJsonlSessions<CodexHistoryRow>(
    executor,
    joinHome(home, ".codex/history.jsonl"),
    new Set(sessionIds),
    (row) => row.session_id,
  );
}

async function deleteClaudeHistory(executor: Executor, home: string, sessionIds: string[]): Promise<number> {
  return deleteJsonlSessions<ClaudeHistoryRow>(
    executor,
    joinHome(home, ".claude/history.jsonl"),
    new Set(sessionIds),
    (row) => row.sessionId,
  );
}

export const conversationHistoryService = {
  async list(executor: Executor): Promise<{ codex: ConversationSummary[]; claude: ConversationSummary[] }> {
    const home = await resolveHome(executor);
    const [codex, claude] = await Promise.all([
      loadCodexHistory(executor, home),
      loadClaudeHistory(executor, home),
    ]);
    return { codex, claude };
  },
  async listPage(executor: Executor, source: ConversationSource, offset = 0, limit = 10): Promise<ConversationPage> {
    const home = await resolveHome(executor);
    const all = source === "codex"
      ? await loadCodexHistory(executor, home)
      : await loadClaudeHistory(executor, home);
    const safeOffset = Math.max(0, Math.min(offset, all.length));
    const safeLimit = Math.max(1, limit);
    const items = all.slice(safeOffset, safeOffset + safeLimit);
    const nextOffset = safeOffset + items.length;

    return {
      items,
      total: all.length,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: nextOffset < all.length,
    };
  },
  async delete(executor: Executor, request: ConversationDeleteRequest): Promise<{ deleted: number }> {
    const sessionIds = request.sessionIds
      .map((sessionId) => String(sessionId).trim())
      .filter(Boolean);

    if (sessionIds.length === 0) {
      return { deleted: 0 };
    }

    const home = await resolveHome(executor);
    const uniqueSessionIds = Array.from(new Set(sessionIds));
    const deleted =
      request.source === "codex"
        ? await deleteCodexHistory(executor, home, uniqueSessionIds)
        : await deleteClaudeHistory(executor, home, uniqueSessionIds);

    return { deleted };
  },
};
