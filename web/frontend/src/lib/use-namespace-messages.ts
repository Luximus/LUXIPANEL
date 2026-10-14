// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Lazy i18n-slice loader for React islands (F-13).
 *
 * Five islands shipped the same `useEffect`: a `cancelled` flag,
 * `getClientMessages(locale, [ns])`, a `.then` that merges the fetched slice on
 * top of a static Spanish fallback and a `.catch(() => undefined)` so a network
 * hiccup silently keeps the fallback. This is that effect, once.
 *
 * `pick` selects a sub-object inside the namespace payload (the files module
 * keeps several island dictionaries under `files.*`); `merge` swaps the default
 * shallow spread for a deep merge (the assistant bundle is nested).
 */
import { useEffect, useRef, useState } from "react";
import { getClientMessages } from "@/i18n/client";

export interface UseNamespaceMessagesOptions<T> {
  /** Extract the island's slice from the namespace payload. Identity by default. */
  pick?: (namespaceValue: unknown) => unknown;
  /** Combine the static fallback with the loaded slice. Shallow spread by default. */
  merge?: (fallback: T, next: Partial<T>) => T;
}

export function useNamespaceMessages<T>(
  locale: string | null | undefined,
  namespace: string,
  fallback: T,
  options: UseNamespaceMessagesOptions<T> = {},
): T {
  const [messages, setMessages] = useState<T>(fallback);
  // Options/fallback are read through a ref so an inline object literal at the
  // call site doesn't retrigger the fetch on every render.
  const latest = useRef({ fallback, options });
  latest.current = { fallback, options };

  useEffect(() => {
    let cancelled = false;
    void getClientMessages(locale, [namespace] as never)
      .then((payload) => {
        if (cancelled) return;
        const { fallback: fb, options: opts } = latest.current;
        const raw = (payload as Record<string, unknown>)[namespace];
        const slice = (opts.pick ? opts.pick(raw) : raw) as Partial<T> | undefined;
        const next = (slice ?? {}) as Partial<T>;
        setMessages(opts.merge ? opts.merge(fb, next) : ({ ...fb, ...next } as T));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locale, namespace]);

  return messages;
}
