// SPDX-License-Identifier: AGPL-3.0-only
import { resolveTargetScope, scopeHeaders } from "@/lib/api-client";

// Local safety latches, NOT operation identities or proof of server persistence.
// Raw session material stays only in memory. Storage contains a digest + boolean.
const unresolved = new Set<string>();
const keys = new Map<string, Promise<string>>();
const storagePrefix = "lxp:assistant:unconfirmed-profile-create:v2:";
let memorySequence = 0;

export function profileCreationScope(): string {
  const user = document.getElementById("messenger-link")?.getAttribute("data-me") || "anonymous";
  return JSON.stringify([user, resolveTargetScope(), scopeHeaders(true)]);
}

export function profileCreationKey(scope = profileCreationScope()): Promise<string> {
  const existing = keys.get(scope);
  if (existing) return existing;
  const key = (async () => {
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(scope));
      return storagePrefix + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    } catch {
      // Without Web Crypto, retain a separate opaque latch for each scope in
      // this document. Never replace the digest with persisted session headers.
      return `memory:profile-create:${++memorySequence}`;
    }
  })();
  keys.set(scope, key);
  return key;
}

export function hasUnconfirmedCreation(key: string): boolean {
  try { return unresolved.has(key) || (key.startsWith(storagePrefix) && sessionStorage.getItem(key) === "1"); }
  catch { return unresolved.has(key); }
}

export function markUnconfirmedCreation(key: string, value: boolean): void {
  if (value) unresolved.add(key); else unresolved.delete(key);
  if (!key.startsWith(storagePrefix)) return;
  try { if (value) sessionStorage.setItem(key, "1"); else sessionStorage.removeItem(key); }
  catch { /* The in-memory latch still protects remounted dialogs. */ }
}
