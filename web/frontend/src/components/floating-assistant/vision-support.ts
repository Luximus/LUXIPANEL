// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Vision capability per (provider, model) — mirror of the backend's
 * `backend/src/modules/ai-assistant/services/providers/vision.ts`. Keep both in
 * sync. Used to gate the attachment button per the ACTIVE model, not just the
 * provider: e.g. MiniMax M3 and DeepSeek Flash accept images, while their
 * other chat models and OpenAI o-mini variants do not.
 */

import type { AssistantProviderId } from "./assistant-api";

/** Models known to be text-only within an otherwise multimodal provider. */
const OPENAI_TEXT_ONLY = /(^|[^a-z])(o1-mini|o1-preview|o3-mini)([^a-z]|$)/i;

/** Whether the (provider, model) accepts IMAGE input via its API surface. */
export function modelSupportsVision(provider: string, model: string | undefined): boolean {
  const m = (model ?? "").toLowerCase();
  switch (provider as AssistantProviderId) {
    case "claude":
      return true; // all current Claude models are multimodal
    case "gemini":
      return true; // all Gemini 2.x/3.x are multimodal
    case "codex":
      return !OPENAI_TEXT_ONLY.test(m); // modern GPT-6/5/4 models are multimodal
    case "deepseek":
      return m === "deepseek-flash";
    case "grok":
      // OpenAI-compatible: vision only on vision-tagged or grok-4 models.
      return /vision/.test(m) || /grok-4/.test(m);
    case "minimax":
      return m === "minimax-m3";
    default:
      return false;
  }
}

/** Whether the (provider, model) accepts PDF/document input via its API. */
export function modelSupportsPdf(provider: string, model?: string | undefined): boolean {
  return (provider === "claude" || provider === "gemini") && modelSupportsVision(provider, model);
}
