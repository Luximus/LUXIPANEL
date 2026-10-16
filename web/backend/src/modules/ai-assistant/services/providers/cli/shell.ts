// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared shell helpers for the CLI bridge (`cli-bridge.provider.ts` and its
 * `cli/*` submodules): login-shell wrapping, nohup launch scaffolding and
 * small path/string utilities. Pure command-string builders — no executor
 * calls happen here.
 */

import { quoteArg } from "../../../../../shared/executor/index.js";
import { guardCommand, type ResourceGuardOptions } from "../../../../../shared/resource-guard.js";

// Re-exported so CLI-bridge submodules (and later phases, from other
// services) can import the shell toolbox from ONE place.
export { quoteArg };

/** Shell-safe ` <flag> <model>` fragment for a CLI invocation, or "" when no model. */
export function modelFlag(flag: string, model?: string): string {
  return model ? ` ${flag} ${quoteArg(model)}` : "";
}

// Strip ANSI escapes so the raw codex/gemini terminal log can be scanned for the
// ask sentinel block (claude goes through parseClaudeFinalAnswer instead).
// eslint-disable-next-line no-control-regex
export const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, "g");

/**
 * Wrap a command in bash with the user's full env loaded. `.bashrc`
 * typically early-returns on non-interactive shells, so we source rc
 * files explicitly + prepend the common CLI install dirs to PATH.
 */
export function loginShell(cmd: string): string {
  const primer = [
    '. /etc/profile 2>/dev/null',
    '. "$HOME/.profile" 2>/dev/null',
    '. "$HOME/.bash_profile" 2>/dev/null',
    '. "$HOME/.bashrc" 2>/dev/null',
    'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"',
    '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null',
    'export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.bun/bin:/usr/local/bin:$PATH"',
    'if [ -d "$HOME/.nvm/versions/node" ]; then for d in "$HOME"/.nvm/versions/node/*/bin; do [ -d "$d" ] && PATH="$d:$PATH"; done; export PATH; fi',
  ].join("; ");
  return `bash -c ${quoteArg(`${primer}; ${cmd}`)}`;
}

/**
 * Build the nohup launch command for a CLI provider.
 * Reads the prompt from `promptFile`, runs the CLI with login env, redirects
 * stdout+stderr to `logFile`, writes exit code to `exitFile`, and detaches.
 * Returns the PID via stdout.
 */
export function buildNohupLaunch(
  cliCmd: string,
  logFile: string,
  exitFile: string,
  cwd?: string,
  envPrefix?: string,
  cleanup?: string,
  guardOptions?: Omit<ResourceGuardOptions, "kind">,
): string {
  // Inner script: cd if needed, export env (sudo askpass), run CLI, capture
  // the CLI's exit code BEFORE any cleanup, run cleanup, then write the code.
  const cdPart = cwd ? `cd ${quoteArg(cwd)} 2>/dev/null || true; ` : "";
  const envPart = envPrefix ? `${envPrefix} ` : "";
  const cleanupPart = cleanup ? `${cleanup} 2>/dev/null; ` : "";
  // The supervisor stays outside the scope to preserve the exit file even
  // when the kernel stops the entire workload for exceeding its memory cap.
  const inner = `${cdPart}${envPart}${guardCommand(cliCmd, { ...guardOptions, kind: "cli" })}; __rc=$?; ${cleanupPart}echo $__rc > ${quoteArg(exitFile)}`;

  // nohup + & + disown ensures the process survives SSH session closure
  const launch = `nohup bash -c ${quoteArg(inner)} > ${quoteArg(logFile)} 2>&1 & PID=$!; disown $PID; echo $PID`;
  return loginShell(launch);
}

/** Short session id for the displayed command line (full uuid is noisy). */
export function shortId(id?: string): string {
  return id ? id.slice(0, 8) : "";
}

export function safePathFragment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
