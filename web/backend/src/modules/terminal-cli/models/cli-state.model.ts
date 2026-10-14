// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
export type CliId =
  | "default"
  | "opencode"
  | "claude"
  | "codex"
  | "grok"
  | "gemini"
  | "copilot"
  | "cursor"
  | "aider"
  | "qwen"
  | "continue"
  | "goose"
  | "crush"
  | "amp"
  | "openhands"
  | "codebuff"
  | "minimax";

export interface TerminalCliState {
  onboardingDone: boolean;
  installed: CliId[];
  active: CliId;
  updatedAt: string;
}

export const DEFAULT_STATE: TerminalCliState = {
  onboardingDone: false,
  installed: ["default"],
  active: "default",
  updatedAt: new Date(0).toISOString(),
};
