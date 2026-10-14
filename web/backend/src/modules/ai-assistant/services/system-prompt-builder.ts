// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * System-prompt builder — assembles an agent run's STABLE system prompt
 * (base layers → ask/CLI directives → approval mode → role/agent persona →
 * project context & hierarchy → marketplace block → agent projects →
 * delegation/team roster → skill prompt blocks → LANGUAGE OVERRIDE) plus the
 * separate VOLATILE `systemContext`, the run-scoped tool additions
 * (lxp_ask / agents.delegate / chats.create / team.*), the resolved cwd and
 * the file-jail paths. Code moved verbatim from `agentService.run`.
 *
 * STABILITY INVARIANT (prompt cache): for the same inputs the stable prompt
 * must stay byte-identical — stable blocks go BEFORE the LANGUAGE OVERRIDE
 * and the volatile snapshot lives in `systemContext`, placed after the cache
 * breakpoint by the provider. Do NOT reorder blocks or change
 * separators/whitespace.
 *
 * ── Layout ──────────────────────────────────────────────────────────────────
 * This file is a FAÇADE re-exporting the same public surface. The
 * implementation is split under `./system-prompt/`:
 *   • types.ts            — `RunAgent`, `SystemPromptBuildInput/Result`.
 *   • blocks.ts           — pure prompt-block builders + constants
 *                           (incl. `buildCliModeBlock`, `BASE_SYSTEM_PROMPT`).
 *   • delegation-tools.ts — `agents.delegate` / `chats.create` tool builders.
 *   • build.ts            — the `buildSystemPrompt` assembler.
 */

export type { RunAgent, SystemPromptBuildInput, SystemPromptBuildResult } from "./system-prompt/types.js";
export { buildCliModeBlock } from "./system-prompt/blocks.js";
export { buildSystemPrompt } from "./system-prompt/build.js";
