// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { parseAgentPacket } from "./agent-envelope.js";
import { visibleSummary } from "./visible-summary.js";

export type MessagePresentation = "full" | "summary";

/** Presentation never replaces the canonical answer or its translated text. */
export function messagePresentation(
  content: string,
  state: { pending?: boolean; error?: string; interrupted?: boolean; awaitingInput?: boolean } = {},
): { presentation: MessagePresentation; displaySummary?: string } {
  if (state.pending || state.error || state.interrupted || state.awaitingInput) {
    return { presentation: "full" };
  }
  // Only a validated coordination packet explicitly supplies a display summary.
  // Prose, documents, code and unrecognized formats retain their complete text;
  // no language-dependent intent heuristic may turn them into a short answer.
  try {
    const packet = parseAgentPacket(content);
    if (packet.kind === "result") {
      return { presentation: "summary", displaySummary: visibleSummary(packet.summary) };
    }
  } catch { /* Legacy/free-form answer: preserve it in full. */ }
  return { presentation: "full", displaySummary: visibleSummary(content) };
}
