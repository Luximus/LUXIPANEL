// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Client-side i18n helpers for extracted scripts.
// Page scripts receive their slice of messages via Astro `define:vars`; this
// module only provides the {key} interpolation used both on server and client.

import { DEFAULT_LOCALE, normalizeLocale, type LocaleCode } from "./config";
import type { Messages } from "./types";
import type { NamespaceName } from "./index";

export interface FormatMessageOptions {
  /**
   * What to emit for a `{key}` with no matching param:
   *   - `"keep"` (default) — leave the `{key}` placeholder in place. This is what
   *     every extracted script / DataTable / api-client copy did.
   *   - `"empty"` — drop it. The floating assistant deliberately blanks unknown
   *     placeholders (`formatAssistantMessage`), so it keeps that behavior.
   */
  onMissing?: "keep" | "empty";
}

/**
 * `{key}` interpolation — the single implementation behind `formatMessage`,
 * `dtFormat`, `formatChatMessage` and `formatAssistantMessage` (T-08).
 */
export function formatMessage(
  template: string,
  params: Record<string, string | number> = {},
  options: FormatMessageOptions = {},
): string {
  const missing = options.onMissing === "empty" ? "" : null;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    if (value === undefined || value === null) return missing ?? match;
    return String(value);
  });
}

type I18nManifest = {
  version: string;
  locales: string[];
  namespaces: string[];
};

const manifestCache = new Map<string, Promise<I18nManifest>>();
const namespaceCache = new Map<string, Promise<unknown>>();
const messagesCache = new Map<string, Promise<Partial<Messages>>>();

async function loadManifest(basePath = "/i18n"): Promise<I18nManifest> {
  const cacheKey = basePath;
  const cached = manifestCache.get(cacheKey);
  if (cached) return cached;

  const pending = fetch(`${basePath}/manifest.json`, { cache: "no-cache" }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load i18n manifest: ${response.status}`);
    }
    return response.json() as Promise<I18nManifest>;
  });

  manifestCache.set(cacheKey, pending);
  return pending;
}

async function loadNamespaceAsset(
  locale: LocaleCode,
  namespace: NamespaceName,
  basePath = "/i18n",
): Promise<Messages[NamespaceName]> {
  const manifest = await loadManifest(basePath);
  const resolvedLocale = manifest.locales.includes(locale) ? locale : DEFAULT_LOCALE;
  const cacheKey = `${basePath}:${manifest.version}:${resolvedLocale}:${String(namespace)}`;
  const cached = namespaceCache.get(cacheKey);
  if (cached) return cached as Promise<Messages[NamespaceName]>;

  const pending = fetch(`${basePath}/${manifest.version}/${resolvedLocale}/${String(namespace)}.json`, {
    cache: "force-cache",
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load i18n namespace ${cacheKey}: ${response.status}`);
    }
    return response.json() as Promise<Messages[NamespaceName]>;
  });

  namespaceCache.set(cacheKey, pending);
  return pending;
}

export async function getClientMessages(
  locale: string | null | undefined,
  namespaces: readonly NamespaceName[],
  basePath = "/i18n",
): Promise<Partial<Messages>> {
  const normalizedLocale = normalizeLocale(locale);
  const uniqueNamespaces = [...new Set(namespaces)];
  const cacheKey = `${basePath}:${normalizedLocale}:${uniqueNamespaces.join(",")}`;
  const cached = messagesCache.get(cacheKey);
  if (cached) return cached;

  const pending = (async () => {
    const entries = await Promise.all(
      uniqueNamespaces.map(async (namespace) => [
        namespace,
        await loadNamespaceAsset(normalizedLocale, namespace, basePath),
      ] as const),
    );
    return Object.fromEntries(entries) as Partial<Messages>;
  })();

  messagesCache.set(cacheKey, pending);
  return pending;
}
