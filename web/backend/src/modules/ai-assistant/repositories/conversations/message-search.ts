// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * On-demand search over persisted conversation turns. Metadata lists stay cheap:
 * transcript sidecars are read only for a non-empty search and reused while
 * their message count/update timestamp stays the same. The cache is scoped to
 * the target server and panel user; two SSH targets must never share matches.
 */
import { dataStore } from "../../../../shared/data-store/index.js";
import type { Executor } from "../../../../shared/executor/index.js";
import { getContextUserId } from "../../../../shared/executor/context.js";
import { readMessagesAny } from "./stores.js";
import type { ConversationMessage, ConversationMeta } from "./types.js";

export interface ConversationSearchMatch {
  snippet: string;
  role: ConversationMessage["role"];
  messageIndex: number;
}

type IndexedMessage = { role: ConversationMessage["role"]; variants: string[] };
type IndexedConversation = { version: string; messages: IndexedMessage[]; retryAfter?: number };
type ScopeCache = {
  entries: Map<string, IndexedConversation>;
  loading: Promise<void> | null;
  lastUsed: number;
  warmed: boolean;
};

const MAX_SCOPES = 8;
const SCOPE_IDLE_MS = 10 * 60_000;
const READ_RETRY_MS = 30_000;
const READ_CONCURRENCY = 2; // Remote sidecars may each cost several SSH hops.
const scopes = new Map<string, ScopeCache>();

export function foldSearchText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function scopeFor(executor: Executor | null | undefined): ScopeCache {
  const key = `${executor?.target?.id ?? "local"}:u${getContextUserId() ?? "shared"}`;
  const now = Date.now();
  for (const [id, cache] of scopes) {
    if (now - cache.lastUsed > SCOPE_IDLE_MS) scopes.delete(id);
  }
  let cache = scopes.get(key);
  if (!cache) {
    cache = { entries: new Map(), loading: null, lastUsed: now, warmed: false };
    scopes.set(key, cache);
  }
  cache.lastUsed = now;
  // Map insertion order acts as a small LRU for different target/user pairs.
  scopes.delete(key);
  scopes.set(key, cache);
  while (scopes.size > MAX_SCOPES) scopes.delete(scopes.keys().next().value!);
  return cache;
}

function searchStore(executor: Executor | null | undefined) {
  return dataStore<IndexedConversation & { id?: string }>(executor, "assistant", `message-search-u${getContextUserId() ?? "shared"}`, { timestamps: false });
}

/** Starts after the response; keystrokes never wait for transcript scans. */
export function warmConversationSearch(executor: Executor | null | undefined, metas: ConversationMeta[]) {
  const cache = scopeFor(executor);
  if (!cache.loading) void ensureIndexed(cache, executor, metas).catch(() => undefined);
}
export function conversationSearchStatus(executor: Executor | null | undefined, metas: ConversationMeta[]) {
  const cache = scopeFor(executor);
  const indexed = metas.filter(meta => isFresh(cache.entries.get(String(meta.id)), meta)).length;
  return { state: indexed === metas.length ? "ready" : "indexing", indexed, total: metas.length };
}
export function updateConversationSearch(executor: Executor | null | undefined, meta: ConversationMeta, messages: ConversationMessage[]) {
  const cache = scopeFor(executor);
  cache.entries.set(String(meta.id), { version: versionOf(meta), messages: messages.map(indexMessage) });
  void searchStore(executor).set(String(meta.id), cache.entries.get(String(meta.id))!).catch(() => undefined);
}

export function dropConversationSearch(executor: Executor | null | undefined, id: string) {
  scopeFor(executor).entries.delete(id);
  void searchStore(executor).delete(id).catch(() => undefined);
}

function versionOf(meta: ConversationMeta): string {
  return `${meta.updatedAt ?? ""}:${meta.messageCount ?? ""}`;
}

