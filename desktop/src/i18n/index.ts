import { ALL_MESSAGES, type Messages } from "./messages";
import { normalizeLocale } from "./locales";
import type { LocaleCode } from "./locales";

export function getMessages(locale: string | null | undefined): Messages {
  return ALL_MESSAGES[normalizeLocale(locale)] ?? ALL_MESSAGES.es;
}

/**
 * Replace `{key}` placeholders in a translated string with values from `params`.
 * Missing keys are left as-is so they are easy to spot during translation.
 */
export function formatMessage(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}

export type { Messages, LocaleCode };
export { LOCALES, DEFAULT_LOCALE, isLocaleCode, normalizeLocale } from "./locales";
