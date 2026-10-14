// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Interactive-question protocol ("ask") — shared shape used when a CLI agent
 * needs a decision from the user instead of guessing. The agent emits a sentinel
 * block (see services/ask-protocol.ts); the backend parses it into these types,
 * streams an `ask` event, and persists it on the assistant turn so the chat can
 * render selectable buttons / checkboxes / a text input and resume the session
 * with the user's answer.
 */

export type AskQuestionType = "single" | "multi" | "text";

export interface AskQuestion {
  /** Stable id within the request (used to key answers). */
  id: string;
  /** The question text shown to the user. */
  text: string;
  /** single = one option · multi = many options · text = free input. */
  type: AskQuestionType;
  /** Choices for single/multi. Omitted (or ignored) for text. */
  options?: string[];
}

export interface AskRequest {
  questions: AskQuestion[];
  /**
   * "plan-approval" marks the ask as a plan-approval request (approval mode
   * "plan"). The frontend sends the affirmative answer back as a structured
   * `planDecision: "approve"` flag — never by matching the answer text, which
   * may be translated — so the next turn can run with the manual gate.
   */
  kind?: "plan-approval";
}
