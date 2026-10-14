// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Vision capability per (provider, model) — the single source of truth the
 * backend uses to decide whether an image/PDF attachment may be forwarded to a
 * provider's API. The frontend mirrors this in
 * `frontend/src/components/floating-assistant/vision-support.ts`; keep both in
 * sync. Server-side enforcement here is the fail-safe: it stops a non-vision
 * model from triggering an upstream 4xx when the UI gating is bypassed.
 */

import type { AssistantProviderId } from "../../models/assistant-config.types.js";

/** Models known to be text-only within an otherwise multimodal provider. */
const OPENAI_TEXT_ONLY = /(^|[^a-z])(o1-mini|o1-preview|o3-mini)([^a-z]|$)/i;

/** Whether the (provider, model) accepts IMAGE input via its API surface. */
export function modelSupportsVision(
  provider: AssistantProviderId,
  model: string | undefined,
): boolean {
  const m = (model ?? "").toLowerCase();
  switch (provider) {
    case "claude":
      return true; // all current Claude models are multimodal
    case "gemini":
      return true; // all Gemini 2.x/3.x are multimodal
    case "codex":
      return !OPENAI_TEXT_ONLY.test(m); // modern GPT-6/5/4 models are multimodal
    case "deepseek":
      return m === "deepseek-flash"; // V4.1 Flash supports images; V4 Pro does not
    case "grok":
      // xAI Grok vision models: grok-4 and any model name flagged "vision".
      return /grok-4|vision/.test(m);
    case "minimax":
      return m === "minimax-m3"; // M3 accepts image blocks on the Anthropic API
    default:
      return false;
  }
}

/** Whether the (provider, model) accepts PDF/document input via its API. */
export function modelSupportsPdf(
  provider: AssistantProviderId,
  model: string | undefined,
): boolean {
  // Only Claude + Gemini accept PDF/document blocks; OpenAI chat-completions
  // does not. Gate on vision support too (a text-only model takes neither).
  return (provider === "claude" || provider === "gemini") && modelSupportsVision(provider, model);
}
