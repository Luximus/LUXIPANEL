// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Canonical CLI registry — must stay in sync with
 * frontend/src/components/floating-terminal/cli-registry.ts.
 *
 * The backend only needs the `command` (for ~/.bashrc autostart) and the
 * `id` whitelist for validation. Install/uninstall commands live in the
 * frontend because the panel injects them directly into the PTY.
 */

import type { CliId } from "../models/cli-state.model.js";

export interface CliCatalogEntry {
  id: CliId;
  label: string;
  /** Binary name to exec in ~/.bashrc when this CLI is active. */
  command: string;
}

export const CLI_CATALOG: CliCatalogEntry[] = [
  { id: "default", label: "Default", command: "" },
  { id: "opencode", label: "Opencode", command: "opencode" },
  { id: "claude", label: "Claude CLI", command: "claude" },
  { id: "codex", label: "Codex CLI", command: "codex" },
  { id: "grok", label: "Grok CLI", command: "grok" },
  { id: "gemini", label: "Gemini CLI", command: "gemini" },
  { id: "copilot", label: "GitHub Copilot CLI", command: "copilot" },
  { id: "cursor", label: "Cursor CLI", command: "cursor-agent" },
  { id: "aider", label: "Aider", command: "aider" },
  { id: "qwen", label: "Qwen Code", command: "qwen" },
  { id: "continue", label: "Continue CLI", command: "cn" },
  { id: "goose", label: "Goose CLI", command: "goose" },
  { id: "crush", label: "Crush", command: "crush" },
  { id: "amp", label: "Amp", command: "amp" },
  { id: "openhands", label: "OpenHands", command: "openhands" },
  { id: "codebuff", label: "Codebuff", command: "codebuff" },
  { id: "minimax", label: "MiniMax CLI", command: "mmx" },
];

export const VALID_CLI_IDS: ReadonlySet<CliId> = new Set(CLI_CATALOG.map((c) => c.id));

export function isValidCliId(id: string): id is CliId {
  return VALID_CLI_IDS.has(id as CliId);
}

export function getCliCommand(id: CliId): string {
  return CLI_CATALOG.find((c) => c.id === id)?.command ?? "";
}
