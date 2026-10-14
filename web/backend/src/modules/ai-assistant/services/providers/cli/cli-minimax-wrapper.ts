// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MiniMax wrapper sync — ensures (a) the wrapper bash script exists at a
 * known absolute path on the target and (b) the env file with the current
 * Subscription Key is in place — BEFORE the bridge launches `claude-minimax`.
 *
 * Both files are deployed per-user (under `${HOME}/.local/bin/` and
 * `${HOME}/.config/luxipanel/`) so it works in managed mode on any target
 * without requiring sudo. Falls back to `/etc/luxipanel/` + `/usr/local/bin/`
 * if those paths are present (system-wide deployment).
 *
 * Cached per target with a short TTL to avoid SFTP churn on every turn. Also
 * synced by `cli-installer.service.ts#status()`, so this is a defensive re-sync
 * right before launch — if the user edited the key between probe and chat, the
 * new key wins.
 */

import { createModuleLogger } from "../../../../../shared/logger/index.js";
import type { Executor } from "../../../../../shared/executor/index.js";
import { quoteArg } from "../../../../../shared/executor/index.js";
import { loginShell } from "./shell.js";
import { MINIMAX_AUTH_TTL_MS } from "./cli-constants.js";
import { panelConfigDir } from "../../../../../config/paths.js";

const log = createModuleLogger("provider-cli-bridge");

/** Wrapper script content — kept as a TS string (not base64) so it stays
 *  readable, diff-friendly, and trivially editable. Deployed via SFTP to the
 *  target's `${HOME}/.local/bin/claude-minimax` (or `/usr/local/bin/` fallback).
 *  MUST stay in sync with the canonical wrapper installed on the panel host
 *  (`/usr/local/bin/claude-minimax`).
 *
 *  The wrapper looks for the env file in MULTIPLE paths because:
 *    - When the bridge launches under sudo, `$HOME=/root` even though the
 *      actual env file was written to the user's real HOME (SFTP runs as
 *      the SSH user, not root; LP rejects writes outside the user's tree).
 *      `$SUDO_USER` resolves the invoking user's real HOME dynamically —
 *      no hardcoded usernames (leaking deployment-specific homes into every
 *      target's wrapper was both wrong and a name disclosure).
 *    - We want auto-recovery: any path that exists wins.
 */
function buildMinimaxWrapperScript(configDir: string): string {
  return [
  "#!/usr/bin/env bash",
  "# Wrapper de Claude Code que redirige al endpoint Anthropic-compatible de MiniMax.",
  "# Busca el env file (sk-cp-...) en $HOME, el HOME real del usuario sudo y",
  `# ${configDir}, para tolerar sudo y deployments en /usr/local/bin/.`,
  "unset ANTHROPIC_API_KEY",
  'SUDO_HOME=""',
  'if [ -n "${SUDO_USER:-}" ]; then SUDO_HOME=$(getent passwd "$SUDO_USER" 2>/dev/null | cut -d: -f6); fi',
  'for ENV_CANDIDATE in \\',
  '  "$HOME/.config/luxipanel/claude-minimax.env" \\',
  '  "${SUDO_HOME:+$SUDO_HOME/.config/luxipanel/claude-minimax.env}" \\',
  `  ${configDir}/claude-minimax.env; do`,
  '  if [ -n "$ENV_CANDIDATE" ] && [ -r "$ENV_CANDIDATE" ]; then . "$ENV_CANDIDATE"; break; fi',
  "done",
  ': "${ANTHROPIC_BASE_URL:=https://api.minimax.io/anthropic}"',
  ': "${ANTHROPIC_MODEL:=MiniMax-M3}"',
  "export ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_MODEL",
  'export ANTHROPIC_DEFAULT_SONNET_MODEL="$ANTHROPIC_MODEL"',
  'export ANTHROPIC_DEFAULT_OPUS_MODEL="$ANTHROPIC_MODEL"',
  'export ANTHROPIC_DEFAULT_HAIKU_MODEL="$ANTHROPIC_MODEL"',
  // Reenviamos TODOS los args al `claude` real. Los flags nativos
  // (`--add-dir`, `--permission-mode plan`, `--dangerously-skip-permissions`,
  // `--permission-prompt-tool …`, `--mcp-config …`, etc.) los añade el bridge
  // de LUXIPANEL según el modo de aprobación del usuario. NO filtrar nada
  // aquí — el upstream decide qué soporta cada versión. Si una versión
  // rechaza un flag, falla ruidosamente en el target y el log del job lo
  // muestra (mejor que esconderlo aquí).
  'exec claude "$@"',
  "",
  ].join("\n");
}

