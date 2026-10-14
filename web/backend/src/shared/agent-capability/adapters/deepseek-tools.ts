// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * DeepSeek tool adapter.
 *
 * DeepSeek's chat-completions API is OpenAI-compatible, so we just re-export
 * the OpenAI adapter. Kept as a separate module so providers can later
 * diverge (e.g. if DeepSeek adds non-standard tool formats) without churn.
 */

export {
  toOpenAiTools as toDeepSeekTools,
  toOpenAiName as toDeepSeekName,
  fromOpenAiName as fromDeepSeekName,
  type OpenAiTool as DeepSeekTool,
} from "./openai-tools.js";
