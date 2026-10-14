type I18nManifest = {
  version: string;
  locales: string[];
  namespaces: string[];
};

const DEFAULT_LOCALE = "en";

/**
 * E-12: the supported-locale list was written TWICE inside `normalizeLocale`
 * below (exact match, then primary-subtag match). It lives here once now.
 *
 * SSOT NOTE: the build-time authority is `scripts/i18n-shared.mjs` (`LOCALES`),
 * which drives the generated i18n assets. It cannot be imported here — this file
 * is a standalone esbuild entry (`bundle:false`), so any bare/aliased specifier
 * would reach the browser unresolved. Keep both lists in lockstep; the runtime
 * one is also validated against `manifest.json` in `loadNamespaceAsset`.
 */
const SUPPORTED_LOCALES = [
  "es", "en", "fr", "de", "it", "pt", "ar", "bn", "hi", "ja", "ko", "ru",
];
const manifestCache = new Map<string, Promise<I18nManifest>>();
const namespaceCache = new Map<string, Promise<unknown>>();
const messagesCache = new Map<string, Promise<Record<string, unknown>>>();

function normalizeLocale(input?: string | null): string {
  if (!input) return DEFAULT_LOCALE;
  const raw = input.trim();
  if (!raw) return DEFAULT_LOCALE;

  const first = raw.split(",")[0]?.split(";")[0]?.trim() ?? "";
  if (!first) return DEFAULT_LOCALE;

  const lower = first.toLowerCase();
  const primary = lower.split("-")[0] ?? "";
  const exact = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === lower || locale === first,
  );

  return exact ?? (SUPPORTED_LOCALES.includes(primary) ? primary : DEFAULT_LOCALE);
}

async function loadManifest(basePath = "/i18n"): Promise<I18nManifest> {
  const cacheKey = basePath;
  const cached = manifestCache.get(cacheKey);
  if (cached) return cached;

  const pending = fetch(`${basePath}/manifest.json`, { cache: "no-cache" }).then(async (response) => {
    if (!response.ok) throw new Error(`Failed to load i18n manifest: ${response.status}`);
    return response.json() as Promise<I18nManifest>;
  });

  manifestCache.set(cacheKey, pending);
  return pending;
}

async function loadNamespaceAsset(
  locale: string,
  namespace: string,
  basePath = "/i18n",
): Promise<unknown> {
  const manifest = await loadManifest(basePath);
  const resolvedLocale = manifest.locales.includes(locale) ? locale : DEFAULT_LOCALE;
  const cacheKey = `${basePath}:${manifest.version}:${resolvedLocale}:${namespace}`;
  const cached = namespaceCache.get(cacheKey);
  if (cached) return cached;

  const pending = fetch(`${basePath}/${manifest.version}/${resolvedLocale}/${namespace}.json`, {
    cache: "force-cache",
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Failed to load i18n namespace ${cacheKey}: ${response.status}`);
    return response.json() as Promise<unknown>;
  });

  namespaceCache.set(cacheKey, pending);
  return pending;
}

export async function getClientMessages(
  locale: string | null | undefined,
  namespaces: readonly string[],
  basePath = "/i18n",
): Promise<Record<string, unknown>> {
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
    return Object.fromEntries(entries);
  })();

  messagesCache.set(cacheKey, pending);
  return pending;
}