/** Per-target TTL cache of the last successful env-file sync. Exported so the
 *  bridge's MiniMax auth self-heal can invalidate it (`.delete(cacheKey)`)
 *  before re-syncing the wrapper. */
export const minimaxAuthOk = new Map<string, number>();

async function resolveHome(executor: Executor): Promise<string> {
  try {
    const r = await executor.exec(loginShell(`printf '%s' "\${HOME:-/root}"`), { timeoutMs: 5_000 });
    return r.stdout.trim() || "/root";
  } catch {
    return "/root";
  }
}

/** Deploy the wrapper bash script to `${HOME}/.local/bin/claude-minimax` on the
 *  target (no sudo). ALWAYS overwrites if the existing file content differs —
 *  this guarantees the target's wrapper matches the canonical version even if
 *  the user previously had an older one (e.g. hardcoded sk-cp from earlier
 *  deployments). The file is tiny (~600 bytes) so the SFTP cost is negligible. */
async function ensureMinimaxWrapperScript(executor: Executor, home: string): Promise<string> {
  const userPath = `${home}/.local/bin/claude-minimax`;
  const sysPath = "/usr/local/bin/claude-minimax";
  const qUserPath = quoteArg(userPath);
  const wrapperScript = buildMinimaxWrapperScript(panelConfigDir());
  // Check the user path first; if it is already current we keep using it.
  let exists = false;
  try {
    const r = await executor.exec(loginShell(`test -x ${qUserPath} && echo yes || echo no`), { timeoutMs: 5_000 });
    exists = r.stdout.trim() === "yes";
  } catch { /* assume missing */ }
  // If the user path exists AND matches the canonical script → no-op.
  if (exists) {
    try {
      const r = await executor.exec(
        loginShell(
          `if diff -q ${qUserPath} /dev/stdin >/dev/null 2>&1 <<'CANON_EOF'\n${wrapperScript}CANON_EOF\nthen echo MATCH; else echo MISMATCH; fi`,
        ),
        { timeoutMs: 5_000 },
      );
      if (r.stdout.trim() === "MATCH") {
        return userPath;
      }
      log.info({ target: executor.target.id || executor.target.name, path: userPath }, "wrapper exists but content differs; overwriting");
    } catch {
      // diff/heredoc failed (sh quirks with embedded EOF marker) → fall through to overwrite.
    }
  }
  // Deploy (or overwrite) per-user (no sudo). This path is intentionally
  // preferred over any pre-existing system-wide wrapper so the bridge can
  // self-heal stale `/usr/local/bin/claude-minimax` installs.
  try {
    await executor.exec(loginShell(`mkdir -p "$(dirname ${qUserPath})"`), { timeoutMs: 5_000 });
    await executor.writeFile(userPath, Buffer.from(wrapperScript, "utf8"));
    await executor
      .exec(loginShell(`chmod 0755 ${qUserPath}`), { timeoutMs: 5_000 })
      .catch(() => undefined);
    log.info({ target: executor.target.id || executor.target.name, path: userPath }, "claude-minimax wrapper auto-deployed");
    return userPath;
  } catch (err) {
    log.warn({ err: (err as Error).message, userPath }, "auto-deploy of wrapper failed; user must install manually");
  }
  // Fall back to an existing system-wide path only if writing the preferred
  // per-user wrapper failed.
  try {
    const r2 = await executor.exec(loginShell(`test -x ${sysPath} && echo yes || echo no`), { timeoutMs: 5_000 });
    if (r2.stdout.trim() === "yes") return sysPath;
  } catch { /* ignore */ }
  return userPath;
}

