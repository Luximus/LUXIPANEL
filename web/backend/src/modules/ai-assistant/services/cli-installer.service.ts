// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * CLI status probe — strictly read-only.
 *
 * The Assistant module does NOT install or login CLIs. That lifecycle is
 * owned by the Terminal module (`terminal-cli`), which the user already
 * uses to install/activate/login CLIs in the floating terminal. We just
 * read the resulting state.
 *
 *   - installed:  delegated to `terminalCliService.probeInstalled()` —
 *                 same `bash -lc 'command -v <bin>'` probe the Terminal
 *                 module uses in production.
 *   - loggedIn:   own check for the CLI-specific credentials file
 *                 (no equivalent in terminal-cli; CLIs handle their own
 *                  auth state on disk).
 *
 * Updates the per-target `assistant/config.json` sidecar so the rest of
 * the codebase (factory, providers) can rely on the cached cli.{installed,
 * loggedIn,binPath,version,lastCheckedAt} fields.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { panelConfigDir } from "../../../config/paths.js";
// B-12: the bash env primer lives in ONE place (the CLI-bridge shell toolbox).
// The local copy escaped the quotes by hand instead of using `quoteArg`.
import { loginShell } from "./providers/cli/shell.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import {
  PROVIDER_IDS,
  type AssistantProviderId,
} from "../models/assistant-config.types.js";
import { terminalCliService } from "../../terminal-cli/services/terminal-cli.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("assistant-cli-installer");

interface CliSpec {
  /** Binary expected in PATH on the target. */
  bin: string;
  /** Human-readable install command — for display only; the user runs it
   *  in the Terminal module's floating terminal, not from the Assistant. */
  installCmd: string;
  /** Whether the provider has a real upstream CLI. */
  supported: boolean;
  /** Whether the Terminal module's catalog knows this CLI id. */
  managedByTerminal: boolean;
}

