// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * localStorage-backed UI preference stores with a tiny pub/sub (F-18).
 *
 * `bubble-prefs.ts` and `ui-prefs.ts` shipped the same `readAll()/writeAll()`
 * (`JSON.parse(raw || "{}")` in a try/catch, `Set<() => void>` of listeners,
 * `get/set/subscribe`) — the `ui-prefs` docstring literally said "same model as
 * bubble-prefs". The terminal panel had the un-JSON'd flavour
 * (`readString/writeString`). Both live here now.
 *
 * Everything is SSR-safe (no `window` → read returns the empty blob, write is a
 * no-op) and never throws (private mode / blocked storage).
 */

export interface JsonPrefsStore<S extends object> {
  /** Parsed blob; `{}` on SSR, missing key or corrupt JSON. */
  read(): S;
  /** Persist the whole blob and notify subscribers. */
  write(value: S): void;
  /** Notify subscribers without writing (for derived setters). */
  notify(): void;
  /** Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
}

export function createJsonPrefsStore<S extends object>(storageKey: string): JsonPrefsStore<S> {
  const listeners = new Set<() => void>();
  return {
    read(): S {
      if (typeof window === "undefined") return {} as S;
      try {
        return JSON.parse(window.localStorage.getItem(storageKey) || "{}") as S;
      } catch {
        return {} as S;
      }
    },
    write(value: S): void {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        /* ignore (SSR, private mode, quota) */
      }
      listeners.forEach((l) => l());
    },
    notify(): void {
      listeners.forEach((l) => l());
    },
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

/** Raw string read from localStorage; `null` on SSR / missing / blocked. */
export function readStoredString(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Raw string write; `null` removes the key. No-op on SSR / blocked storage. */
export function writeStoredString(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
