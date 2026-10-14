// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Locale catalogue — mirrors LP-LICENSE-SERVER's i18n/locales set.
// Spanish (es) defines the key structure; 11 other locales provide translations.

export type LocaleCode =
  | "es"
  | "en"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "ar"
  | "bn"
  | "hi"
  | "ja"
  | "ko"
  | "ru";

export type LocaleEntry = { code: LocaleCode; label: string };

export const LOCALES: readonly LocaleEntry[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "bn", label: "বাংলা" },
  { code: "hi", label: "हिन्दी" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "ru", label: "Русский" },
] as const;

export const DEFAULT_LOCALE: LocaleCode = "en";

export const localeCookieName = "lxp-locale";

// Right-to-left locales need dir="rtl" on the document.
export const rtlLocales = new Set<LocaleCode>(["ar"]);

const VALID = new Set<string>(LOCALES.map((entry) => entry.code));

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return typeof value === "string" && VALID.has(value);
}

// Accept-Language / cookie / query values may carry region or quality suffixes
// (e.g. "zh-Hant-TW", "en-US", "es-CO;q=0.9"). Resolve them down to a known code.
export function parseLocale(input?: string | null): LocaleCode | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  const first = raw.split(",")[0]?.split(";")[0]?.trim() ?? "";
  if (!first) return null;

  if (isLocaleCode(first)) return first;

  const lower = first.toLowerCase();
  // exact (case-insensitive) match against known codes
  for (const code of VALID) {
    if (code.toLowerCase() === lower) return code as LocaleCode;
  }
  // primary subtag fallback (e.g. "fr-FR" → "fr")
  const primary = lower.split("-")[0] ?? "";
  if (isLocaleCode(primary)) return primary;
  return null;
}

export function normalizeLocale(input?: string | null): LocaleCode {
  return parseLocale(input) ?? DEFAULT_LOCALE;
}

export function isRtlLocale(locale: LocaleCode): boolean {
  return rtlLocales.has(locale);
}

export function localeDir(locale: LocaleCode): "ltr" | "rtl" {
  return isRtlLocale(locale) ? "rtl" : "ltr";
}