function isFresh(entry: IndexedConversation | undefined, meta: ConversationMeta): boolean {
  return !!entry && entry.version === versionOf(meta) && (!entry.retryAfter || entry.retryAfter > Date.now());
}

function indexMessage(message: ConversationMessage): IndexedMessage {
  const display = (message.role === "user" ? message.textOriginal : message.textTranslated) ?? message.content;
  const variants = [...new Set([display, message.content, message.textOriginal, message.textTranslated]
    .filter((text): text is string => typeof text === "string" && text.length > 0)
    .map((text) => text.replace(/\s+/g, " ").trim()))];
  return { role: message.role, variants };
}

async function ensureIndexed(
  cache: ScopeCache,
  executor: Executor | null | undefined,
  metas: ConversationMeta[],
): Promise<void> {
  // A second query arriving while the first is scanning waits on the SAME
  // bounded worker pool, then checks whether it needs any additional entries.
  if (cache.loading) { await cache.loading; return ensureIndexed(cache, executor, metas); }
  const filling = Promise.resolve().then(async () => {
  if (!cache.warmed) {
    cache.warmed = true;
    try {
      const saved = await searchStore(executor).list();
      for (const entry of saved) if (entry.id && !cache.entries.has(String(entry.id))) cache.entries.set(String(entry.id), entry);
    } catch { /* Derived index can always be rebuilt. */ }
  }
  const stale = metas.filter((meta) => meta.id && !isFresh(cache.entries.get(String(meta.id)), meta));
  if (stale.length === 0) return;
  let cursor = 0;
  const work = async () => {
    while (cursor < stale.length) {
      const meta = stale[cursor++]!;
      const id = String(meta.id);
      const version = versionOf(meta);
      try {
        const messages = await readMessagesAny(executor, id);
        const newer = cache.entries.get(id);
        if (!newer || newer.version <= version) cache.entries.set(id, { version, messages: messages.map(indexMessage) });
      } catch {
        // A transient SSH failure should not break title/preview matches. Retry
        // this transcript on a later search, without hammering it each keystroke.
        cache.entries.set(id, { version, messages: [], retryAfter: Date.now() + READ_RETRY_MS });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, stale.length) }, work));
  await searchStore(executor).transaction(async current => {
    const next = { ...current };
    for (const [id, entry] of cache.entries) if (!next[id] || next[id]!.version <= entry.version) next[id] = entry;
    return { next, result: undefined };
  }).catch(() => undefined);
  });
  cache.loading = filling;
  try { await filling; } finally { if (cache.loading === filling) cache.loading = null; }
}

function snippetAt(text: string, foldedQuery: string): string {
  const at = foldSearchText(text).indexOf(foldedQuery);
  const start = Math.max(0, at - 55);
  const end = Math.min(text.length, Math.max(at + foldedQuery.length + 70, start + 140));
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/** Match both the user-visible turn and its canonical/translated variant. */
export async function searchConversationMessages(
  executor: Executor | null | undefined,
  metas: ConversationMeta[],
  query: string,
  nonBlocking = false,
): Promise<Map<string, ConversationSearchMatch>> {
  const found = new Map<string, ConversationSearchMatch>();
  if (metas.length === 0 || !query.trim()) return found;
  const cache = scopeFor(executor);
  if (nonBlocking) warmConversationSearch(executor, metas);
  else await ensureIndexed(cache, executor, metas);
  const needle = foldSearchText(query.trim().replace(/\s+/g, " "));
  for (const meta of metas) {
    const id = String(meta.id ?? "");
    const entry = cache.entries.get(id);
    const messages = isFresh(entry, meta) ? entry!.messages : [];
    // Newest matching turn is usually the most useful excerpt in the rail.
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]!;
      const matchingText = message.variants.find((text) => foldSearchText(text).includes(needle));
      if (!matchingText) continue;
      found.set(id, { snippet: snippetAt(matchingText, needle), role: message.role, messageIndex: i });
      break;
    }
  }
  return found;
}
