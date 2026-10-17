// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Ordered, redacted API process history. The final answer lives in content. */
export type ApiActivityEvent =
  | { type: "text"; delta: string; phase: "commentary" }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; success: boolean; output: string };

export interface ApiActivity {
  events: ApiActivityEvent[];
  /** At least one detail exceeded the retained history limits. */
  truncated?: true;
}
