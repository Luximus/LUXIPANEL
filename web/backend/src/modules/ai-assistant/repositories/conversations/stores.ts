// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-user dataStore accessors + scope resolution for conversation sidecars.
 *
 * Conversations are PER-USER: both the metadata index and each conversation's
 * message doc are namespaced by the context user so history never leaks between
 * two Linux users on the same server. These helpers own that namespacing plus
 * the tolerance for a legacy (shared) / per-user SCOPE SPLIT — reads fall back
 * to the other scope so a transcript is never silently lost.
 */

import { dataStore } from "../../../../shared/data-store/index.js";
import type { Executor } from "../../../../shared/executor/index.js";
import { getContextUserId } from "../../../../shared/executor/context.js";
import { normalizeConversationMessages } from "../../services/conversation-message-normalizer.js";
import {
  MODULE,
  META_COLLECTION,
  MSG_DOC_ID,
  META_DOC_ID,
  type ConversationMeta,
  type ConversationDoc,
  type ConversationMessage,
  type EmbeddedConversationMeta,
  type StoreScope,
} from "./types.js";

// Conversations are PER-USER: namespace both the metadata collection and each
// conversation's message collection by the context user so chat history (and
// the message docs, reachable by conversation id) never leak between two Linux
// users on the same server. Falls back to the shared name with no user in
// context (should not happen on the authenticated assistant routes).
export function userSuffix(): string {
  const uid = getContextUserId();
  return uid ? `-u${uid}` : "";
}

export function contextScope(): StoreScope {
  return getContextUserId() ? "user" : "shared";
}

export function sharedMetaStore(executor?: Executor | null) {
  return dataStore<ConversationMeta>(executor, MODULE, META_COLLECTION, { idStrategy: "uuid" });
}

export function metaStore(executor?: Executor | null) {
  return dataStore<ConversationMeta>(executor, MODULE, `${META_COLLECTION}${userSuffix()}`, { idStrategy: "uuid" });
}

/** Each conversation's messages live in their own (per-user) collection doc. */
export function sharedMsgStore(executor: Executor | null | undefined, conversationId: string) {
  return dataStore<ConversationDoc>(executor, MODULE, `conv-${conversationId}`, {
    idStrategy: "uuid",
    timestamps: false,
  });
}

export function msgStore(executor: Executor | null | undefined, conversationId: string) {
  return dataStore<ConversationDoc>(executor, MODULE, `conv${userSuffix()}-${conversationId}`, {
    idStrategy: "uuid",
    timestamps: false,
  });
}

/** Project an index meta down to the embedded header we persist in the sidecar. */
export function embeddedFromMeta(m: Partial<ConversationMeta>): EmbeddedConversationMeta {
  return {
    agentId: m.agentId ?? null,
    provider: m.provider,
    originProvider: m.originProvider ?? m.provider,
    projectId: m.projectId ?? null,
    title: m.title,
    createdAt: m.createdAt,
    model: m.model, effort: m.effort, approvalMode: m.approvalMode,
  };
}

/** A store over the SAME per-conversation collection as the messages doc, but
 *  typed for the embedded `__meta` header. Same collection name → same file. */
export function embeddedMetaStore(
  executor: Executor | null | undefined,
  conversationId: string,
  scope: StoreScope,
) {
  const collection =
    scope === "shared" ? `conv-${conversationId}` : `conv${userSuffix()}-${conversationId}`;
  return dataStore<EmbeddedConversationMeta>(executor, MODULE, collection, {
    idStrategy: "uuid",
    timestamps: false,
  });
}

/** Read the embedded identity header for a conversation (null if absent). */
export async function readEmbeddedMeta(
  executor: Executor | null | undefined,
  id: string,
  scope: StoreScope,
): Promise<EmbeddedConversationMeta | null> {
  try {
    const doc = await embeddedMetaStore(executor, id, scope).get(META_DOC_ID);
    if (!doc) return null;
    const { id: _id, ...rest } = doc as EmbeddedConversationMeta & { id?: unknown };
    return rest;
  } catch {
    return null; // fail-open: a missing/unreadable header just means no hint
  }
}