const CLI_SPECS: Record<AssistantProviderId, CliSpec> = {
  claude: {
    bin: "claude",
    installCmd: "sudo npm install -g @anthropic-ai/claude-code",
    supported: true,
    managedByTerminal: true,
  },
  codex: {
    bin: "codex",
    installCmd: "sudo npm install -g @openai/codex",
    supported: true,
    managedByTerminal: true,
  },
  gemini: {
    bin: "gemini",
    installCmd: "sudo npm install -g @google/gemini-cli",
    supported: true,
    managedByTerminal: true,
  },
  deepseek: {
    bin: "deepseek",
    installCmd: "(no hay CLI estable de DeepSeek)",
    supported: false,
    managedByTerminal: false,
  },
  grok: {
    // grok-cli (superagent-ai) is a headless-capable terminal agent (`grok -p`).
    // The Terminal module's catalog installs it; the bridge runs it like gemini.
    bin: "grok",
    installCmd: "curl -fsSL https://raw.githubusercontent.com/superagent-ai/grok-cli/main/install.sh | bash",
    supported: true,
    managedByTerminal: true,
  },
  minimax: {
    // `claude-minimax` is a thin wrapper that execs the real `claude` CLI with
    // ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic and the user's
    // Subscription Key (sk-cp-…) sourced from /etc/luxipanel/claude-minimax.env
    // (mode 0600). The Assistant bridges to it like `claude` (same stream-json
    // parser, same `--disallowedTools Workflow`, same `--resume` semantics),
    // getting Claude Code's full agentic tool/MCP machinery against MiniMax's
    // Anthropic-compatible surface. The Terminal module manages install (this
    // CLI id is NOT exposed in the floating-terminal catalog — install only
    // happens via the installCmd below, which writes the wrapper directly).
    bin: "claude-minimax",
    installCmd: "mkdir -p \"${HOME:-/root}/.local/bin\" && printf '%s' 'IyEvdXNyL2Jpbi9lbnYgYmFzaAojIFdyYXBwZXIgZGUgQ2xhdWRlIENvZGUgcXVlIHJlZGlyaWdlIGFsIGVuZHBvaW50IEFudGhyb3BpYy1jb21wYXRpYmxlIGRlIE1pbmlNYXguCiMgRWwgU3Vic2NyaXB0aW9uIEtleSAoc2stY3AtLi4uKSBzZSBidXNjYSBlbiBlc3RlIG9yZGVuOgojICAgMS4gJEhPTUUvLmNvbmZpZy9sdXhpcGFuZWwvY2xhdWRlLW1pbmltYXguZW52ICAgKHBlci11c2VyLCBtb2RlIDA2MDApCiMgICAyLiAvZXRjL2x1eGlwYW5lbC9jbGF1ZGUtbWluaW1heC5lbnYgICAgICAgICAgICAgKHN5c3RlbS13aWRlLCBtb2RlIDA2MDApCiMgRnVuY2lvbmEgZW4gY3VhbHF1aWVyIHRhcmdldCBzaW4gcmVxdWVyaXIgc3Vkby4gRWwgYnJpZGdlIGRlbCBhc2lzdGVudGUgSUEKIyBlc2NyaWJlIGVsIGFyY2hpdm8gZW4gKDEpIGF1dG9tYXRpY2FtZW50ZS4KdW5zZXQgQU5USFJPUElDX0FQSV9LRVkKRU5WX1VTRVI9IiRIT01FLy5jb25maWcvbHV4aXBhbmVsL2NsYXVkZS1taW5pbWF4LmVudiIKRU5WX1NZUz0iL2V0Yy9sdXhpcGFuZWwvY2xhdWRlLW1pbmltYXguZW52IgppZiBbIC1yICIkRU5WX1VTRVIiIF07IHRoZW4gLiAiJEVOVl9VU0VSIgplbGlmIFsgLXIgIiRFTlZfU1lTIiBdOyB0aGVuIC4gIiRFTlZfU1lTIgpmaQo6ICIke0FOVEhST1BJQ19CQVNFX1VSTDo9aHR0cHM6Ly9hcGkubWluaW1heC5pby9hbnRocm9waWN9Igo6ICIke0FOVEhST1BJQ19NT0RFTDo9TWluaU1heC1NM30iCmV4cG9ydCBBTlRIUk9QSUNfQkFTRV9VUkwgQU5USFJPUElDX01PREVMCmV4cG9ydCBBTlRIUk9QSUNfREVGQVVMVF9TT05ORVRfTU9ERUw9IiRBTlRIUk9QSUNfTU9ERUwiCmV4cG9ydCBBTlRIUk9QSUNfREVGQVVMVF9PUFVTX01PREVMPSIkQU5USFJPUElDX01PREVMIgpleHBvcnQgQU5USFJPUElDX0RFRkFVTFRfSEFJS1VfTU9ERUw9IiRBTlRIUk9QSUNfTU9ERUwiCmV4ZWMgY2xhdWRlICIkQCIK | base64 -d > \"${HOME:-/root}/.local/bin/claude-minimax\" && chmod 0755 \"${HOME:-/root}/.local/bin/claude-minimax\"",
    supported: true,
    managedByTerminal: false,
  },
};

export interface CliProbeResult {
  installed: boolean;
  loggedIn: boolean;
  binPath?: string;
  version?: string;
  detail?: string;
}

async function probeVersion(executor: Executor, bin: string): Promise<string | undefined> {
  const r = await executor.exec(loginShell(`${bin} --version 2>/dev/null || true`), {
    timeoutMs: 5_000,
  });
  const v = r.stdout.trim().split("\n")[0];
  return v || undefined;
}

/** Resolves the env-file path the wrapper should source. Per-user path first
 *  (no sudo needed; the bridge writes here), system-wide fallback (root-owned).
 *  The wrapper itself implements the same lookup order. */
