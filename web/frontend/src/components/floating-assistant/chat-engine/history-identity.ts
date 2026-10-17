// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ChatTurn } from "./types";

function sameRequest(a: ChatTurn, b: ChatTurn): boolean {
  const attachments = a.attachments ?? [], savedAttachments = b.attachments ?? [];
  return a.role === b.role && a.text === b.text && !!a.auto === !!b.auto
    && !!a.compacted === !!b.compacted && attachments.length === savedAttachments.length
    && attachments.every((attachment, i) => {
      const saved = savedAttachments[i]!;
      // A local data URL becomes a stored attachment URL after admission.
      return attachment.name === saved.name && attachment.mimeType === saved.mimeType
        && attachment.voice?.transcript === saved.voice?.transcript;
    });
}

function sameHistoricalTurn(a: ChatTurn, b: ChatTurn): boolean {
  return Number.isFinite(a.createdAt) && a.createdAt === b.createdAt && sameRequest(a, b);
}

/**
 * Find the request's unique persisted position, preserving the original
 * context/timestamp/attachment guards. A buffer id is not a historical id.
 */
export function findSavedRequestIndex(local: ChatTurn[], saved: ChatTurn[]): number | null {
  const requestIndex = local.length - 2;
  const request = local[requestIndex];
  if (!request || request.role !== "user") return null;
  const previous = local.slice(0, requestIndex);
  if (!previous.length) {
    const matches = saved.flatMap((turn, i) => sameHistoricalTurn(request, turn) ? [i] : []);
    return matches.length === 1 ? matches[0]! : null;
  }

  // Search the WHOLE page, including successors: an ambiguous context must not
  // become unique just because a caller truncated the page at an earlier turn.
  let contextEnd = -1;
  for (let offset = 0; offset <= saved.length - previous.length; offset++) {
    if (!previous.every((turn, index) => sameHistoricalTurn(turn, saved[offset + index]!))) continue;
    if (contextEnd !== -1) return null;
    contextEnd = offset + previous.length;
  }
  const savedRequest = saved[contextEnd];
  return savedRequest && sameRequest(request, savedRequest) ? contextEnd : null;
}

/** Ordinary reload still requires this request's answer at the END of history. */
export function hasSavedRequestOutcome(local: ChatTurn[], saved: ChatTurn[]): boolean {
  return saved.at(-1)?.role === "assistant"
    && findSavedRequestIndex(local, saved) === saved.length - 2;
}
