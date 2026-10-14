// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Language names for prompts whose generated content is shown to the user. */
import { apiLocale, type ApiLocale } from "./errors.js";

const names: Record<ApiLocale, string> = {
  es: "Spanish",
  en: "English",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ar: "Arabic",
  bn: "Bengali",
  hi: "Hindi",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
};

export function aiOutputLanguage(locale: unknown): string {
  return names[apiLocale(locale)];
}