function minimaxEnvPathFor(executor: Executor): Promise<string> {
  // Resolve $HOME on the target — sudo-wrap can move it to /root, so we read it
  // from the executor instead of trusting process.env.HOME on the panel host.
  return executor
    .exec(loginShell(`printf '%s' "\${HOME:-/root}"`))
    .then((r) => `${r.stdout.trim() || "/root"}/.config/luxipanel/claude-minimax.env`)
    .catch(() => "/root/.config/luxipanel/claude-minimax.env");
}

/** True when the env file is present (per-user OR system-wide) and carries an
 *  `ANTHROPIC_AUTH_TOKEN=` line. The `bin` arg is ignored — kept for signature
 *  parity with `probeVersion` and to mirror the per-CLI probe pattern. */
async function probeMinimaxWrapperReady(executor: Executor, _bin: string): Promise<boolean> {
  try {
    const r = await executor.exec(
      loginShell(
        `for f in "\${HOME:-/root}/.config/luxipanel/claude-minimax.env" ${panelConfigDir()}/claude-minimax.env; do test -s "$f" && grep -q '^ANTHROPIC_AUTH_TOKEN=.' "$f" && exit 0; done; exit 1`,
      ),
      { timeoutMs: 5_000 },
    );
    return r.exitCode === 0;
  } catch {
    return false;
  }
}

/** Write (or overwrite, or delete) the env file with the given Subscription
 *  Key. Empty key → unlink both per-user AND system-wide files. Prefers the
 *  per-user path (no sudo) — falls back to system-wide if HOME is unusable. */
async function syncMinimaxWrapperEnv(executor: Executor, apiKey: string | undefined): Promise<void> {
  const trimmed = apiKey?.trim() ?? "";
  const userPath = await minimaxEnvPathFor(executor);
  const sysPath = `${panelConfigDir()}/claude-minimax.env`;
  if (!trimmed) {
    try {
      await executor.exec(loginShell(`rm -f ${userPath} ${sysPath}`), { timeoutMs: 5_000 });
    } catch {
      /* best effort */
    }
    return;
  }
  // Header + ANTHROPIC_AUTH_TOKEN only. ANTHROPIC_BASE_URL / ANTHROPIC_MODEL
  // fall back to wrapper defaults; we don't pin them per-target.
  const content =
    "# LUXIPANEL-managed — written by the AI Assistant module.\n" +
    "# Do not edit by hand. To rotate, change the key in Providers → MiniMax.\n" +
    `ANTHROPIC_AUTH_TOKEN=${trimmed}\n`;
  // Per-user first (no sudo). Ensure parent dir exists.
  try {
    await executor.exec(loginShell(`mkdir -p "$(dirname ${userPath})"`), { timeoutMs: 5_000 });
    await executor.writeFile(userPath, Buffer.from(content, "utf8"));
    await executor
      .exec(loginShell(`chmod 0700 "$(dirname ${userPath})" && chmod 0600 ${userPath}`), { timeoutMs: 5_000 })
      .catch(() => undefined);
    return;
  } catch (err) {
    // Fall back to system-wide if the per-user write fails (rare — e.g. read-only HOME).
    log.warn({ err: (err as Error).message, userPath }, "per-user env file write failed; falling back to system-wide");
  }
  await executor.writeFile(sysPath, Buffer.from(content, "utf8"));
  await executor
    .exec(loginShell(`chmod 0600 ${sysPath}`), { timeoutMs: 5_000 })
    .catch(() => undefined);
}

async function probeBinPath(executor: Executor, bin: string): Promise<string | undefined> {
  const r = await executor.exec(loginShell(`command -v ${bin} 2>/dev/null || true`), {
    timeoutMs: 5_000,
  });
  const p = r.stdout.trim().split("\n")[0];
  return p || undefined;
}

