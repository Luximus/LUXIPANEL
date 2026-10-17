// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AgentProvider } from "../provider.types.js";

/** Keep prompt capabilities aligned with the bridges that attach this channel. */
export function supportsCliCrossChannel(provider: Pick<AgentProvider, "id" | "mode">): boolean {
  return provider.mode === "cli" && ["claude", "minimax", "codex"].includes(provider.id);
}