export async function ensureMinimaxWrapper(executor: Executor, apiKey?: string): Promise<void> {
  const cacheKey = executor.target.id || executor.target.name || "default";
  const trimmed = apiKey?.trim() ?? "";
  log.info(
    { target: cacheKey, hasApiKey: Boolean(trimmed), apiKeyLen: trimmed.length },
    "ensureMinimaxWrapper invoked",
  );
  const home = await resolveHome(executor);

  // No stored credential → make sure no stale env files are around (the wrapper
  // would otherwise use whatever was left from a previous key). `/root` copy is
  // legacy (older versions duplicated the key there) — keep purging it.
  if (!trimmed) {
    try {
      await executor.exec(
        loginShell(
          `rm -f ${quoteArg(`${home}/.config/luxipanel/claude-minimax.env`)} /root/.config/luxipanel/claude-minimax.env ${quoteArg(`${panelConfigDir()}/claude-minimax.env`)}`,
        ),
        { timeoutMs: 5_000 },
      );
    } catch { /* best effort */ }
    return;
  }

  // Always (re-)deploy the wrapper script — it's tiny and we want the target's
  // version to match the canonical one in case defaults changed. Cheap.
  await ensureMinimaxWrapperScript(executor, home);

  // Already synced the env file recently → skip the write.
  const cached = minimaxAuthOk.get(cacheKey);
  if (cached && Date.now() - cached < MINIMAX_AUTH_TTL_MS) return;

  const content =
    "# LUXIPANEL-managed — written by the AI Assistant module.\n" +
    "# Do not edit by hand. To rotate, change the key in Providers → MiniMax.\n" +
    `ANTHROPIC_AUTH_TOKEN=${trimmed}\n`;

  // The bridge may launch the CLI under `sudo` — inside that context `$HOME`
  // becomes `/root` while the key lives in the user's real HOME. The wrapper
  // resolves that dynamically via `$SUDO_USER` (see MINIMAX_WRAPPER_SCRIPT),
  // so the key is written ONCE, to the resolved user HOME — no `/root`
  // duplicate (one fewer copy of a secret on disk).
  const filePath = `${home}/.config/luxipanel/claude-minimax.env`;
  const qFilePath = quoteArg(filePath);
  try {
    await executor.exec(loginShell(`mkdir -p "$(dirname ${qFilePath})"`), { timeoutMs: 5_000 });
    await executor.writeFile(filePath, Buffer.from(content, "utf8"));
    await executor
      .exec(loginShell(`chmod 0700 "$(dirname ${qFilePath})" && chmod 0600 ${qFilePath}`), { timeoutMs: 5_000 })
      .catch(() => undefined);
  } catch (err) {
    log.warn({ target: cacheKey, err: (err as Error).message, path: filePath }, "env file write failed for path");
  }
  // Purge the legacy `/root` duplicate: under sudo `$HOME=/root`, so a stale
  // copy there would shadow the fresh key we just wrote (the wrapper falls
  // back to `$SUDO_USER`'s HOME once it's gone). Best-effort.
  if (home !== "/root") {
    await executor
      .exec(loginShell(`rm -f /root/.config/luxipanel/claude-minimax.env`), { timeoutMs: 5_000 })
      .catch(() => undefined);
  }
  minimaxAuthOk.set(cacheKey, Date.now());
  log.info({ target: cacheKey, path: filePath }, "claude-minimax env file synced");
}
