// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { DEFAULT_LOCALE, normalizeLocale, type LocaleCode } from "./config";
import { deepFill } from "./deep-fill";
import { NAMESPACES } from "./namespaces.generated";
import type { Messages } from "./types";

type NamespaceName = keyof Messages;
type NamespaceChunk = Messages[NamespaceName];

// Per-module locale sources live at ./<locale>/<namespace>.ts (e.g. ./en/users.ts).
// The two-segment glob matches only those — the i18n infra files (config.ts,
// index.ts, …) and the generated es-aggregate sit one level up and are excluded.
// Indexing by a runtime-built path may miss (a namespace file may not exist yet
// for a locale), so the value type is intentionally optional — the loader guards
// below rely on that.
const namespaceLoaders = import.meta.glob("./*/*.ts", { import: "default" }) as Record<
  string,
  (() => Promise<NamespaceChunk>) | undefined
>;

const namespaceCache = new Map<string, Promise<NamespaceChunk>>();
const messagesCache = new Map<string, Promise<Messages>>();

async function loadNamespace(locale: LocaleCode, namespace: NamespaceName): Promise<NamespaceChunk> {
  const cacheKey = `${locale}:${String(namespace)}`;
  const cached = namespaceCache.get(cacheKey);
  if (cached) return cached;

  const localePath = `./${locale}/${String(namespace)}.ts`;
  const fallbackPath = `./${DEFAULT_LOCALE}/${String(namespace)}.ts`;
  const sourcePath = `./es/${String(namespace)}.ts`;
  const localeLoader = namespaceLoaders[localePath];
  const fallbackLoader = namespaceLoaders[fallbackPath];
  const sourceLoader = namespaceLoaders[sourcePath];
  if (!localeLoader && !fallbackLoader && !sourceLoader) {
    // A page may request a namespace that has no source file yet (e.g. a new
    // feature shipped its page before its i18n keys). Throwing here would crash
    // the whole SSR render (502). Degrade to an empty namespace instead so the
    // page renders; missing strings fall back to in-component defaults.
    console.warn(`[i18n] Missing namespace "${cacheKey}" — serving empty fallback`);
    const empty = Promise.resolve({} as NamespaceChunk);
    namespaceCache.set(cacheKey, empty);
    return empty;
  }

  // Every namespace uses the Spanish shape. English is the preferred fallback
  // for other locales, including keys that have not reached English yet.
  const pending = Promise.all([
    localeLoader?.(),
    fallbackLoader?.(),
    sourceLoader?.(),
  ]).then(([chunk, fallback, source]) => {
    const base = source ?? ({} as NamespaceChunk);
    const english = fallback ? deepFill(fallback, base) : base;
    return chunk ? deepFill(chunk, english) : english;
  });
  namespaceCache.set(cacheKey, pending);
  return pending;
}

export async function getMessages(
  locale: string | null | undefined,
  namespaces: readonly NamespaceName[] = NAMESPACES,
): Promise<Messages> {
  const normalizedLocale = normalizeLocale(locale);
  const uniqueNamespaces = [...new Set(namespaces)] as NamespaceName[];
  const cacheKey = `${normalizedLocale}:${uniqueNamespaces.join(",")}`;
  const cached = messagesCache.get(cacheKey);
  if (cached) return cached;

  const pending = (async () => {
    const entries = await Promise.all(
      uniqueNamespaces.map(async (namespace) => [namespace, await loadNamespace(normalizedLocale, namespace)] as const),
    );

    return Object.fromEntries(entries) as Messages;
  })();

  messagesCache.set(cacheKey, pending);
  return pending;
}

export { NAMESPACES };
export type { Messages } from "./types";
export type { LocaleCode } from "./config";
export type { NamespaceName };
