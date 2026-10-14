import { normalizeLocale } from "./locales";

const RTL_LOCALES = new Set(["ar"]);

export function isRtlLocale(locale: string | null | undefined): boolean {
  return RTL_LOCALES.has(normalizeLocale(locale));
}

export function getLocaleDirection(locale: string | null | undefined): "ltr" | "rtl" {
  return isRtlLocale(locale) ? "rtl" : "ltr";
}

export function getLocaleTextAlign(locale: string | null | undefined): "left" | "right" {
  return isRtlLocale(locale) ? "right" : "left";
}

export function getLocaleRowDirection(locale: string | null | undefined): "row" | "row-reverse" {
  return isRtlLocale(locale) ? "row-reverse" : "row";
}
