// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Twin of backend/models/api-activity.types.ts. Additive history contract.
export type ApiActivityEvent =
  | { type: "text"; delta: string; phase: "commentary" }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; success: boolean; output: string };

export interface ApiActivity {
  events: ApiActivityEvent[];
  /** The backend omitted details beyond its retained history limits. */
  truncated?: true;
}
