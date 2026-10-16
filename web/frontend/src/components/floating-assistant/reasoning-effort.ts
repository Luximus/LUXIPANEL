// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
export const CHAT_REASONING_EFFORTS = ["", "low", "medium", "high", "xhigh", "max"] as const;
export type ChatReasoningEffort = typeof CHAT_REASONING_EFFORTS[number];

export function normalizeReasoningEffort(value: unknown): ChatReasoningEffort {
  return CHAT_REASONING_EFFORTS.includes(value as ChatReasoningEffort) ? value as ChatReasoningEffort : "";
}
