export type LocaleCode =
  | "es"
  | "en"
  | "fr"
  | "pt"
  | "it"
  | "ru"
  | "zh"
  | "ko"
  | "ja"
  | "hi"
  | "ar";

export type LocaleEntry = { code: LocaleCode; label: string; flag: string; countryCode: string };

export const LOCALES: readonly LocaleEntry[] = [
  { code: "es", label: "Español",   flag: "🇪🇸", countryCode: "es" },
  { code: "en", label: "English",   flag: "🇬🇧", countryCode: "gb" },
  { code: "fr", label: "Français",  flag: "🇫🇷", countryCode: "fr" },
  { code: "pt", label: "Português", flag: "🇵🇹", countryCode: "pt" },
  { code: "it", label: "Italiano",  flag: "🇮🇹", countryCode: "it" },
  { code: "ru", label: "Русский",   flag: "🇷🇺", countryCode: "ru" },
  { code: "zh", label: "中文",       flag: "🇨🇳", countryCode: "cn" },
  { code: "ko", label: "한국어",     flag: "🇰🇷", countryCode: "kr" },
  { code: "ja", label: "日本語",     flag: "🇯🇵", countryCode: "jp" },
  { code: "hi", label: "हिन्दी",    flag: "🇮🇳", countryCode: "in" },
  { code: "ar", label: "العربية",   flag: "🇸🇦", countryCode: "sa" },
] as const;

export const DEFAULT_LOCALE: LocaleCode = "en";

const VALID = new Set<string>(LOCALES.map((entry) => entry.code));

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return typeof value === "string" && VALID.has(value);
}

export function normalizeLocale(value: string | null | undefined): LocaleCode {
  return isLocaleCode(value) ? value : DEFAULT_LOCALE;
}
