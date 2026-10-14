// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Files editor AI bar service.
 *
 * Single, non-streaming, no-tools completion (reuses the assistant's configured
 * provider via `aiComplete`, same path as the Project Map / translation engine).
 * Builds a system prompt from the current buffer + selection, asks the model to
 * answer as JSON matching the editor-chat contract, and validates that JSON with
 * Zod — degrading to a reply-only answer when the model doesn't return valid
 * JSON (never a 500).
 *
 * NEVER touches disk: the whole buffer arrives in the request; the response is a
 * structured edit the frontend applies to Monaco.
 */

import { ServiceUnavailableError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { AssistantConfig } from "../models/assistant-config.types.js";
import {
  editorChatModelOutputSchema,
  type EditorChatRequest,
  type EditorChatResponse,
} from "../models/files-editor-chat.types.js";
import { aiComplete } from "./translation/ai-translator.js";
import { TranslationError } from "./translation/translation.types.js";

const log = createModuleLogger("files-editor-chat");

/**
 * Above this buffer size we truncate the content embedded in the prompt AND
 * forbid edits (a replaceAll/replaceRange computed from a truncated view would
 * be wrong). The endpoint answers reply-only, explaining the limit.
 */
export const MAX_CONTENT_BYTES = 200_000;

/** Socket-level ceiling so a hung provider aborts instead of hanging the request. */
const FILE_EDITOR_AI_TIMEOUT_MS = 55_000;

// ── Prompt building ─────────────────────────────────────────────────────────

function buildSystemPrompt(req: EditorChatRequest, truncated: boolean): string {
  const lang = req.language?.trim() || "plaintext";
  const lines: string[] = [
    "You are an AI coding assistant embedded in the FILE EDITOR of LUXIPANEL, a Linux server control panel.",
    "The user is editing a single file in a Monaco editor. You help by answering questions about it and by proposing precise edits to the buffer.",
    "",
    `File path: ${req.path}`,
    `Language: ${lang}`,
    "",
    "OUTPUT PROTOCOL (STRICT):",
    "- Respond with EXACTLY ONE JSON object and NOTHING else. No markdown fences, no prose before or after.",
    '- Shape: { "reply": string, "edit"?: EDIT }',
    "- `reply`: a brief, friendly explanation in the SAME language the user wrote in.",
    "- If the user only ASKS something (no change requested), return just `reply` and OMIT `edit`.",
    "- If the user REQUESTS a change, include `edit`:",
    '    * Local change with a selection provided → { "mode": "replaceRange", "range": { "startLineNumber", "startColumn", "endLineNumber", "endColumn" }, "content": string } using Monaco 1-based line/column coordinates.',
    '    * Global / multi-part change → { "mode": "replaceAll", "content": string } where `content` is the ENTIRE new file content.',
    "- `content` is RAW text inserted verbatim into the buffer — NEVER wrap it in markdown code fences.",
    "- Do not invent changes the user didn't ask for. Keep edits minimal and correct for the language.",
  ];
  if (truncated) {
    lines.push(
      "",
      `NOTE: the file is too large (> ${Math.floor(MAX_CONTENT_BYTES / 1000)}KB) and its content below was TRUNCATED.`,
      "You MUST NOT propose an `edit` (it would be computed from a partial view). Answer with `reply` only, explaining that the file is too large to edit through this bar.",
    );
  }
  return lines.join("\n");
}

function clampContent(content: string): { text: string; truncated: boolean } {
  if (Buffer.byteLength(content, "utf8") <= MAX_CONTENT_BYTES) return { text: content, truncated: false };
  // Byte-safe slice: take the first MAX_CONTENT_BYTES bytes and drop a possibly
  // broken trailing multibyte char.
  const buf = Buffer.from(content, "utf8").subarray(0, MAX_CONTENT_BYTES);
  return { text: buf.toString("utf8"), truncated: true };
}

function buildUserPrompt(req: EditorChatRequest, clamped: { text: string; truncated: boolean }): string {
  const parts: string[] = [];

  if (req.history?.length) {
    parts.push("Previous conversation (most recent last):");
    for (const turn of req.history) {
      parts.push(`${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`);
    }
    parts.push("");
  }

  parts.push("CURRENT BUFFER (may contain unsaved changes):");
  parts.push("<<<FILE");
  parts.push(clamped.text);
  parts.push("FILE>>>");
  if (clamped.truncated) parts.push("(buffer truncated — see note in system prompt)");
  parts.push("");

  if (req.selection && req.selection.text.trim().length > 0) {
    const s = req.selection;
    parts.push(
      `SELECTION (lines ${s.startLineNumber}:${s.startColumn} → ${s.endLineNumber}:${s.endColumn}):`,
    );
    parts.push("<<<SEL");
    parts.push(s.text);
    parts.push("SEL>>>");
    parts.push("");
  }

  parts.push(`USER REQUEST: ${req.prompt}`);
  return parts.join("\n");
}

// ── Tolerant parsing of the model output ────────────────────────────────────

/** Pull a JSON object out of a raw model reply (strips fences / surrounding prose). */
function extractJson(s: string): string {
  let t = s.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

/**
 * Parse the model's raw text into the contract response. Tolerant: on any parse
 * failure, degrade to `{ reply: <raw text> }` with no edit. When `allowEdit` is
 * false (truncated buffer), any proposed edit is dropped.
 */
export function parseModelReply(raw: string, opts: { allowEdit: boolean }): EditorChatResponse {
  const trimmed = raw.trim();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJson(trimmed));
  } catch {
    return { reply: trimmed || "No pude generar una respuesta." };
  }

  const result = editorChatModelOutputSchema.safeParse(parsedJson);
  if (!result.success) {
    // Valid JSON but wrong shape → best-effort reply, no edit.
    const maybeReply =
      parsedJson && typeof parsedJson === "object" && typeof (parsedJson as { reply?: unknown }).reply === "string"
        ? (parsedJson as { reply: string }).reply
        : trimmed;
    return { reply: maybeReply || "No pude generar una respuesta." };
  }

  const out: EditorChatResponse = { reply: result.data.reply };
  if (opts.allowEdit && result.data.edit) out.edit = result.data.edit;
  return out;
}

// ── Service ─────────────────────────────────────────────────────────────────

export const filesEditorChatService = {
  /**
   * Run one editor-chat turn. `config` is the per-server assistant config
   * (loaded by the controller via the context executor). Uses the active
   * provider's API slot (its real model), falling back to the translation
   * engine only when the active provider is CLI-only/keyless.
   */
  async chat(config: AssistantConfig, req: EditorChatRequest, signal?: AbortSignal): Promise<EditorChatResponse> {
    const clamped = clampContent(req.content);
    const system = buildSystemPrompt(req, clamped.truncated);
    const user = buildUserPrompt(req, clamped);

    let text: string;
    try {
      const out = await aiComplete(config, {
        providerId: config.activeProvider,
        allowFallback: true,
        system,
        user,
        signal: signal ?? AbortSignal.timeout(FILE_EDITOR_AI_TIMEOUT_MS),
      });
      text = out.text;
    } catch (e) {
      if (e instanceof TranslationError) {
        // No usable API credentials, or provider rejected the call. Log detail
        // server-side; surface a generic, safe message.
        log.warn({ upstreamError: e.message }, "editor-chat upstream error");
        throw new ServiceUnavailableError(
          "El asistente de IA no está disponible. Revisa que haya un proveedor con API key configurado.",
        );
      }
      throw e;
    }

    return parseModelReply(text, { allowEdit: !clamped.truncated });
  },
};
