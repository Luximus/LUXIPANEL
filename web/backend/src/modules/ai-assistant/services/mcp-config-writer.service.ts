// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP config writer — writes/merges the panel's MCP server entry directly
 * into the CLI's config file ON THE TARGET, via the request executor.
 *
 * No copy-paste: the user clicks "Configurar" and the panel SSHes the file
 * in. Merges are non-destructive — we only touch the `luxipanel` server
 * entry, preserving any other MCP servers the user already configured.
 *
 * Config locations per CLI:
 *   - claude  → ~/.claude.json            (top-level `mcpServers` object)
 *   - gemini  → ~/.gemini/settings.json   (top-level `mcpServers` object)
 *   - codex   → ~/.codex/config.toml      ([mcp_servers.luxipanel] table)
 */

import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { AssistantProviderId } from "../models/assistant-config.types.js";

const log = createModuleLogger("assistant-mcp-config-writer");

const SERVER_KEY = "luxipanel";

export interface McpInstallResult {
  ok: boolean;
  path: string;
  detail: string;
}

interface JsonTarget {
  format: "json";
  /** Path relative to $HOME (no leading slash). */
  relPath: string;
  /** Build the server entry object stored under mcpServers.luxipanel. */
  entry: (url: string, token: string) => Record<string, unknown>;
}
interface TomlTarget {
  format: "toml";
  relPath: string;
  entry: (url: string, token: string) => string;
}
type Target = JsonTarget | TomlTarget;

const TARGETS: Record<AssistantProviderId, Target | null> = {
  claude: {
    format: "json",
    relPath: ".claude.json",
    entry: (url, token) => ({
      type: "http",
      url,
      headers: { Authorization: `Bearer ${token}` },
    }),
  },
  gemini: {
    format: "json",
    relPath: ".gemini/settings.json",
    entry: (url, token) => ({
      httpUrl: url,
      headers: { Authorization: `Bearer ${token}` },
    }),
  },
  codex: {
    format: "toml",
    relPath: ".codex/config.toml",
    entry: (url, token) =>
      [
        `[mcp_servers.${SERVER_KEY}]`,
        `url = "${url}"`,
        `http_headers = { Authorization = "Bearer ${token}" }`,
      ].join("\n"),
  },
  deepseek: null,
  grok: null,
  minimax: null,
};

/**
 * Whether a provider's CLI has a known config location we can write the MCP
 * server entry into. False for API-only providers (deepseek/grok/minimax):
 * there is no CLI on the target to reinstall a token for.
 */
export function supportsMcpAutoInstall(providerId: AssistantProviderId): boolean {
  return TARGETS[providerId] !== null;
}

async function readFileSafe(executor: Executor, path: string): Promise<string | null> {
  try {
    const r = await executor.readFile(path, "utf8");
    return typeof r === "string" ? r : r.toString("utf8");
  } catch {
    return null; // missing file → caller treats as empty
  }
}

/** `$HOME` on the target (login shell so it's the real user home). */
async function homeDir(executor: Executor): Promise<string> {
  const r = await executor.exec(`printf %s "$HOME"`, { timeoutMs: 5_000 });
  const h = r.stdout.trim();
  return h || "/root";
}

/** Thrown when the existing config can't be parsed — the caller must back it
 *  up and abort rather than overwrite (the file may hold the user's
 *  `projects`/history/auth, not just `mcpServers`). */
class CorruptConfigError extends Error {}

function mergeJson(existing: string | null, entry: Record<string, unknown>): string {
  let obj: Record<string, unknown> = {};
  if (existing && existing.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(existing);
    } catch {
      throw new CorruptConfigError("Existing MCP config is not valid JSON");
    }
    // A valid-but-non-object root (array, number, string) would still drop the
    // user's data if we reset to `{}` — treat it as corrupt and abort too.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CorruptConfigError("Existing MCP config root is not a JSON object");
    }
    obj = parsed as Record<string, unknown>;
  }
  const servers = (obj["mcpServers"] && typeof obj["mcpServers"] === "object"
    ? (obj["mcpServers"] as Record<string, unknown>)
    : {});
  servers[SERVER_KEY] = entry;
  obj["mcpServers"] = servers;
  return JSON.stringify(obj, null, 2);
}

function mergeToml(existing: string | null, block: string): string {
  const text = existing ?? "";
  // Drop any previous [mcp_servers.luxipanel] table (until next [section]).
  const lines = text.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const isHeader = /^\s*\[/.test(line);
    if (isHeader) {
      // Drop the `[mcp_servers.luxipanel]` table AND any of its sub-tables
      // (`[mcp_servers.luxipanel.env]`, …): the char right after the name must
      // be `]` (the table itself) or `.` (a sub-table). The old regex matched
      // only the bare table, leaving orphan sub-tables → corrupt TOML.
      skipping = /^\s*\[mcp_servers\.luxipanel[\].]/.test(line);
    }
    if (!skipping) out.push(line);
  }
  let body = out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  body = body ? `${body}\n\n${block}\n` : `${block}\n`;
  return body;
}

export const mcpConfigWriterService = {
  /**
   * Write/merge the MCP server entry into the target's CLI config.
   * `mcpUrl` is the panel's `/api/ai/mcp` endpoint; `token` the minted JWT.
   */
  async install(
    providerId: AssistantProviderId,
    mcpUrl: string,
    token: string,
    executor: Executor,
  ): Promise<McpInstallResult> {
    const target = TARGETS[providerId];
    if (!target) {
      return { ok: false, path: "", detail: `Provider ${providerId} no soporta MCP automático.` };
    }

    const home = await homeDir(executor);
    const absPath = `${home}/${target.relPath}`;
    const dir = absPath.slice(0, absPath.lastIndexOf("/"));

    // Ensure parent dir exists (e.g. ~/.gemini, ~/.codex).
    await executor.exec(`mkdir -p ${quoteArg(dir)}`, { timeoutMs: 5_000 });

    const existing = await readFileSafe(executor, absPath);
    let content: string;
    try {
      if (target.format === "json") {
        content = mergeJson(existing, target.entry(mcpUrl, token));
      } else {
        content = mergeToml(existing, target.entry(mcpUrl, token));
      }
    } catch (err) {
      if (err instanceof CorruptConfigError) {
        // NEVER overwrite an unparseable config — it likely holds the user's
        // projects/history/auth. Back it up (best-effort) and abort the merge.
        const backup = `${absPath}.bak`;
        try {
          await executor.exec(
            `cp -f ${quoteArg(absPath)} ${quoteArg(backup)}`,
            { timeoutMs: 5_000 },
          );
        } catch (bakErr) {
          log.warn({ bakErr, absPath }, "Could not back up corrupt MCP config before aborting");
        }
        log.error({ providerId, absPath }, "Existing MCP config is corrupt; aborting merge to avoid data loss");
        return {
          ok: false,
          path: absPath,
          detail: `El archivo ${absPath} no es válido y no se modificó (respaldo en ${backup}). Revísalo manualmente.`,
        };
      }
      throw err;
    }

    try {
      await executor.writeFile(absPath, content, { encoding: "utf8" });
      // Lock down — the file holds a bearer token.
      await executor.exec(`chmod 600 ${quoteArg(absPath)}`, { timeoutMs: 5_000 });
    } catch (err) {
      log.error({ err, providerId, absPath }, "Failed to write MCP config");
      return { ok: false, path: absPath, detail: (err as Error).message };
    }

    log.info({ providerId, absPath }, "MCP config written to target");
    return { ok: true, path: absPath, detail: `Configurado en ${absPath}` };
  },
};
