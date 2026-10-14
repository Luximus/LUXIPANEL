// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * CLI-mode provider — bridge between the chat UI and an upstream agent
 * CLI installed on the connected TARGET (claude / codex / gemini /
 * deepseek / grok / minimax).
 *
 * Background execution model (v2):
 *   1. Write the prompt to a temp file on the target (SFTP).
 *   2. Launch the CLI with `nohup ... &` — returns the PID in < 1 s, well
 *      within the LP proxy's 30 s HTTP timeout.
 *   3. Register the job in `cliJobTracker`.
 *   4. Poll the log file every 3 s, yield incremental text deltas so the
 *      browser sees live output while the drawer stays open.
 *   5. If the SSE connection drops (drawer closed / tab switched), stop
 *      yielding but let the tracker keep polling. On completion the tracker
 *      emits a push notification so the user knows to come back.
 *
 * ── Layout ──────────────────────────────────────────────────────────────────
 * This file is a FAÇADE re-exporting the same public surface. The building
 * blocks live under `./cli/`: shared shell helpers (`shell.ts`), per-provider
 * specs (`cli-specs.ts`), sudo askpass (`cli-sudo-askpass.ts`), the MiniMax
 * wrapper sync (`cli-minimax-wrapper.ts`), session continuity (`cli-session.ts`),
 * and the runners split out of this file:
 *   • one-shot.ts      — `runCliOnce` / `runCliOnceBackground` (non-streaming).
 *   • bridge-run.ts    — `makeCliBridgeProvider` (the streaming chat runner).
 *   • recovered-run.ts — `makeRecoveredCliGen` (re-attach after a restart).
 */

// Re-exported for existing importers (unit tests import both from this module).
export { CLI_SPECS, buildClaudeAddDirFlag } from "./cli/cli-specs.js";
export type { CliBuildCtx, CliSpec } from "./cli/cli-specs.js";
export { runCliOnce, runCliOnceBackground } from "./cli/one-shot.js";
export { makeCliBridgeProvider } from "./cli/bridge-run.js";
export { makeRecoveredCliGen } from "./cli/recovered-run.js";
