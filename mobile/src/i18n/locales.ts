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

export type LocaleEntry = { code: LocaleCode; label: string; flag: string };

export const LOCALES: readonly LocaleEntry[] = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
] as const;

export const DEFAULT_LOCALE: LocaleCode = "en";

const VALID = new Set<string>(LOCALES.map((entry) => entry.code));

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return typeof value === "string" && VALID.has(value);
}

export function normalizeLocale(value: string | null | undefined): LocaleCode {
  const base = value?.trim().toLowerCase().split(/[-_]/)[0];
  return isLocaleCode(base) ? base : DEFAULT_LOCALE;
}