export function deriveTitle(firstUserMessage: string): string {
  const t = firstUserMessage.replace(/\s+/g, " ").trim();
  if (!t) return "Nueva conversación";
  return t.length > 60 ? `${t.slice(0, 59)}…` : t;
}

export function preview(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 120 ? `${t.slice(0, 119)}…` : t;
}

export function storeForScope(executor: Executor | null | undefined, scope: StoreScope) {
  return scope === "shared" ? sharedMetaStore(executor) : metaStore(executor);
}

export function msgStoreForScope(executor: Executor | null | undefined, conversationId: string, scope: StoreScope) {
  return scope === "shared" ? sharedMsgStore(executor, conversationId) : msgStore(executor, conversationId);
}

export async function listMetaDocs(executor: Executor | null | undefined): Promise<Array<ConversationMeta & { id: string | number }>> {
  if (contextScope() === "shared") return sharedMetaStore(executor).list();
  const [own, legacy] = await Promise.all([
    metaStore(executor).list(),
    sharedMetaStore(executor).list(),
  ]);
  const merged = new Map<string, ConversationMeta & { id: string | number }>();
  for (const doc of legacy) merged.set(String(doc.id), doc);
  for (const doc of own) merged.set(String(doc.id), doc);
  return [...merged.values()];
}

export async function resolveScope(executor: Executor | null | undefined, id: string): Promise<StoreScope> {
  if (contextScope() === "shared") return "shared";
  const ownMeta = await metaStore(executor).get(id);
  if (ownMeta) return "user";
  const legacyMeta = await sharedMetaStore(executor).get(id);
  if (legacyMeta) return "shared";
  const ownMsg = await msgStore(executor, id).get(MSG_DOC_ID);
  if (ownMsg) return "user";
  const legacyMsg = await sharedMsgStore(executor, id).get(MSG_DOC_ID);
  if (legacyMsg) return "shared";
  return "user";
}

export async function getMetaAny(
  executor: Executor | null | undefined,
  id: string,
): Promise<ConversationMeta | null> {
  const scope = await resolveScope(executor, id);
  return storeForScope(executor, scope).get(id) as Promise<ConversationMeta | null>;
}

/**
 * Read a conversation's message list, tolerant of a meta/messages SCOPE SPLIT.
 * `resolveScope` keys off where the META lives, but a legacy migration (or a
 * meta written per-user while the transcript stayed in the shared collection)
 * can leave the message doc in the OTHER scope — making a scope-pinned read
 * return EMPTY even though the chat has history, which renders the chat blank
 * ("nuevo chat") on open. If the resolved scope holds no messages, fall back to
 * the other scope so the transcript is never silently lost.
 */
export async function readMessagesAny(
  executor: Executor | null | undefined,
  id: string,
): Promise<ConversationMessage[]> {
  const scope = await resolveScope(executor, id);
  const doc = await msgStoreForScope(executor, id, scope).get(MSG_DOC_ID);
  if ((doc?.messages?.length ?? 0) > 0) {
    const normalized = normalizeConversationMessages(doc!.messages);
    // Read-only projection: writing this snapshot can erase a concurrent append.
    return normalized.messages;
  }
  const other: StoreScope = scope === "shared" ? "user" : "shared";
  const otherDoc = await msgStoreForScope(executor, id, other).get(MSG_DOC_ID);
  if ((otherDoc?.messages?.length ?? 0) > 0) {
    const normalized = normalizeConversationMessages(otherDoc!.messages);
    // Never repair persisted history from a stale read snapshot.
    return normalized.messages;
  }
  return doc?.messages ?? otherDoc?.messages ?? [];
}
