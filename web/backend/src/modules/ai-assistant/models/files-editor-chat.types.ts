// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Types + Zod schemas for the Files editor AI bar (POST /api/ai/files/editor-chat).
 *
 * The frontend sends the CURRENT Monaco buffer (may differ from disk, may have
 * unsaved changes), the user's instruction, and optional selection/history. The
 * backend answers conversationally and, when the user asked for a change, a
 * STRUCTURED edit the frontend applies to the buffer (undoable, marks dirty).
 * This endpoint NEVER touches disk — everything travels in the request.
 *
 * Two schema families:
 *   - request*  → validate the incoming HTTP body.
 *   - modelOutput* → validate the JSON the model is asked to emit (tolerant:
 *     invalid output degrades to a reply-only answer, never a 500).
 */

import { z } from "zod";

// ── Request body ────────────────────────────────────────────────────────────

/** Monaco 1-based selection range plus the selected text (as the client sees it). */
export const editorSelectionSchema = z.object({
  startLineNumber: z.number().int().min(1),
  startColumn: z.number().int().min(1),
  endLineNumber: z.number().int().min(1),
  endColumn: z.number().int().min(1),
  text: z.string().max(200_000).default(""),
});

export const editorChatRequestSchema = z.object({
  path: z.string().min(1).max(4096),
  // Whole buffer. The wire cap is generous (the app's JSON body limit is 30mb);
  // the SERVICE decides at ~200KB whether to truncate + forbid edits.
  content: z.string().max(5_000_000),
  language: z.string().max(64).optional(),
  prompt: z.string().min(1).max(8_000),
  selection: editorSelectionSchema.optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8_000),
      }),
    )
    .max(10)
    .optional(),
});

export type EditorChatRequest = z.infer<typeof editorChatRequestSchema>;
export type EditorSelection = z.infer<typeof editorSelectionSchema>;

// ── Structured edit (contract with the frontend) ────────────────────────────

export const editorRangeSchema = z.object({
  startLineNumber: z.number().int().min(1),
  startColumn: z.number().int().min(1),
  endLineNumber: z.number().int().min(1),
  endColumn: z.number().int().min(1),
});

export const editorEditSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("replaceAll"), content: z.string() }),
  z.object({ mode: z.literal("replaceRange"), range: editorRangeSchema, content: z.string() }),
]);

export type EditorChatEdit = z.infer<typeof editorEditSchema>;

/**
 * Shape the MODEL is asked to produce. `edit` is optional/nullable so a
 * question-only answer (no edit) parses cleanly. `.catch`/tolerant parsing is
 * handled by the service, not here.
 */
export const editorChatModelOutputSchema = z.object({
  reply: z.string(),
  edit: editorEditSchema.nullish(),
});

export type EditorChatModelOutput = z.infer<typeof editorChatModelOutputSchema>;

/** The HTTP response body (exact contract the frontend consumes). */
export interface EditorChatResponse {
  reply: string;
  edit?: EditorChatEdit;
}
