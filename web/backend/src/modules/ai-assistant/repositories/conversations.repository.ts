// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-target conversation history for the assistant chat.
 *
 * Stored as JSON sidecars under `${LUXIPANEL_CONFIG_DIR}/assistant/` on the
 * connected target (same robust mechanism as config/modules/audit):
 *
 *   conversations.json          → map of conversation metadata (id → meta)
 *   conversation-<id>.json       → the message list for that conversation
 *
 * Works identically for API and CLI providers — the chat pipeline persists
 * every user/assistant turn here, giving a ChatGPT-style threaded history
 * the UI can list, filter, and paginate.
 *
 * ── Layout ──────────────────────────────────────────────────────────────────
 * This file is a FAÇADE re-exporting the same public surface. The
 * implementation is split under `./conversations/`:
 *   • types.ts          — message/meta shapes + sidecar layout constants.
 *   • stores.ts         — per-user dataStore accessors + scope resolution.
 *   • reconstruction.ts — durable index self-heal from surviving transcripts.
 *   • repository.ts      — the `conversationsRepository` object.
 */

export type {
  MessageAttachmentRef,
  ConversationMessage,
  ConversationMeta,
  EmbeddedConversationMeta,
} from "./conversations/types.js";
export { conversationsRepository } from "./conversations/repository.js";