async function patchCliState(
  providerId: AssistantProviderId,
  patch: CliProbeResult,
  executor?: Executor | null,
): Promise<void> {
  const cfg = await assistantConfigRepository.load(executor);
  const slot = cfg.providers[providerId];
  cfg.providers[providerId] = {
    ...slot,
    cli: {
      ...(slot.cli ?? { installed: false, loggedIn: false }),
      installed: patch.installed,
      loggedIn: patch.loggedIn,
      binPath: patch.binPath,
      version: patch.version,
      lastCheckedAt: new Date().toISOString(),
    },
  };
  await assistantConfigRepository.save(cfg, executor);
}

export const cliInstallerService = {
  /** Lists provider CLIs with their (display-only) install commands. */
  list(): Array<{
    id: AssistantProviderId;
    bin: string;
    installCmd: string;
    supported: boolean;
    managedByTerminal: boolean;
  }> {
    return PROVIDER_IDS.map((id) => ({
      id,
      bin: CLI_SPECS[id].bin,
      installCmd: CLI_SPECS[id].installCmd,
      supported: CLI_SPECS[id].supported,
      managedByTerminal: CLI_SPECS[id].managedByTerminal,
    }));
  },

  /**
   * Probe CLI presence on the connected target.
   *
   * We DO NOT probe `loggedIn` separately — every CLI stores credentials
   * differently (some in `~/.claude/`, some via system keyring, some in
   * `~/.config/<vendor>/`), and a file-presence check is fragile. The
   * user manages install + login via the Terminal module; the Assistant
   * trusts that work. If the CLI isn't actually logged in when the chat
   * invokes it, the CLI itself will surface the error in stdout (which
   * we relay verbatim through `cli-bridge.provider`).
   *
   * `installed` comes from `terminalCliService.probeInstalled()` (same
   * probe the Terminal module uses), with a direct `command -v` fallback
   * for non-standard PATH layouts.
   */
  async status(
    providerId: AssistantProviderId,
    executor: Executor,
  ): Promise<CliProbeResult> {
    const spec = CLI_SPECS[providerId];

    let installed = false;
    if (spec.managedByTerminal) {
      try {
        const probe = await terminalCliService.probeInstalled(executor);
        installed = Boolean((probe as Record<string, boolean | undefined>)[providerId]);
      } catch (err) {
        log.warn({ err, providerId }, "terminal probeInstalled failed; falling back to direct probe");
      }
    }

    let binPath: string | undefined;
    if (!installed) {
      // Fallback: direct `command -v` in case terminal-cli's probe missed
      // the binary (non-standard PATH on the target).
      binPath = await probeBinPath(executor, spec.bin);
      installed = Boolean(binPath);
    } else if (!spec.managedByTerminal) {
      // Terminal probe didn't run — resolve binPath directly.
      binPath = await probeBinPath(executor, spec.bin);
    }

    if (!installed) {
      const result: CliProbeResult = { installed: false, loggedIn: false };
      await patchCliState(providerId, result, executor);
      return result;
    }

    const version = await probeVersion(executor, binPath ?? spec.bin);
    // Most CLIs: treat installed as ready-to-use (the user authenticated them
    // via the Terminal module's flow). MiniMax: the wrapper is "logged in" when
    // /etc/luxipanel/claude-minimax.env exists with ANTHROPIC_AUTH_TOKEN set —
    // we sync the file from the configured API key on every status probe so the
    // wrapper always reflects the latest Subscription Key the user saved.
    let loggedIn = true;
    if (providerId === "minimax") {
      const cfg = await assistantConfigRepository.load(executor);
      const apiKey = cfg.providers.minimax?.api?.apiKey;
      await syncMinimaxWrapperEnv(executor, apiKey);
      loggedIn = await probeMinimaxWrapperReady(executor, binPath ?? spec.bin);
    }
    const result: CliProbeResult = { installed: true, loggedIn, binPath, version };
    await patchCliState(providerId, result, executor);
    return result;
  },
};
