// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Portable presentation helper. Its web/mobile copies are checked by tests.
export const VISIBLE_SUMMARY_MAX = 240;

/** A bounded preview, never a replacement for canonical context or evidence. */
export function visibleSummary(input: string): string {
  let text = input.trim().replace(/^```(?:toon|json)?\s*\n([\s\S]*?)\n```$/i, "$1").trim();
  // Only project the root summary scalar of a TOON envelope. The backend SDK
  // validates the entire document; clients never execute or interpret its data.
  if (/^(?:protocol:\s*lxp\.agent\.v1|kind:\s*(?:request|progress|result|blocked|question))\s*(?:\n|$)/.test(text)) {
    const scalar = text.match(/^summary:[ \t]*(.*)$/m)?.[1]?.trim();
    if (!scalar) return "";
    try { text = scalar.startsWith('"') ? JSON.parse(scalar) : scalar; } catch { return ""; }
    if (typeof text !== "string") return "";
  }
  if (/^\{\s*"(?:protocol|kind|summary)"\s*:/.test(text)) {
    try {
      const data = JSON.parse(text);
      text = (data.protocol === "lxp.agent.v1" || ["request", "progress", "result", "blocked", "question"].includes(data.kind)) && typeof data.summary === "string" ? data.summary : "";
    } catch { return ""; } // Never leak a partial internal envelope into a bubble.
  }
  text = text.replace(/<<<LXP_ASK>>>[\s\S]*?(?:<<<LXP_ASK_END>>>|$)/g, "")
    .replace(/^\[MENSAJE DE ([^\n]+?)\s*\(agente [^)]+\)\]\s*/i, "$1: ")
    .replace(/^\[EQUIPO\]\s*/i, "")
    .replace(/```[\s\S]*?(?:```|$)/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:#{1,6}\s+|[-*>]\s+|\d+[.)]\s+)/gm, "")
    .replace(/[*_`~]/g, "").replace(/\s+/g, " ").trim();
  // Require whitespace after punctuation, preserving URLs/versions/decimals.
  const sentences = text.match(/.*?[.!?](?=\s|$)|.+$/gu) ?? [];
  const preview = sentences.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
  const points = Array.from(preview);
  if (points.length <= VISIBLE_SUMMARY_MAX) return preview;
  const head = points.slice(0, VISIBLE_SUMMARY_MAX - 1).join("");
  const boundary = head.lastIndexOf(" ");
  return (boundary > 160 ? head.slice(0, boundary) : head).trimEnd() + "…";
}
